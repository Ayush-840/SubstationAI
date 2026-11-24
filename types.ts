export type StepType = 'safety' | 'prep' | 'action' | 'record'
export type ActionKind = 'operate' | 'connect' | 'measure' | 'inspect'

/** One step of a 3D procedure: catalog text + which part the user must act on. */
export interface XrStep {
  no: number
  type: StepType
  text: string
  target: string // node name in the GLB, e.g. "part_earth_switch"
  action: ActionKind
  /** operate steps: the state the user must set, e.g. "closed" */
  value?: string
}

export interface UserAction {
  kind: ActionKind
  target: string
  value?: string
}

export type ViolationCode = 'out_of_order' | 'interlock' | 'hazard_zone'

export interface Violation {
  code: ViolationCode
  step: number
  target: string
  at: number // ms since run start
}

export interface RunState {
  current: number // index into steps; === steps.length when finished
  done: number[] // step numbers completed
  violations: Violation[]
  startedAt: number
  finishedAt?: number
  /** physical switch positions, the source of truth for interlocks */
  devices: Record<string, string>
}
