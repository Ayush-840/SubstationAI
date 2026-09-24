import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamSSE } from '../api/client'
import type { ChatResult, Citation, ConversationDetail, EquipmentClass } from '../types'
import { SafetyBanner, DangerBanner, ConfidenceBadge, CitationChip } from '../components/common'

const SUGGESTED = [
  'How do I perform an insulation resistance test on a power transformer?',
  'What is the acceptable contact resistance for a circuit breaker?',
  'Which instruments are needed for a tan delta test on a CT?',
  'Leakage current is high on a surge arrester. What should I do?',
  'Which standard covers DGA interpretation for transformers?',
]

interface Msg {
  role: 'user' | 'assistant'
  content: string
  result?: ChatResult
  isError?: boolean
}

export default function Chat() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [selected, setSelected] = useState<string>('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [statusLine, setStatusLine] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, number>>({})
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: message }])
    setStreaming(true)
    setStatusLine('Searching manuals…')

    const partial: Msg = { role: 'assistant', content: '' }
    setMessages((m) => [...m, partial])
    const idx = (arr: Msg[]) => arr.length - 1

    try {
      await streamSSE('/api/chat/stream',
        { message, equipment: selected || undefined, conversation_id: conversationId ?? undefined },
        (ev) => {
          if (ev.type === 'intent') setStatusLine('Writing answer…')
          if (ev.type === 'token') {
            setMessages((m) => {
              const copy = [...m]
              copy[idx(copy)] = { ...copy[idx(copy)], content: copy[idx(copy)].content + ev.data }
              return copy
            })
          }
          if (ev.type === 'done') {
            const result = ev.data as ChatResult
            setConversationId(result.conversation_id)
            setMessages((m) => {
              const copy = [...m]
              copy[idx(copy)] = { role: 'assistant', content: result.answer, result }
              return copy
            })
          }
          if (ev.type === 'error') {
            setMessages((m) => {
              const copy = [...m]
              copy[idx(copy)] = { role: 'assistant', content: ev.data.message, isError: true }
              return copy
            })
          }
        },
      )
    } catch (err: any) {
      setMessages((m) => {
        const copy = [...m]
        copy[idx(copy)] = { role: 'assistant', content: err.message ?? 'Request failed', isError: true }
        return copy
      })
    } finally {
      setStreaming(false)
      setStatusLine('')
    }
  }, [conversationId, selected, streaming])

  const giveFeedback = async (msg: Msg, rating: number) => {
    if (!msg.result?.message_id) return
    try {
      await api.post('/api/feedback', { message_id: msg.result.message_id, rating })
      setFeedbackGiven((f) => ({ ...f, [msg.result!.message_id!]: rating }))
    } catch { /* non-blocking */ }
  }

  const newChat = () => {
    setConversationId(null)
    setMessages([])
  }

  return (
    <div className="flex h-full flex-col">
      {/* Equipment filter chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-brdr px-4 py-3">
        <button className={`chip ${selected === '' ? 'chip-selected' : ''}`} onClick={() => setSelected('')}>
          All
        </button>
        {equipment.map((e) => (
          <button key={e.id} className={`chip ${selected === e.name ? 'chip-selected' : ''}`}
                  onClick={() => setSelected(e.name)}>
            {e.name}
          </button>
        ))}
        <div className="flex-1" />
        <button className="btn-secondary !min-h-[36px]" onClick={newChat}>+ New chat</button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl space-y-4 pt-8">
            <h2 className="text-xl font-semibold">Ask about substation maintenance</h2>
            <p className="text-sm text-muted">
              Procedures, acceptable limits, troubleshooting, standards, safety and test equipment —
              with citations from the knowledge base.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button key={s} className="card text-left text-sm hover:border-primary"
                        onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-card bg-primary/10 px-4 py-2.5 text-sm">{m.content}</div>
              </div>
            ) : (
              <AssistantMessage
                key={i} msg={m} streaming={streaming && i === messages.length - 1}
                statusLine={statusLine}
                feedback={m.result?.message_id ? feedbackGiven[m.result.message_id] : undefined}
                onFeedback={(r) => giveFeedback(m, r)}
              />
            ),
          )}
          {streaming && statusLine && (
            <p className="text-xs text-muted">{statusLine}</p>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-brdr p-3">
        <form
          className="mx-auto flex max-w-3xl items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); send(input) }}
        >
          <textarea
            className="input resize-none"
            rows={Math.min(4, Math.max(1, input.split('\n').length))}
            placeholder="Ask a maintenance question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            disabled={streaming}
          />
          <button className="btn-primary" disabled={streaming || !input.trim()} aria-label="Send">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

function AssistantMessage({ msg, streaming, statusLine, feedback, onFeedback }: {
  msg: Msg
  streaming: boolean
  statusLine: string
  feedback?: number
  onFeedback: (rating: number) => void
}) {
  const result = msg.result
  const isGuardrail = result?.source_type === 'guardrail'
  const isNotFound = result?.source_type === 'not_found'
  const isOOS = result?.source_type === 'out_of_scope'

  return (
    <div className="card space-y-3">
      {result && result.sections?.safety !== undefined && !isGuardrail && !isNotFound && !isOOS && (
        <SafetyBanner compact />
      )}
      {isGuardrail && <DangerBanner message={msg.content} />}
      {isNotFound && <DangerBanner message={msg.content} />}

      {!isGuardrail && !isNotFound && (
        <div className={`whitespace-pre-wrap text-sm ${streaming && !msg.content ? 'stream-caret' : ''}`}>
          {msg.content || (streaming ? '' : '…')}
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {result.intent && <span className="pill bg-primary/10 text-primary">{result.intent}</span>}
            {result.test && <span className="pill bg-accent/10 text-accent">{result.test}</span>}
            <ConfidenceBadge value={result.confidence ?? 0} />
            <span className="pill bg-brdr text-muted">{result.source_type}</span>
          </div>

          {result.citations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {result.citations.map((c: Citation, i: number) => (
                  <CitationChip key={i} n={i + 1} citation={c} />
                ))}
              </div>
            </div>
          )}

          {result.message_id && !isGuardrail && !isNotFound && (
            <div className="flex items-center gap-1 border-t border-brdr pt-2 text-sm">
              <button className={`btn-secondary !min-h-[32px] !px-2 ${feedback === 1 ? '!border-success text-success' : ''}`}
                      aria-label="Helpful" onClick={() => onFeedback(1)}>👍</button>
              <button className={`btn-secondary !min-h-[32px] !px-2 ${feedback === -1 ? '!border-danger text-danger' : ''}`}
                      aria-label="Not helpful" onClick={() => onFeedback(-1)}>👎</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export async function loadConversation(id: number): Promise<ConversationDetail> {
  return api.get<ConversationDetail>(`/api/chat/conversations/${id}`)
}
