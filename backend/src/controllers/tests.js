import { z } from "zod";
import { prisma } from "../db.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const createTestSchema = z.object({
  equipmentId: z.string().uuid("equipmentId must be a valid UUID"),
  name: z.string().min(1, "Name is required"),
  aliases: z.array(z.string()).default([]),
  steps: z.array(z.string()).min(1, "At least one step is required"),
  limits: z.string().optional(),
  safety: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  standard: z.string().optional(),
  troubleshooting: z.string().optional(),
});

export const updateTestSchema = createTestSchema.partial().omit({ equipmentId: true });

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/tests/:id */
export async function getTest(req, res) {
  const test = await prisma.test.findUnique({
    where: { id: req.params.id },
    include: { equipment: { select: { id: true, name: true } } },
  });
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  res.json({ test });
}

/**
 * GET /api/tests?search=<query>&equipmentId=<id>
 * Searches name and aliases (case-insensitive).
 */
export async function searchTests(req, res) {
  const { search, equipmentId } = req.query;

  const where = {};

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (search) {
    // Prisma doesn't natively support searching inside String[] with contains,
    // so we search name with contains AND aliases using hasSome approach.
    // We use OR to match either the name or any alias.
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      {
        aliases: {
          hasSome: [search.toLowerCase()],
        },
      },
    ];

    // Also try a broader alias search since hasSome is exact-match on elements.
    // Add a raw filter using the array overlap pattern via findMany with filter
    // We'll return a merged deduped list from both queries.
    // For simplicity and correctness: use two queries and deduplicate.
  }

  let tests;

  if (search) {
    // Query 1: name contains
    const byName = await prisma.test.findMany({
      where: {
        ...(equipmentId ? { equipmentId } : {}),
        name: { contains: search, mode: "insensitive" },
      },
      include: { equipment: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    // Query 2: aliases array element contains search string
    // Prisma doesn't support array element ILIKE, so we use a workaround:
    // filter all tests (for the equipmentId if given) and do JS filtering.
    const allForEquipment = await prisma.test.findMany({
      where: equipmentId ? { equipmentId } : {},
      include: { equipment: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    const lowerSearch = search.toLowerCase();
    const byAlias = allForEquipment.filter((t) =>
      t.aliases.some((a) => a.toLowerCase().includes(lowerSearch))
    );

    // Merge and deduplicate by id
    const merged = [...byName, ...byAlias];
    const seen = new Set();
    tests = merged.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  } else {
    tests = await prisma.test.findMany({
      where,
      include: { equipment: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  res.json({ tests, count: tests.length });
}

/** POST /api/tests  (ADMIN) */
export async function createTest(req, res) {
  const data = createTestSchema.parse(req.body);

  // Verify equipment exists
  const equipment = await prisma.equipment.findUnique({
    where: { id: data.equipmentId },
  });
  if (!equipment) {
    return res.status(404).json({ error: "Equipment not found" });
  }

  const test = await prisma.test.create({
    data,
    include: { equipment: { select: { id: true, name: true } } },
  });
  res.status(201).json({ test });
}

/** PUT /api/tests/:id  (ADMIN) */
export async function updateTest(req, res) {
  const data = updateTestSchema.parse(req.body);
  const test = await prisma.test.update({
    where: { id: req.params.id },
    data,
    include: { equipment: { select: { id: true, name: true } } },
  });
  res.json({ test });
}

/** DELETE /api/tests/:id  (ADMIN) */
export async function deleteTest(req, res) {
  await prisma.test.delete({ where: { id: req.params.id } });
  res.json({ message: "Test deleted" });
}

