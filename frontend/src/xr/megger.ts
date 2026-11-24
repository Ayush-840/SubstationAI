/**
 * Insulation resistance absorption model: R(t) = Rinf * (1 - k * exp(-t / tau)).
 * Teaching sample, not a measurement. Parameters per insulation condition.
 */
export type Condition = 'dry' | 'damp' | 'wet'

export const CONDITIONS: Record<Condition, { rInfMOhm: number; k: number; tauS: number }> = {
  dry: { rInfMOhm: 5000, k: 0.8, tauS: 240 },
  damp: { rInfMOhm: 2500, k: 0.55, tauS: 240 },
  wet: { rInfMOhm: 300, k: 0.1, tauS: 240 },
}

export const resistanceAt = (c: Condition, tSeconds: number): number => {
  const { rInfMOhm, k, tauS } = CONDITIONS[c]
  return rInfMOhm * (1 - k * Math.exp(-tSeconds / tauS))
}

export interface MeggerResult {
  r1: number // MΩ at 60 s
  r10: number // MΩ at 600 s
  pi: number // polarisation index = R10 / R1 (IEEE 43 / IEEE C57.152)
}

export const runTest = (c: Condition): MeggerResult => {
  const r1 = resistanceAt(c, 60)
  const r10 = resistanceAt(c, 600)
  return { r1, r10, pi: r10 / r1 }
}

/** Rule of thumb: insulation resistance halves for every 10 °C rise. */
export const correctTo20C = (rMOhm: number, tempC: number) => rMOhm * Math.pow(2, (tempC - 20) / 10)

export interface Limit {
  r1MinMOhm: number
  piMin: number
}
export type Verdict = 'PASS' | 'MARGINAL' | 'FAIL'

/** Limits come from the catalog (CBIP IR >= 1000 MΩ, IEEE C57.152 PI >= 1.5, good >= 2.0). */
export function verdict(r: MeggerResult, lim: Limit): Verdict {
  if (r.r1 < lim.r1MinMOhm || r.pi < lim.piMin) return 'FAIL'
  return r.pi < 2.0 ? 'MARGINAL' : 'PASS'
}
