import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short'),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  role: z.enum(['user', 'admin']).default('user'),
});
const roleSchema = z.object({ role: z.enum(['user', 'admin']) });

router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at ASC'
  );
  res.json({ users: rows });
});

router.post('/', async (req, res) => {
  const { name, email, password, role } = createSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [name, email, hash, role]
  );
  res.status(201).json({ user: publicUser(rows[0]) });
});

router.patch('/:id/role', async (req, res) => {
  const { role } = roleSchema.parse(req.body);
  if (req.params.id === req.user.id) {
    throw new AppError(400, 'SELF_CHANGE', 'You cannot change your own role');
  }
  const { rows } = await query(
    `UPDATE users SET role = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, email, role`,
    [role, req.params.id]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'User not found');
  res.json({ user: publicUser(rows[0]) });
});

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    throw new AppError(400, 'SELF_CHANGE', 'You cannot delete your own account');
  }
  const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'User not found');
  res.status(204).end();
});

export default router;
