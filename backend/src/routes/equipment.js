import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().nullable().optional(),
});
const updateSchema = createSchema.partial();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT e.id, e.name, e.category, e.description, e.created_at,
            (SELECT count(*)::int FROM tests t WHERE t.equipment_id = e.id) AS test_count
     FROM equipment e
     ORDER BY e.name ASC`
  );
  res.json({ equipment: rows });
});

router.get('/:id/tests', requireAuth, async (req, res) => {
  const equipment = await query('SELECT id, name, category, description FROM equipment WHERE id = $1', [
    req.params.id,
  ]);
  if (!equipment.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');

  const { rows } = await query(
    `SELECT id, equipment_id, name, procedure, acceptable_limit, safety_notes, created_at
     FROM tests WHERE equipment_id = $1 ORDER BY name ASC`,
    [req.params.id]
  );
  res.json({ equipment: equipment.rows[0], tests: rows });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, category, description } = createSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO equipment (name, category, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, category, description, created_at`,
    [name, category, description ?? null]
  );
  res.status(201).json({ equipment: rows[0] });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const patch = updateSchema.parse(req.body);
  const existing = await query('SELECT * FROM equipment WHERE id = $1', [req.params.id]);
  if (!existing.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');

  const merged = { ...existing.rows[0], ...patch };
  const { rows } = await query(
    `UPDATE equipment SET name = $1, category = $2, description = $3
     WHERE id = $4
     RETURNING id, name, category, description, created_at`,
    [merged.name, merged.category, merged.description, req.params.id]
  );
  res.json({ equipment: rows[0] });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM equipment WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');
  res.status(204).end();
});

export default router;
