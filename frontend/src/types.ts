export interface User {
  id: number
  name: string
  email: string
  role: 'trainee' | 'engineer' | 'admin'
  /** ISO timestamp once the address is confirmed; null when pending. */
  email_verified_at?: string | null
  /** true once TOTP two-factor is enabled on the account. */
  totp_enabled?: boolean
}

export interface EquipmentClass {
  id: number
  name: string
  aliases: string[]
  description: string | null
}

export interface TestSummary {
  id: number
  name: string
  aliases: string[]
  category: string | null
  purpose: string | null
  summary: string | null
}

export interface TestListItem extends TestSummary {
  equipment_class: string
  standard_code?: string
  status?: 'draft' | 'verified' | 'archived'
}

export interface TestDetail {
  id: number
  name: string
  aliases: string[]
  category: string | null
  purpose: string | null
  summary: string | null
  equipment_class: string
  standard_code?: string
  status?: 'draft' | 'verified' | 'archived'
  steps: { step_no: number; type: string; text: string }[]
  equipment: { instrument: string; spec: string }[]
  limits: {
    parameter: string
    value: string
    min?: number
    max?: number
    unit: string
    condition: string
  }[]
  standards: { code: string; title: string; clause?: string }[]
  safety: { text: string; mandatory: boolean }[]
  troubleshooting?: { cause: string; action: string }[]
  verified_by?: string
  verified_at?: string
}

export interface Citation {
  document: string
  page: number | string
  section: string
}

export interface ChatResult {
  intent: string
  equipment: string | null
  test: string | null
  answer: string
  sections: Record<string, string>
  citations: Citation[]
  confidence: number
  source_type: string
  conversation_id: number
  message_id?: number
}

export interface ConversationSummary {
  id: number | string
  title?: string
  mode: string
  created_at?: string | Date
  message_count: number
}

export interface ConversationDetail {
  id: number | string
  title?: string
  mode: string
  created_at?: string | Date
  messages: {
    id: number | string
    role: 'user' | 'assistant'
    content: string
    intent: string | null
    citations: Citation[] | null
    confidence: number | null
    created_at?: string | Date
  }[]
}

export interface ProcedureRun {
  id: number
  test_id: number
  steps_state: Record<string, {
    step_no: number
    type: string
    text: string
    done: boolean
    flagged: boolean
    note: string
  }>
  notes: string | null
  started_at: string
  completed_at: string | null
}

export interface DiagnosisCause {
  cause: string
  likelihood: number
  recommended_checks: string[]
  sources: Citation[]
}

export interface FaultLog {
  id: string
  equipment_class: string
  symptoms: string[]
  readings: Record<string, unknown>
  diagnosis: string | null
  resolution: string | null
  logged_at: string | null
}

export interface DocumentInfo {
  id: number
  title: string
  filename: string
  doc_type: string | null
  equipment_class_id: number | null
  status: 'processing' | 'ready' | 'failed'
  page_count: number
  created_at: string
}

export interface QuizQuestionT {
  id: number
  question: string
  options: string[]
  correct_index: number
  explanation: string
}
