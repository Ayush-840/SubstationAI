import { api } from '../api/client'
import type { Limit } from './megger'
import type { Violation, XrStep } from './types'
import { DEFAULT_LIMITS, FALLBACK_SCENE, FALLBACK_STEPS } from './fallback'

export interface ScenePart {
  node: string
  label: string
  description: string
}

export interface HazardZone {
  id: string
  label: string
  center: [number, number, number]
  radius: number
}

export interface SceneData {
  modelUrl: string
  parts: ScenePart[]
  zones: HazardZone[]
}

export type XrMode = 'DESKTOP' | 'VR' | 'AR'

export interface TrainerData {
  equipment: { id: string; name: string }
  test: { id: string; name: string }
  steps: XrStep[]
  limits: Limit
  scene: SceneData
  /** false => cached fallback; sessions cannot be saved without a real test id */
  fromApi: boolean
}

interface EquipmentResponse {
  equipment: { id: string; name: string; description?: string | null }[]
}
interface TestListResponse {
  tests: { id: string; name: string }[]
}
interface ScriptResponse {
  test: { id: string; name: string; equipmentId: string }
  limits: Limit
  steps: XrStep[]
}
interface SceneResponse {
  scene: { modelUrl: string; parts: ScenePart[]; zones: HazardZone[] }
}

const isIrTest = (name: string) => /insulation resistance|megger|megohm|IR test/i.test(name)
const isTransformer = (name: string) => /transformer/i.test(name)

/**
 * Resolve the demo equipment + IR test from the real Node API, then hydrate the
 * scene and typed steps. Any 404 falls back to the cached procedure; a network
 * failure is re-thrown so the page can say the API is unreachable.
 */
async function hydrate(
  equipment: { id: string; name: string },
  test: { id: string; name: string },
): Promise<TrainerData> {
  let steps = FALLBACK_STEPS
  let limits = DEFAULT_LIMITS
  let scene = FALLBACK_SCENE
  let fromApi = false

  try {
    const script = await api.get<ScriptResponse>(`/api/xr/tests/${encodeURIComponent(test.id)}/script`)
    if (script.steps?.length) {
      steps = script.steps
      limits = { ...DEFAULT_LIMITS, ...script.limits }
      fromApi = true
    }
  } catch {
    /* script not seeded yet: use the cached six steps */
  }

  try {
    const s = await api.get<SceneResponse>(`/api/xr/scenes/${encodeURIComponent(equipment.id)}`)
    if (s.scene?.parts?.length) scene = s.scene
  } catch {
    /* scene row not seeded yet */
  }

  return { equipment, test, steps, limits, scene, fromApi }
}

export async function loadTrainer(): Promise<TrainerData> {
  const eq = await api.get<EquipmentResponse>('/api/equipment')
  // Same priority order as prisma/seed-xr.js: Power Transformer, then Transformer.
  const priority = (name: string) =>
    /^power transformer$/i.test(name) ? 0 : /^transformer$/i.test(name) ? 1 : 2
  const candidates = eq.equipment.filter((e) => isTransformer(e.name)).sort((a, b) => priority(a.name) - priority(b.name))

  if (candidates.length === 0) throw new Error('No equipment in the catalog yet. Run the backend seed.')

  // Prefer a transformer that actually has an insulation-resistance test.
  let first: { equipment: { id: string; name: string }; test: { id: string; name: string } } | null = null
  for (const equipment of candidates) {
    const list = await api.get<TestListResponse>(`/api/tests?equipmentId=${encodeURIComponent(equipment.id)}`)
    const ir = list.tests.find((t) => isIrTest(t.name))
    if (ir) return hydrate(equipment, ir)
    if (!first && list.tests[0]) first = { equipment, test: list.tests[0] }
  }

  if (!first) {
    return {
      equipment: candidates[0],
      test: { id: '', name: 'Insulation Resistance (cached)' },
      steps: FALLBACK_STEPS,
      limits: DEFAULT_LIMITS,
      scene: FALLBACK_SCENE,
      fromApi: false,
    }
  }

  return hydrate(first.equipment, first.test)
}

export interface SaveSessionPayload {
  testId: string
  mode: XrMode
  startedAt: string
  finishedAt?: string
  stepsDone: number
  stepsTotal: number
  violations: Violation[]
  readings?: { condition: 'dry' | 'damp' | 'wet'; r1: number; r10: number; pi: number }
}

export interface TrainingSessionRow {
  id: string
  mode: XrMode
  startedAt: string
  finishedAt: string | null
  stepsDone: number
  stepsTotal: number
  violations: Violation[]
  readings: { condition: string; r1: number; r10: number; pi: number } | null
  verdict: 'PASS' | 'MARGINAL' | 'FAIL' | null
  score: number
  createdAt: string
  test?: { id: string; name: string }
}

export interface SavedSession {
  session: TrainingSessionRow
}

export const saveSession = (payload: SaveSessionPayload) =>
  api.post<SavedSession>('/api/xr/sessions', payload)

export const fetchMySessions = () =>
  api.get<{ sessions: TrainingSessionRow[] }>('/api/xr/sessions/me?limit=10')

export interface XrStats {
  perTest: { testId: string; name: string; runs: number; avgScore: number; avgViolations: number }[]
  violationsByStep: { testId: string; testName: string; step: number; code: string; count: number }[]
  totalRuns: number
}

export const fetchXrStats = () => api.get<XrStats>('/api/admin/xr-stats')
