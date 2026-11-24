import { describe, expect, it } from 'vitest'
import { apply, initialState, score } from '../engine'
import { ClearanceMonitor } from '../clearance'
import { CONDITIONS, correctTo20C, resistanceAt, runTest, verdict } from '../megger'
import type { XrStep } from '../types'

const steps: XrStep[] = [
  { no: 1, type: 'safety', text: 'Open isolator', target: 'isolator', action: 'operate', value: 'open' },
  { no: 2, type: 'safety', text: 'Close earth switch', target: 'earth_switch', action: 'operate', value: 'closed' },
  { no: 3, type: 'prep', text: 'Connect HV lead', target: 'hv_terminal', action: 'connect' },
  { no: 4, type: 'action', text: 'Run megger', target: 'megger', action: 'measure' },
]
const t0 = 1000

describe('procedure engine', () => {
  it('accepts steps in order and finishes', () => {
    let s = initialState(t0)
    for (const [i, st] of steps.entries()) {
      const r = apply(s, steps, { kind: st.action, target: st.target, value: st.value }, t0 + i)
      expect(r.ok).toBe(true)
      s = r.state
    }
    expect(s.finishedAt).toBeDefined()
    expect(s.violations).toHaveLength(0)
    expect(score(s, steps.length)).toBe(100)
  })

  it('rejects an out-of-order action and records one violation', () => {
    const r = apply(initialState(t0), steps, { kind: 'connect', target: 'hv_terminal' }, t0 + 5)
    expect(r.ok).toBe(false)
    expect(r.state.violations).toEqual([{ code: 'out_of_order', step: 1, target: 'hv_terminal', at: 5 }])
    expect(r.state.current).toBe(0)
  })

  it('interlock: earth switch cannot close while the isolator is closed, and the device does not move', () => {
    const r = apply(initialState(t0), steps, { kind: 'operate', target: 'earth_switch', value: 'closed' }, t0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('interlock')
    expect(r.state.devices.earth_switch).toBe('open')
  })

  it('inspecting an unrelated part is not an error', () => {
    const r = apply(initialState(t0), steps, { kind: 'inspect', target: 'buchholz' }, t0)
    expect(r.ok).toBe(true)
    expect(r.state.violations).toHaveLength(0)
  })

  it('violations lower the score', () => {
    let s = initialState(t0)
    s = apply(s, steps, { kind: 'connect', target: 'x' }, t0).state
    for (const st of steps) s = apply(s, steps, { kind: st.action, target: st.target, value: st.value }, t0).state
    expect(score(s, steps.length)).toBe(90)
  })

  it('a finished run accepts nothing more', () => {
    let s = initialState(t0)
    for (const st of steps) s = apply(s, steps, { kind: st.action, target: st.target, value: st.value }, t0).state
    expect(apply(s, steps, { kind: 'inspect', target: 'a' }, t0).ok).toBe(false)
  })
})

describe('megger model', () => {
  it('resistance rises monotonically with time', () => {
    for (const c of Object.keys(CONDITIONS) as (keyof typeof CONDITIONS)[]) {
      let prev = 0
      for (let t = 0; t <= 600; t += 30) {
        const r = resistanceAt(c, t)
        expect(r).toBeGreaterThanOrEqual(prev)
        prev = r
      }
    }
  })
  it('PI = R10 / R1 and separates dry from wet', () => {
    const dry = runTest('dry')
    const wet = runTest('wet')
    expect(dry.pi).toBeCloseTo(dry.r10 / dry.r1, 10)
    expect(dry.pi).toBeGreaterThan(2)
    expect(wet.pi).toBeLessThan(1.5)
  })
  it('verdict follows the catalog limits', () => {
    const lim = { r1MinMOhm: 1000, piMin: 1.5 }
    expect(verdict(runTest('dry'), lim)).toBe('PASS')
    expect(verdict(runTest('damp'), lim)).toBe('MARGINAL')
    expect(verdict(runTest('wet'), lim)).toBe('FAIL')
  })
  it('temperature correction halves per 10 °C', () => {
    expect(correctTo20C(1000, 30)).toBeCloseTo(2000)
    expect(correctTo20C(1000, 10)).toBeCloseTo(500)
  })
})

describe('clearance monitor', () => {
  it('fires once per entry, not per frame, and re-arms after exit', () => {
    const m = new ClearanceMonitor([{ id: 'hv', center: [0, 0, 0], radius: 1 }])
    expect(m.update([3, 0, 0])).toEqual([])
    expect(m.update([0.5, 0, 0])).toEqual(['hv'])
    expect(m.update([0.4, 0, 0])).toEqual([])
    expect(m.update([3, 0, 0])).toEqual([])
    expect(m.update([0.5, 0, 0])).toEqual(['hv'])
  })
})
