/**
 * src/services/chat.js
 *
 * Business logic for chat: session ownership, history loading,
 * calling getAnswer, persisting messages, auto-titling, caching.
 */

import { prisma } from "../db.js";
import { getAnswer } from "../ai/index.js";
import { buildCacheKey, cacheGet, cacheSet } from "./cache.js";

// Number of past message pairs (user+assistant) to include as history
const HISTORY_LIMIT = 10;

// ── Session helpers ───────────────────────────────────────────────────────────

/**
 * Find a session and verify it belongs to userId.
 * Throws a shaped error (caught by errorHandler via asyncHandler).
 */
export async function getOwnedSession(sessionId, userId) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    const err = new Error("Chat session not found");
    err.status = 404;
    throw err;
  }
  if (session.userId !== userId) {
    const err = new Error("You do not have access to this session");
    err.status = 403;
    throw err;
  }
  return session;
}

/**
 * Load the last HISTORY_LIMIT messages from a session, formatted for getAnswer.
 * Returns [{ role: 'user'|'assistant', content: string }, ...]
 */
export async function loadHistory(sessionId) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  // Reverse so oldest is first (chronological order for the AI)
  return messages.reverse().map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
}

/**
 * Auto-title a session from the first question if it still has the default title.
 * Truncates to 60 chars. Fire-and-forget (no await needed in hot path).
 */
export async function autoTitleSession(sessionId, question) {
  const title = question.trim().slice(0, 60) + (question.length > 60 ? "…" : "");
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}

// ── Core answer flow ──────────────────────────────────────────────────────────

/**
 * Full answer flow:
 *   1. Check cache (bypass with { noCache: true } option)
 *   2. Load history
 *   3. Call getAnswer stub / real AI
 *   4. Persist USER + ASSISTANT messages
 *   5. Auto-title if first message
 *   6. Update cache
 *
 * Returns { answer, sources, intent, messageId, sessionId, cached }
 */
export async function processChat(sessionId, userId, question, options = {}) {
  const { noCache = false, equipmentType = "" } = options;

  // ── Ownership check ───────────────────────────────────────────────────────
  await getOwnedSession(sessionId, userId);

  // ── Cache lookup ──────────────────────────────────────────────────────────
  const cacheKey = buildCacheKey(question, equipmentType);
  if (!noCache) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`[Chat] Cache HIT for key: "${cacheKey}"`);
      // Still persist the user message even when answer comes from cache
      const [userMsg, assistantMsg] = await persistMessages(
        sessionId,
        question,
        cached.answer,
        cached.sources
      );
      await maybeAutoTitle(sessionId, question);
      return {
        ...cached,
        messageId: assistantMsg.id,
        sessionId,
        cached: true,
      };
    }
  }

  // ── Load history & call AI ────────────────────────────────────────────────
  const history = await loadHistory(sessionId);

  const start = Date.now();
  const { answer, sources, intent } = await getAnswer(question, history);
  const latencyMs = Date.now() - start;

  console.log(
    `[Chat] question="${question.slice(0, 60)}" intent=${intent} latency=${latencyMs}ms`
  );

  // ── Persist messages ──────────────────────────────────────────────────────
  const [_userMsg, assistantMsg] = await persistMessages(
    sessionId,
    question,
    answer,
    sources
  );

  // ── Auto-title (only if session still has default title) ──────────────────
  await maybeAutoTitle(sessionId, question);

  // ── Cache the result ──────────────────────────────────────────────────────
  cacheSet(cacheKey, { answer, sources, intent });

  return {
    answer,
    sources,
    intent,
    messageId: assistantMsg.id,
    sessionId,
    cached: false,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function persistMessages(sessionId, question, answer, sources) {
  // Use a transaction so both messages are always created together
  return prisma.$transaction([
    prisma.message.create({
      data: {
        sessionId,
        role: "USER",
        content: question,
        sources: null,
      },
    }),
    prisma.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        sources: sources ?? [],
      },
    }),
  ]);
}

async function maybeAutoTitle(sessionId, question) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { title: true },
  });
  if (session?.title === "New Chat") {
    // Fire and forget — don't block the response
    autoTitleSession(sessionId, question).catch((err) =>
      console.error("[Chat] Auto-title failed:", err.message)
    );
  }
}

