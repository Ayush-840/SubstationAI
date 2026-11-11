import { z } from "zod";
import { prisma } from "../db.js";
import { getOwnedSession, processChat } from "../services/chat.js";
import { getAnswer } from "../ai/index.js";
import { buildCacheKey, cacheGet, cacheSet } from "../services/cache.js";
import { loadHistory } from "../services/chat.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  title: z.string().max(100).optional(),
});

const renameSesionSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(100),
});

const chatSchema = z.object({
  question: z.string().trim().min(1, "question is required").max(1000),
  sessionId: z.string().uuid().optional(),
  equipmentType: z.string().optional(),
  useCache: z.boolean().optional().default(true),
});

// ── Session controllers ───────────────────────────────────────────────────────

/** POST /api/chat/sessions */
export async function createSession(req, res) {
  const { title } = createSessionSchema.parse(req.body);
  const session = await prisma.chatSession.create({
    data: {
      userId: req.user.id,
      title: title || "New Chat",
    },
  });
  res.status(201).json({ session });
}

/** GET /api/chat/sessions */
export async function listSessions(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const where = { userId: req.user.id };
  const [sessions, total] = await Promise.all([prisma.chatSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: { _count: { select: { messages: true } } },
  }), prisma.chatSession.count({ where })]);

  const items = await Promise.all(sessions.map(async ({ _count, ...s }) => {
    const lastMessage = await prisma.message.findFirst({ where: { sessionId: s.id }, orderBy: { createdAt: "desc" }, select: { content: true } });
    return { ...s, messageCount: _count.messages, lastMessage: lastMessage?.content.slice(0, 120) ?? null };
  }));

  res.json({ items, page, limit, total });
}

/** GET /api/chat/sessions/:id */
export async function getSession(req, res) {
  // Ownership enforced inside getOwnedSession
  await getOwnedSession(req.params.id, req.user.id);

  const session = await prisma.chatSession.findUnique({
    where: { id: req.params.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json({ session });
}

/** PATCH /api/chat/sessions/:id */
export async function renameSession(req, res) {
  const { title } = renameSesionSchema.parse(req.body);
  await getOwnedSession(req.params.id, req.user.id);

  const session = await prisma.chatSession.update({
    where: { id: req.params.id },
    data: { title },
  });
  res.json({ session });
}

/** DELETE /api/chat/sessions/:id */
export async function deleteSession(req, res) {
  await getOwnedSession(req.params.id, req.user.id);
  await prisma.chatSession.delete({ where: { id: req.params.id } });
  res.status(204).end();
}

// ── Chat controllers ──────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Body: { question, sessionId?, equipmentType?, noCache? }
 *
 * If sessionId is omitted, creates a new session automatically.
 * Returns: { answer, sources, intent, messageId, sessionId, cached }
 */
export async function chat(req, res) {
  const { question, sessionId: bodySessionId, equipmentType, useCache } =
    chatSchema.parse(req.body);

  let sessionId = bodySessionId;
  let newSession = false;

  // Auto-create session if not provided
  if (!sessionId) {
    const session = await prisma.chatSession.create({
      data: { userId: req.user.id, title: "New Chat" },
    });
    sessionId = session.id;
    newSession = true;
  }

  const result = await processChat(sessionId, req.user.id, question, {
    useCache,
    equipmentType,
  });

  res.json(result);
}

/**
 * POST /api/chat/stream
 * Same flow as POST /chat but streams the answer over SSE.
 *
 * SSE event types:
 *   data: {"type":"token","content":"..."}
 *   data: {"type":"sources","sources":[...]}
 *   data: {"type":"done","intent":"...","messageId":"...","sessionId":"...","cached":bool}
 *
 * If getAnswer doesn't support streaming, the full answer is chunked in ~20-word pieces.
 */
export async function chatStream(req, res) {
  const { question, sessionId: bodySessionId, equipmentType, useCache } =
    chatSchema.parse(req.body);

  let sessionId = bodySessionId;
  let newSession = false;

  if (!sessionId) {
    const session = await prisma.chatSession.create({
      data: { userId: req.user.id, title: "New Chat" },
    });
    sessionId = session.id;
    newSession = true;
  }

  // Verify ownership before opening the SSE connection
  await getOwnedSession(sessionId, req.user.id);

  // ── Set up SSE headers ────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Helper to send one SSE event
  const send = (payload) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  // Handle client disconnect
  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    // ── Cache check ─────────────────────────────────────────────────────────
    const cacheKey = buildCacheKey(question, equipmentType ?? "");
    const streamHistory = await loadHistory(sessionId);
    const cached = useCache && streamHistory.length === 0 ? cacheGet(cacheKey) : null;

    if (cached) {
      // Stream the cached answer in word-sized chunks
      const words = cached.answer.split(" ");
      for (const word of words) {
        if (clientGone) break;
        send({ type: "token", content: word + " " });
        await sleep(15); // small delay to simulate streaming
      }
      send({ type: "sources", sources: cached.sources });

      // Persist messages even from cache
      const [, assistantMsg] = await persistMessagesForStream(
        sessionId,
        question,
        cached.answer,
        cached.sources
      );
      await maybeAutoTitleStream(sessionId, question);

      send({
        type: "done",
        intent: cached.intent,
        messageId: assistantMsg.id,
        sessionId,
        cached: true,
        ...(newSession ? { newSession: true } : {}),
      });

      res.end();
      return;
    }

    // ── Live answer ─────────────────────────────────────────────────────────
    const history = streamHistory;
    const start = Date.now();
    await prisma.message.create({ data: { sessionId, role: "USER", content: question } });
    let result;
    try { result = await getAnswer(question, history); }
    catch { send({ type: "error", error: "AI service failed, please try again" }); res.status(502); res.end(); return; }
    const { answer, sources, intent } = result;
    const latencyMs = Date.now() - start;

    console.log(
      `[Stream] question="${question.slice(0, 60)}" intent=${intent} latency=${latencyMs}ms`
    );

    // Stream the answer in ~20-word chunks
    const words = answer.split(" ");
    const CHUNK_SIZE = 20;
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      if (clientGone) break;
      const chunk = words.slice(i, i + CHUNK_SIZE).join(" ") + " ";
      send({ type: "token", content: chunk });
      await sleep(30);
    }

    if (!clientGone) {
      send({ type: "sources", sources });

      // Persist
      const [, assistantMsg] = await persistMessagesForStream(
        sessionId,
        question,
        answer,
        sources
      );
      await maybeAutoTitleStream(sessionId, question);

      // Cache
      if (history.length === 0) cacheSet(cacheKey, { answer, sources, intent });

      send({
        type: "done",
        intent,
        messageId: assistantMsg.id,
        sessionId,
        cached: false,
        ...(newSession ? { newSession: true } : {}),
      });
    }
  } catch (err) {
    console.error("[Stream] Error:", err.message);
    if (!clientGone && !res.writableEnded) {
      send({ type: "error", error: err.message });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}

// ── Private stream helpers ────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function persistMessagesForStream(sessionId, question, answer, sources) {
  const { prisma: db } = await import("../db.js");
  return db.$transaction([
    db.message.create({
      data: { sessionId, role: "USER", content: question, sources: null },
    }),
    db.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        sources: sources ?? [],
      },
    }),
  ]);
}

async function maybeAutoTitleStream(sessionId, question) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { title: true },
  });
  if (session?.title === "New Chat") {
    const title = question.trim().slice(0, 60);
    prisma.chatSession
      .update({ where: { id: sessionId }, data: { title } })
      .catch((e) => console.error("[Stream] Auto-title failed:", e.message));
  }
}

