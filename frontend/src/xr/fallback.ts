import type { Limit } from './megger'
import type { XrStep } from './types'
import type { SceneData } from './api'

/**
 * Cached procedure used when the API is cold, offline or not seeded yet.
 * The same six steps the seed script writes, so the demo never depends on
 * a network round-trip. Saving requires a real test id, so that is disabled
 * while the fallback is active.
 */
export const FALLBACK_STEPS: XrStep[] = [
  { no: 1, type: 'safety', text: 'Open the isolator and confirm the transformer is de-energised.', target: 'isolator', action: 'operate', value: 'open' },
  { no: 2, type: 'safety', text: 'Close the earth switch. It will not close until the isolator is open.', target: 'earth_switch', action: 'operate', value: 'closed' },
  { no: 3, type: 'prep', text: 'Connect the megger HV lead to the HV bushing terminal.', target: 'hv_terminal', action: 'connect' },
  { no: 4, type: 'prep', text: 'Connect the earth lead to the tank earth stud.', target: 'earth_terminal', action: 'connect' },
  { no: 5, type: 'action', text: 'Run the 10-minute insulation test and capture R1 and R10.', target: 'megger', action: 'measure' },
  { no: 6, type: 'record', text: 'Record the temperature-corrected values and the verdict.', target: 'panel_record', action: 'inspect' },
]

export const DEFAULT_LIMITS: Limit = { r1MinMOhm: 1000, piMin: 1.5 }

export const FALLBACK_SCENE: SceneData = {
  modelUrl: '',
  parts: [
    { node: 'hv_terminal', label: 'HV bushing terminal', description: 'Top terminal of the high-voltage bushing. Connect the megger HV lead here.' },
    { node: 'earth_terminal', label: 'Tank earth stud', description: 'Earthing stud on the tank. Connect the megger earth lead here.' },
    { node: 'isolator', label: 'HV isolator', description: 'Disconnects the transformer from the live bus. Open it before any work.' },
    { node: 'earth_switch', label: 'Earth switch', description: 'Bonds the winding to earth. Close it only after the isolator is open.' },
    { node: 'megger', label: 'Insulation tester (megger)', description: 'Applies DC test voltage and records resistance at 60 s and 600 s.' },
    { node: 'panel_record', label: 'Record panel', description: 'Where corrected readings and the verdict are recorded.' },
  ],
  zones: [
    { id: 'hv_bushing', label: 'HV bushing live zone', center: [0.45, 2.0, 0], radius: 0.55 },
    { id: 'hv_lead', label: 'HV test lead zone', center: [1.1, 1.2, 0.4], radius: 0.45 },
  ],
}
