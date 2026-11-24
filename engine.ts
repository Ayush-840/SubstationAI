import type { RunState, UserAction, Violation, ViolationCode, XrStep } from './types'

export type Outcome =
  | { ok: true; state: RunState }
  | { ok: false; state: RunState; code: ViolationCode; reason: string }

export const initialState = (now: number, devices: Record<string, string> = {}): RunState => ({
  current: 0,
  done: [],
  violations: [],
  startedAt: now,
  devices: { isolator: 'closed', earth_switch: 'open', ...devices },
})

/** Interlock rules that depend on physical state, not on step order. */
export function interlockReason(devices: Record<string, string>, a: UserAction): string | null {
  if (a.kind !== 'operate') return null
  if (a.target === 'earth_switch' && a.value === 'closed' && devices.isolator !== 'open')
    return 'Open the isolator before closing the earth switch.'
  if (a.target === 'isolator' && a.value === 'closed' && devices.earth_switch === 'closed')
    return 'Open the earth switch before closing the isolator.'
  return null
}

const matches = (s: XrStep, a: UserAction) =>
  s.action === a.kind && s.target === a.target && (s.value === undefined || s.value === a.value)

/**
 * Pure reducer. Same input => same output, so it is unit-testable without WebGL.
 * - inspect on a non-target part is always allowed (looking is not an error)
 * - an interlock breach is rejected and recorded, and the device does not move
 * - a valid action for a later step, or a wrong target, is an out_of_order violation
 */
export function apply(state: RunState, steps: XrStep[], a: UserAction, now: number): Outcome {
  if (state.finishedAt !== undefined) return { ok: false, state, code: 'out_of_order', reason: 'Run already finished.' }
  const step = steps[state.current]
  const t = now - state.startedAt

  const reject = (code: ViolationCode, reason: string): Outcome => {
    const v: Violation = { code, step: step.no, target: a.target, at: t }
    return { ok: false, state: { ...state, violations: [...state.violations, v] }, code, reason }
  }

  const locked = interlockReason(state.devices, a)
  if (locked) return reject('interlock', locked)

  if (a.kind === 'inspect' && !matches(step, a)) return { ok: true, state }

  if (!matches(step, a)) return reject('out_of_order', `Step ${step.no} comes first: ${step.text}`)

  const devices = a.kind === 'operate' && a.value ? { ...state.devices, [a.target]: a.value } : state.devices
  const current = state.current + 1
  return {
    ok: true,
    state: {
      ...state,
      devices,
      current,
      done: [...state.done, step.no],
      finishedAt: current === steps.length ? now : undefined,
    },
  }
}

export const score = (state: RunState, total: number) =>
  Math.max(0, Math.round((state.done.length / total) * 100) - state.violations.length * 10)
