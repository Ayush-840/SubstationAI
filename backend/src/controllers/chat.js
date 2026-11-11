import { z } from "zod";
import { prisma } from "../db.js";
import { getOwnedSession, processChat } from "../services/chat.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  title: z.string().max(120).optional(),
});

const renameSessionSchema = z.object({
  title: z.string().min(1, "title is required").max(120),
});

const chatSchema = z.object({
  question: z.string().min(1, "question is required").max(2000),
  sessionId: z.string().uuid().optional(),
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
  const sessions = await prisma.chatSession.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  const formatted = sessions.map(({ _count, ...s }) => ({
    ...s,
    messageCount: _count.messages,
  }));

  res.json({ sessions: formatted });
}

/** GET /api/chat/sessions/:id */
export async function getSession(req, res) {
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
  const { title } = renameSessionSchema.parse(req.body);
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
  res.json({ message: "Session deleted" });
}

// ── Chat controller ───────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Body: { question, sessionId? }
 *
 * If sessionId is omitted, creates a new session automatically.
 * Returns: { answer, sources, intent, messageId, sessionId }
 */
export async function chat(req, res) {
  const { question, sessionId: bodySessionId } = chatSchema.parse(req.body);

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

  const result = await processChat(sessionId, req.user.id, question);

  res.json({ ...result, ...(newSession ? { newSession: true } : {}) });
}
