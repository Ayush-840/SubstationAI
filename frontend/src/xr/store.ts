import { create } from 'zustand'
import { apply, initialState as initRun, score as engineScore } from './engine'
import { runTest, verdict as judge, type Condition, type Limit, type MeggerResult, type Verdict } from './megger'
import type { RunState, UserAction, Violation, XrStep } from './types'
import {
  fetchMySessions,
  loadTrainer,
  saveSession,
  type HazardZone,
  type SceneData,
  type ScenePart,
  type TrainingSessionRow,
  type XrMode,
} from './api'
import { DEFAULT_LIMITS, FALLBACK_SCENE, FALLBACK_STEPS } from './fallback'

export type { SceneData, ScenePart, HazardZone, XrMode }
export type { Condition, Limit, MeggerResult, Verdict }

type Tone = 'ok' | 'error' | 'info'

interface Message {
  tone: Tone
  text: string
}

interface TrainerStore {
  loading: boolean
  saving: boolean
  error: string | null
  message: Message | null
  fromApi: boolean

  equipmentId: string
  equipmentName: string
  testId: string
  testName: string
  steps: XrStep[]
  limits: Limit
  scene: SceneData

  run: RunState
  condition: Condition
  readings: MeggerResult | null
  resultVerdict: Verdict | null
  mode: XrMode
  savedId: string | null
  sessions: TrainingSessionRow[]

  load: () => Promise<void>
  reset: () => void
  dispatchAction: (a: UserAction) => void
  completeCurrentStep: () => void
  measure: () => void
  hazard: (zoneId: string) => void
  setCondition: (c: Condition) => void
  setMode: (m: XrMode) => void
  save: () => Promise<void>
  loadHistory: () => Promise<void>
  clearMessage: () => void
}

const freshRun = () => initRun(Date.now())

const initialRun = freshRun()

export const useTrainer = create<TrainerStore>((set, get) => ({
  loading: true,
  saving: false,
  error: null,
  message: null,
  fromApi: false,

  equipmentId: '',
  equipmentName: 'Power Transformer',
  testId: '',
  testName: 'Insulation Resistance (cached)',
  steps: FALLBACK_STEPS,
  limits: DEFAULT_LIMITS,
  scene: FALLBACK_SCENE,

  run: initialRun,
  condition: 'dry',
  readings: null,
  resultVerdict: null,
  mode: 'DESKTOP',
  savedId: null,
  sessions: [],

  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await loadTrainer()
      set({
        loading: false,
        fromApi: data.fromApi,
        equipmentId: data.equipment.id,
        equipmentName: data.equipment.name,
        testId: data.test.id,
        testName: data.test.name,
        steps: data.steps,
        limits: data.limits,
        scene: data.scene,
        run: freshRun(),
        readings: null,
        resultVerdict: null,
        savedId: null,
        message: data.fromApi
          ? null
          : { tone: 'info', text: 'Using the cached procedure — run the XR seed to load steps from the database.' },
      })
    } catch (e: any) {
      // Offline / cold start: keep the trainer demonstrable with cached steps.
      set({
        loading: false,
        error: null,
        fromApi: false,
        steps: FALLBACK_STEPS,
        limits: DEFAULT_LIMITS,
        scene: FALLBACK_SCENE,
        testId: '',
        run: freshRun(),
        readings: null,
        resultVerdict: null,
        savedId: null,
        message: {
          tone: 'info',
          text: `${e?.message ?? 'API unavailable'} — using the cached procedure.`,
        },
      })
    }
  },

  reset: () =>
    set({
      run: freshRun(),
      readings: null,
      resultVerdict: null,
      savedId: null,
      saving: false,
      message: null,
    }),

  dispatchAction: (a) => {
    const { run, steps, limits } = get()
    const outcome = apply(run, steps, a, Date.now())

    if (!outcome.ok) {
      set({ run: outcome.state, message: { tone: 'error', text: outcome.reason } })
      return
    }

    let readings = get().readings
    let resultVerdict = get().resultVerdict
    let message: Message = { tone: 'ok', text: `Step ${steps[run.current]?.no ?? ''} accepted.` }

    if (a.kind === 'measure') {
      readings = runTest(get().condition)
      resultVerdict = judge(readings, limits)
      message = { tone: 'ok', text: `Test complete — PI ${readings.pi.toFixed(2)}.` }
    }

    set({ run: outcome.state, readings, resultVerdict, message })

    if (outcome.state.finishedAt !== undefined) {
      void get().save()
    }
  },

  completeCurrentStep: () => {
    const { run, steps } = get()
    if (run.finishedAt !== undefined) return
    const step = steps[run.current]
    if (!step) return
    get().dispatchAction({
      kind: step.action,
      target: step.target,
      value: step.value,
    })
  },

  measure: () => get().dispatchAction({ kind: 'measure', target: 'megger' }),

  hazard: (zoneId) => {
    const { run } = get()
    if (run.finishedAt !== undefined) return
    const v: Violation = {
      code: 'hazard_zone',
      step: get().steps[run.current]?.no ?? 0,
      target: zoneId,
      at: Date.now() - run.startedAt,
    }
    set({
      run: { ...run, violations: [...run.violations, v] },
      message: { tone: 'error', text: `Live zone entered: ${zoneId}. Clear it immediately.` },
    })
  },

  setCondition: (c) => set({ condition: c }),
  setMode: (m) => set({ mode: m }),

  save: async () => {
    const { testId, mode, run, steps, readings, savedId, saving } = get()
    if (saving || savedId) return
    if (!testId) {
      set({ message: { tone: 'info', text: 'No database test id (cached run) — this session is not saved.' } })
      return
    }
    set({ saving: true })
    try {
      const res = await saveSession({
        testId,
        mode,
        startedAt: new Date(run.startedAt).toISOString(),
        finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : undefined,
        stepsDone: run.done.length,
        stepsTotal: steps.length,
        violations: run.violations,
        readings: readings
          ? { condition: get().condition, r1: readings.r1, r10: readings.r10, pi: readings.pi }
          : undefined,
      })
      set({
        saving: false,
        savedId: res.session.id,
        message: { tone: 'ok', text: `Run saved (score ${res.session.score}).` },
      })
      void get().loadHistory()
    } catch (e: any) {
      set({ saving: false, message: { tone: 'error', text: e?.message ?? 'Could not save the run.' } })
    }
  },

  loadHistory: async () => {
    try {
      const res = await fetchMySessions()
      set({ sessions: res.sessions ?? [] })
    } catch {
      /* history is optional */
    }
  },

  clearMessage: () => set({ message: null }),
}))

export const selectScore = (s: TrainerStore) =>
  engineScore(s.run, Math.max(1, s.steps.length))
