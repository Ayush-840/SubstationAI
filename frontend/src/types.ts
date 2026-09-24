export interface User {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
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
  id: number
  title: string
  mode: string
  created_at: string
  message_count: number
}

export interface ConversationDetail {
  id: number
  title: string
  mode: string
  created_at: string
  messages: {
    id: number
    role: 'user' | 'assistant'
    content: string
    intent: string | null
    citations: Citation[] | null
    confidence: number | null
    created_at: string
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
