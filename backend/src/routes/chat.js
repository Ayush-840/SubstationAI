import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getAnswer } from '../services/answer.js';

const router = Router();
router.use(requireAuth);

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
const renameSessionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
});
const messageSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a UUID').optional(),
  question: z.string().trim().min(1, 'Question is required').max(4000, 'Question is too long'),
});

async function ownedSession(id, userId) {
  const { rows } = await query(
    'SELECT id, title FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');
  return rows[0];
}

router.get('/sessions', async (req, res) => {
  const { page, limit } = pageSchema.parse(req.query);
  const offset = (page - 1) * limit;

  const totalResult = await query('SELECT count(*)::int AS total FROM chat_sessions WHERE user_id = $1', [
    req.user.id,
  ]);
  const { rows } = await query(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            (SELECT count(*)::int FROM messages m WHERE m.session_id = s.id) AS message_count
     FROM chat_sessions s
     WHERE s.user_id = $1
     ORDER BY s.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );

  const total = totalResult.rows[0].total;
  res.json({ sessions: rows, page, limit, total, totalPages: Math.ceil(total / limit) });
});

router.post('/sessions', async (req, res) => {
  const { title } = createSessionSchema.parse(req.body || {});
  const { rows } = await query(
    `INSERT INTO chat_sessions (user_id, title)
     VALUES ($1, $2)
     RETURNING id, title, created_at, updated_at`,
    [req.user.id, title || 'New chat']
  );
  res.status(201).json({ session: rows[0] });
});

router.patch('/sessions/:id', async (req, res) => {
  const { title } = renameSessionSchema.parse(req.body);
  const { rows } = await query(
    `UPDATE chat_sessions SET title = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING id, title, created_at, updated_at`,
    [title, req.params.id, req.user.id]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');
  res.json({ session: rows[0] });
});

router.delete('/sessions/:id', async (req, res) => {
  const { rows } = await query(
    'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Chat session not found');
  res.status(204).end();
});

router.get('/sessions/:id/messages', async (req, res) => {
  await ownedSession(req.params.id, req.user.id);
  const { rows } = await query(
    `SELECT id, session_id, role, content, sources, created_at
     FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ messages: rows });
});

router.post('/', async (req, res) => {
  const { sessionId, question } = messageSchema.parse(req.body);

  let session;
  if (sessionId) {
    session = await ownedSession(sessionId, req.user.id);
  } else {
    const title = question.length > 60 ? `${question.slice(0, 57)}...` : question;
    const created = await query(
      `INSERT INTO chat_sessions (user_id, title)
       VALUES ($1, $2)
       RETURNING id, title`,
      [req.user.id, title]
    );
    session = created.rows[0];
  }

  await query('INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3)', [
    session.id,
    'user',
    question,
  ]);

  const history = await query(
    `SELECT role, content FROM messages
     WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [session.id]
  );

  const { answer, sources } = await getAnswer(
    question,
    history.rows.reverse()
  );

  await query(
    `INSERT INTO messages (session_id, role, content, sources)
     VALUES ($1, 'assistant', $2, $3)`,
    [session.id, answer, JSON.stringify(sources)]
  );
  await query('UPDATE chat_sessions SET updated_at = now() WHERE id = $1', [session.id]);

  res.json({ sessionId: session.id, answer, sources });
});

export default router;
