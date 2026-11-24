import { describe, expect, it } from 'vitest'
import { apply, initialState, interlockReason, score } from '../engine'
import { ClearanceMonitor } from '../clearance'
import { CONDITIONS, correctTo20C, resistanceAt, runTest, verdict } from '../megger'
import type { XrStep } from '../types'

const steps: XrStep[] = [
  { no: 1, type: 'safety', text: 'Open isolator', target: 'isolator', action: 'operate', value: 'open' },
  { no: 2, type: 'safety', text: 'Close earth switch', target: 'earth_switch', action: 'operate', value: 'closed' },
  { no: 3, type: 'prep', text: 'Connect HV lead', target: 'hv_terminal', action: 'connect' },
  { no: 4, type: 'prep', text: 'Connect earth lead', target: 'earth_terminal', action: 'connect' },
  { no: 5, type: 'action', text: 'Run megger', target: 'megger', action: 'measure' },
  { no: 6, type: 'record', text: 'Record values', target: 'panel_record', action: 'inspect' },
]

const t0 = 1000
const runAll = (s = initialState(t0)) => {
  for (const st of steps) {
    s = apply(s, steps, { kind: st.action, target: st.target, value: st.value }, t0 + st.no * 1000).state
  }
  return s
}

describe('engine edge cases', () => {
  it('reverse interlock: isolator cannot close while the earth switch is closed', () => {
    const s = { ...initialState(t0), devices: { isolator: 'open', earth_switch: 'closed' } }
    const r = apply(s, steps, { kind: 'operate', target: 'isolator', value: 'closed' }, t0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('interlock')
    expect(r.state.devices.isolator).toBe('open')
  })

  it('interlockReason is null for non-operate actions and safe operations', () => {
    const devices = { isolator: 'open', earth_switch: 'open' }
    expect(interlockReason(devices, { kind: 'connect', target: 'hv_terminal' })).toBeNull()
    expect(interlockReason(devices, { kind: 'operate', target: 'earth_switch', value: 'closed' })).toBeNull()
    expect(interlockReason(devices, { kind: 'operate', target: 'isolator', value: 'closed' })).toBeNull()
  })

  it('an operate step with the wrong value is out of order', () => {
    const s = { ...initialState(t0), devices: { isolator: 'open', earth_switch: 'open' } }
    const r = apply(s, steps, { kind: 'operate', target: 'earth_switch', value: 'open' }, t0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('out_of_order')
  })

  it('multiple violations accumulate and the score floors at zero', () => {
    let s = initialState(t0)
    for (let i = 0; i < 12; i++) s = apply(s, steps, { kind: 'connect', target: 'wrong' }, t0).state
    expect(s.violations).toHaveLength(12)
    expect(score(s, steps.length)).toBe(0)
  })

  it('the finished run records its finish time and does not advance further', () => {
    const s = runAll()
    expect(s.finishedAt).toBeDefined()
    expect(s.current).toBe(steps.length)
    const r = apply(s, steps, { kind: 'inspect', target: 'panel_record' }, t0 + 99999)
    expect(r.ok).toBe(false)
    expect(r.state.finishedAt).toBe(s.finishedAt)
  })

  it('inspecting the current target advances the run', () => {
    const start = { ...initialState(t0), current: 5 }
    const r = apply(start, steps, { kind: 'inspect', target: 'panel_record' }, t0)
    expect(r.ok).toBe(true)
    expect(r.state.done).toEqual([6])
  })

  it('violation timestamps are measured from run start', () => {
    const r = apply(initialState(t0), steps, { kind: 'connect', target: 'x' }, t0 + 4321)
    expect(r.state.violations[0].at).toBe(4321)
  })
})

describe('megger numeric model', () => {
  it('matches the documented dry parameters', () => {
    const r = runTest('dry')
    expect(r.r1).toBeCloseTo(1885, 0)
    expect(r.r10).toBeCloseTo(4672, 0)
    expect(r.pi).toBeCloseTo(2.48, 2)
  })

  it('matches the documented damp and wet parameters', () => {
    expect(runTest('damp').pi).toBeCloseTo(1.67, 2)
    expect(runTest('wet').pi).toBeCloseTo(1.08, 2)
  })

  it('R(t) starts at Rinf * (1 - k) and approaches Rinf', () => {
    for (const c of Object.keys(CONDITIONS) as (keyof typeof CONDITIONS)[]) {
      const { rInfMOhm, k } = CONDITIONS[c]
      expect(resistanceAt(c, 0)).toBeCloseTo(rInfMOhm * (1 - k), 6)
      expect(resistanceAt(c, 100000)).toBeCloseTo(rInfMOhm, 3)
    }
  })

  it('temperature correction is identity at 20 degrees', () => {
    expect(correctTo20C(1234, 20)).toBeCloseTo(1234)
  })

  it('verdict is FAIL when either limit is missed', () => {
    const lim = { r1MinMOhm: 1000, piMin: 1.5 }
    expect(verdict({ r1: 900, r10: 3000, pi: 3 }, lim)).toBe('FAIL')
    expect(verdict({ r1: 4000, r10: 4000, pi: 1.2 }, lim)).toBe('FAIL')
    expect(verdict({ r1: 4000, r10: 6000, pi: 1.6 }, lim)).toBe('MARGINAL')
    expect(verdict({ r1: 4000, r10: 9000, pi: 2.1 }, lim)).toBe('PASS')
  })
})

describe('clearance monitor multi-zone', () => {
  it('reports each zone once and re-arms independently', () => {
    const m = new ClearanceMonitor([
      { id: 'hv', center: [0, 0, 0], radius: 1 },
      { id: 'lv', center: [5, 0, 0], radius: 1 },
    ])
    expect(m.update([0.5, 0, 0])).toEqual(['hv'])
    expect(m.update([4.5, 0, 0])).toEqual(['lv'])
    expect(m.update([0.5, 0, 0])).toEqual(['hv'])
    expect(m.update([0.5, 0, 0])).toEqual([])
  })

  it('never reports a position outside every zone', () => {
    const m = new ClearanceMonitor([{ id: 'a', center: [0, 0, 0], radius: 1 }])
    for (let x = 2; x < 10; x++) expect(m.update([x, 0, 0])).toEqual([])
  })
})
