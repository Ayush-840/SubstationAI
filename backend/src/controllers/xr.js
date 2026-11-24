import { z } from "zod";
import { prisma } from "../db.js";

// ── Sample insulation model (same numbers as the frontend megger.ts) ──────────
// Teaching sample, not a measurement. Kept server-side so the verdict is never
// trusted from the client.
const CONDITIONS = {
  dry: { rInfMOhm: 5000, k: 0.8, tauS: 240 },
  damp: { rInfMOhm: 2500, k: 0.55, tauS: 240 },
  wet: { rInfMOhm: 300, k: 0.1, tauS: 240 },
};

const resistanceAt = (condition, seconds) => {
  const { rInfMOhm, k, tauS } = CONDITIONS[condition];
  return rInfMOhm * (1 - k * Math.exp(-seconds / tauS));
};

export const runMegger = (condition) => {
  const r1 = resistanceAt(condition, 60);
  const r10 = resistanceAt(condition, 600);
  return { condition, r1, r10, pi: r10 / r1 };
};

const DEFAULT_LIMITS = { r1MinMOhm: 1000, piMin: 1.5 };

export const computeVerdict = (readings, limits = DEFAULT_LIMITS) => {
  if (!readings) return null;
  const r1Min = Number(limits?.r1MinMOhm ?? DEFAULT_LIMITS.r1MinMOhm);
  const piMin = Number(limits?.piMin ?? DEFAULT_LIMITS.piMin);
  if (readings.r1 < r1Min || readings.pi < piMin) return "FAIL";
  return readings.pi < 2.0 ? "MARGINAL" : "PASS";
};

export const computeScore = (stepsDone, stepsTotal, violations) =>
  Math.max(
    0,
    Math.round((stepsDone / Math.max(1, stepsTotal)) * 100) - (violations?.length ?? 0) * 10
  );

// ── Zod ──────────────────────────────────────────────────────────────────────
export const createSessionSchema = z.object({
  testId: z.string().uuid(),
  mode: z.enum(["DESKTOP", "VR", "AR"]),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  stepsDone: z.number().int().min(0).max(50),
  stepsTotal: z.number().int().min(1).max(50),
  violations: z
    .array(
      z.object({
        code: z.enum(["out_of_order", "interlock", "hazard_zone"]),
        step: z.number().int().min(0),
        target: z.string().max(80),
        at: z.number().int().min(0),
      })
    )
    .max(200)
    .default([]),
  readings: z
    .object({
      condition: z.enum(["dry", "damp", "wet"]),
      r1: z.number(),
      r10: z.number(),
      pi: z.number(),
    })
    .optional(),
});

// ── Controllers ──────────────────────────────────────────────────────────────

/** GET /api/xr/scenes/:equipmentId */
export async function getScene(req, res) {
  const scene = await prisma.arScene.findUnique({
    where: { equipmentId: req.params.equipmentId },
  });
  if (!scene) return res.status(404).json({ error: "No XR scene for this equipment" });
  res.json({
    scene: {
      equipmentId: scene.equipmentId,
      modelUrl: scene.modelUrl,
      version: scene.version,
      parts: scene.parts,
      zones: scene.zones,
    },
  });
}

/** GET /api/xr/tests/:testId/script */
export async function getScript(req, res) {
  const script = await prisma.arScript.findUnique({
    where: { testId: req.params.testId },
    include: {
      test: { select: { id: true, name: true, equipmentId: true } },
      steps: { orderBy: { stepNo: "asc" } },
    },
  });
  if (!script) return res.status(404).json({ error: "No XR script for this test" });
  res.json({
    test: script.test,
    limits: script.limits,
    steps: script.steps.map((s) => ({
      no: s.stepNo,
      type: s.type,
      text: s.text,
      target: s.target,
      action: s.action,
      value: s.value ?? undefined,
    })),
  });
}

/** POST /api/xr/sessions */
export async function createSession(req, res) {
  const body = createSessionSchema.parse(req.body);
  if (body.stepsDone > body.stepsTotal) {
    return res.status(400).json({ error: "stepsDone cannot exceed stepsTotal" });
  }

  const test = await prisma.test.findUnique({
    where: { id: body.testId },
    include: { arScript: true },
  });
  if (!test) return res.status(404).json({ error: "Test not found" });

  // Recompute readings and verdict from the condition + stored limits. The
  // client numbers are displayed only; never trust a client verdict.
  const readings = body.readings ? runMegger(body.readings.condition) : null;
  const limits = test.arScript?.limits ?? DEFAULT_LIMITS;
  const verdict = computeVerdict(readings, limits);
  const score = computeScore(body.stepsDone, body.stepsTotal, body.violations);

  const session = await prisma.trainingSession.create({
    data: {
      userId: req.user.id,
      testId: body.testId,
      mode: body.mode,
      startedAt: new Date(body.startedAt),
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
      stepsDone: body.stepsDone,
      stepsTotal: body.stepsTotal,
      violations: body.violations,
      readings: readings ?? undefined,
      verdict: verdict ?? undefined,
      score,
    },
  });

  res.status(201).json({ session });
}

/** GET /api/xr/sessions/me?limit=20 */
export async function mySessions(req, res) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const sessions = await prisma.trainingSession.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { test: { select: { id: true, name: true } } },
  });
  res.json({ sessions });
}

/** GET /api/admin/xr-stats  (ADMIN) */
export async function xrStats(_req, res) {
  const sessions = await prisma.trainingSession.findMany({
    include: { test: { select: { id: true, name: true } } },
  });

  const byTest = new Map();
  const byStep = new Map();

  for (const s of sessions) {
    const key = s.testId;
    const entry = byTest.get(key) ?? {
      testId: key,
      name: s.test?.name ?? "Unknown test",
      runs: 0,
      avgScore: 0,
      avgViolations: 0,
      totalScore: 0,
      totalViolations: 0,
    };
    entry.runs += 1;
    entry.totalScore += s.score;
    entry.totalViolations += Array.isArray(s.violations) ? s.violations.length : 0;
    byTest.set(key, entry);

    for (const v of Array.isArray(s.violations) ? s.violations : []) {
      const stepKey = `${s.testId}:${v.step}`;
      const step = byStep.get(stepKey) ?? {
        testId: s.testId,
        testName: s.test?.name ?? "Unknown test",
        step: v.step,
        code: v.code,
        count: 0,
      };
      step.count += 1;
      byStep.set(stepKey, step);
    }
  }

  const perTest = [...byTest.values()].map(({ totalScore, totalViolations, ...t }) => ({
    ...t,
    avgScore: t.runs ? Math.round(totalScore / t.runs) : 0,
    avgViolations: t.runs ? Math.round((totalViolations / t.runs) * 10) / 10 : 0,
  }));

  const violationsByStep = [...byStep.values()].sort((a, b) => b.count - a.count);
  res.json({ perTest, violationsByStep, totalRuns: sessions.length });
}
