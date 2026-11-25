import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

const createSchema = z.object({
  equipmentId: z.string().uuid('Valid equipmentId is required'),
  name: z.string().trim().min(1, 'Name is required'),
  procedure: z.string().trim().nullable().optional(),
  acceptableLimit: z.string().trim().nullable().optional(),
  safetyNotes: z.string().trim().nullable().optional(),
});
const updateSchema = z.object({
  equipmentId: z.string().uuid('Valid equipmentId is required').optional(),
  name: z.string().trim().min(1, 'Name is required').optional(),
  procedure: z.string().trim().nullable().optional(),
  acceptableLimit: z.string().trim().nullable().optional(),
  safetyNotes: z.string().trim().nullable().optional(),
});

async function assertEquipment(id) {
  const { rows } = await query('SELECT id FROM equipment WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');
}

router.post('/', ...adminOnly, async (req, res) => {
  const body = createSchema.parse(req.body);
  await assertEquipment(body.equipmentId);

  const { rows } = await query(
    `INSERT INTO tests (equipment_id, name, procedure, acceptable_limit, safety_notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, equipment_id, name, procedure, acceptable_limit, safety_notes, created_at`,
    [
      body.equipmentId,
      body.name,
      body.procedure ?? null,
      body.acceptableLimit ?? null,
      body.safetyNotes ?? null,
    ]
  );
  res.status(201).json({ test: rows[0] });
});

router.patch('/:id', ...adminOnly, async (req, res) => {
  const patch = updateSchema.parse(req.body);
  const existing = await query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
  if (!existing.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Test not found');

  if (patch.equipmentId) await assertEquipment(patch.equipmentId);

  const current = existing.rows[0];
  const merged = {
    equipmentId: patch.equipmentId ?? current.equipment_id,
    name: patch.name ?? current.name,
    procedure: patch.procedure !== undefined ? patch.procedure : current.procedure,
    acceptableLimit:
      patch.acceptableLimit !== undefined ? patch.acceptableLimit : current.acceptable_limit,
    safetyNotes: patch.safetyNotes !== undefined ? patch.safetyNotes : current.safety_notes,
  };

  const { rows } = await query(
    `UPDATE tests SET equipment_id = $1, name = $2, procedure = $3, acceptable_limit = $4, safety_notes = $5
     WHERE id = $6
     RETURNING id, equipment_id, name, procedure, acceptable_limit, safety_notes, created_at`,
    [merged.equipmentId, merged.name, merged.procedure, merged.acceptableLimit, merged.safetyNotes, req.params.id]
  );
  res.json({ test: rows[0] });
});

router.delete('/:id', ...adminOnly, async (req, res) => {
  const { rows } = await query('DELETE FROM tests WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Test not found');
  res.status(204).end();
});

export default router;
