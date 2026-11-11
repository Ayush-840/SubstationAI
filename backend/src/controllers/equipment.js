import { z } from "zod";
import { prisma } from "../db.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const createEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const updateEquipmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/equipment */
export async function listEquipment(req, res) {
  const equipment = await prisma.equipment.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tests: true } } },
  });
  res.json({ equipment });
}

/** GET /api/equipment/:id */
export async function getEquipment(req, res) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { tests: true } } },
  });
  if (!equipment) {
    return res.status(404).json({ error: "Equipment not found" });
  }
  res.json({ equipment });
}

/** GET /api/equipment/:id/tests */
export async function getEquipmentTests(req, res) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: req.params.id },
  });
  if (!equipment) {
    return res.status(404).json({ error: "Equipment not found" });
  }

  const tests = await prisma.test.findMany({
    where: { equipmentId: req.params.id },
    orderBy: { name: "asc" },
  });
  res.json({ equipment: { id: equipment.id, name: equipment.name }, tests });
}

/** POST /api/equipment  (ADMIN) */
export async function createEquipment(req, res) {
  const data = createEquipmentSchema.parse(req.body);
  const equipment = await prisma.equipment.create({ data });
  res.status(201).json({ equipment });
}

/** PUT /api/equipment/:id  (ADMIN) */
export async function updateEquipment(req, res) {
  const data = updateEquipmentSchema.parse(req.body);
  const equipment = await prisma.equipment.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ equipment });
}

/** DELETE /api/equipment/:id  (ADMIN) */
export async function deleteEquipment(req, res) {
  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ message: "Equipment deleted" });
}

