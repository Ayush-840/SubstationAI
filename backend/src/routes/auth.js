import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

if (env.NODE_ENV !== 'test') {
  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
    })
  );
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

const sign = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

router.post('/register', async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role`,
    [name, email, hash]
  );
  res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
});

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = $1', [email]);
  const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');
  res.json({ token: sign(rows[0]), user: publicUser(rows[0]) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw new AppError(401, 'INVALID_TOKEN', 'User no longer exists');

  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, req.user.id]);
  res.status(204).end();
});

export default router;
