import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamSSE } from '../api/client'
import type { ChatResult, Citation, ConversationDetail, EquipmentClass } from '../types'
import {
  SectionLabel,
  SafetyBlock,
  LimitsTable,
  Citation,
  SourcesList,
  type CitationItem,
  VerdictStamp,
  StatusText,
  EquipmentFilter,
  type EquipmentCategory,
  Dialog,
  Toast,
  EmptyState,
  Placeholder,
  Wordmark,
  TestSheet,
} from '../components/common'
import { useSources } from '../App'

const SUGGESTED = [
  { query: 'IR value low on 132 kV CT after rain, what next?', intent: 'Troubleshooting' },
  { query: 'Acceptable contact resistance, 220 kV SF6 breaker', intent: 'Limits' },
  { query: 'Instruments needed for tan delta on a CVT', intent: 'Equipment' },
  { query: 'How do I perform an insulation resistance test on a power transformer?', intent: 'Procedure' },
  { query: 'Which standard covers DGA interpretation for transformers?', intent: 'Standards' },
]

interface Msg {
  role: 'user' | 'assistant'
  content: string
  result?: ChatResult
  isError?: boolean
}

export default function Chat() {
  const { openSource } = useSources()
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [selected, setSelected] = useState<EquipmentCategory>('all')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [statusLine, setStatusLine] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, number>>({})
  const [feedbackBusy, setFeedbackBusy] = useState<Record<number, boolean>>({})
  const [feedbackError, setFeedbackError] = useState<Record<number, string>>({})
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
    const id = msg.result?.message_id
    if (!id || feedbackBusy[id]) return
    setFeedbackBusy((b) => ({ ...b, [id]: true }))
    setFeedbackError((e) => ({ ...e, [id]: '' }))
    try {
      await api.post(`/api/messages/${id}/feedback`, { rating })
      setFeedbackGiven((f) => ({ ...f, [id]: rating }))
    } catch (err: any) {
      setFeedbackError((e) => ({
        ...e,
        [id]: err.message ?? 'Your vote was not saved.',
      }))
    } finally {
      setFeedbackBusy((b) => ({ ...b, [id]: false }))
    }
  }

  const newChat = () => {
    setConversationId(null)
    setMessages([])
  }

  return (
    <div className="flex h-full flex-col" style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
      {/* Equipment filter segmented row */}
      <div style={{ borderBottom: '1px solid var(--rule)', padding: '12px 0 16px' }}>
        <EquipmentFilter selected={selected} onChange={(c) => setSelected(c)} />
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div style={{ maxWidth: '760px', margin: '0', paddingTop: '48px' }}>
            <h1 style={{
              margin: '0 0 16px',
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.2,
            }}>
              What do you need to check?
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {SUGGESTED.map((s) => (
                <button
                  key={s.query}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '16px',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '15px',
                    lineHeight: 1.5,
                    color: 'var(--ink)',
                    fontFamily: 'var(--font-ui)',
                    transition: 'border-color 100ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule)' }}
                  onClick={() => send(s.query)}
                >
                  <span>{s.query}</span>
                  <span style={{
                    fontSize: '13px',
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-ui)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {s.intent}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ maxWidth: '760px', margin: '0' }}>
          {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <div style={{
              maxWidth: '80%',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              fontSize: '15px',
              lineHeight: 1.5,
              color: 'var(--ink)',
              background: 'var(--surface)',
            }}>
              {m.content}
            </div>
          </div>
        ) : (
          <TestSheet
            key={i}
            intent={m.result?.intent || ''}
            equipment={m.result?.equipment || null}
            test={m.result?.test || null}
            sections={m.result?.sections || {}}
            citations={(m.result?.citations || []) as CitationItem[]}
            confidence={m.result?.confidence ?? 0}
            sourceType={m.result?.source_type || 'rag'}
            messageId={m.result?.message_id}
            feedbackGiven={m.result?.message_id ? feedbackGiven[m.result.message_id] : undefined}
            feedbackBusy={m.result?.message_id ? !!feedbackBusy[m.result.message_id] : false}
            feedbackError={m.result?.message_id ? feedbackError[m.result.message_id] : undefined}
            onFeedback={(r) => m.result?.message_id && giveFeedback(m, r)}
            streaming={streaming && i === messages.length - 1}
          />
        ),
      )}
          {streaming && statusLine && (
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{statusLine}</p>
          )}
        </div>
      </div>

      {/* Composer fixed at bottom */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        borderTop: '1px solid var(--rule)',
        background: 'var(--bg)',
        padding: '12px 16px',
        zIndex: 10,
      }}>
        <form
          style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}
          onSubmit={(e) => { e.preventDefault(); send(input) }}
        >
          <textarea
            className="input resize-none"
            style={{ flex: 1, minWidth: 0 }}
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

export async function loadConversation(id: number): Promise<ConversationDetail> {
  return api.get<ConversationDetail>(`/api/chat/conversations/${id}`)
}
