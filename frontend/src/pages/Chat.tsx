import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamSSE } from '../api/client'
import type { ChatResult, ConversationDetail, EquipmentClass } from '../types'
import {
  EquipmentFilter,
  type EquipmentCategory,
  TestSheet,
  type CitationItem,
} from '../components/common'
import { useSources } from '../App'
import { copy } from '../copy'

const SUGGESTED = copy.pages.ask.suggestedQueries

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
  }, [messages, streaming])

  const send = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: message }])
    setStreaming(true)
    setStatusLine(copy.pages.ask.streamingStatus.searching)

    const partial: Msg = { role: 'assistant', content: '' }
    setMessages((m) => [...m, partial])
    const idx = (arr: Msg[]) => arr.length - 1

    try {
      await streamSSE('/api/chat/stream',
        { message, equipment: selected === 'all' ? undefined : selected, conversation_id: conversationId ?? undefined },
        (ev) => {
          if (ev.type === 'intent') setStatusLine(copy.pages.ask.streamingStatus.reading)
          if (ev.type === 'token') {
            setMessages((m) => {
              const copyArr = [...m]
              copyArr[idx(copyArr)] = { ...copyArr[idx(copyArr)], content: copyArr[idx(copyArr)].content + ev.data }
              return copyArr
            })
          }
          if (ev.type === 'done') {
            const result = ev.data as ChatResult
            setConversationId(result.conversation_id)
            setMessages((m) => {
              const copyArr = [...m]
              copyArr[idx(copyArr)] = { role: 'assistant', content: result.answer, result }
              return copyArr
            })
          }
          if (ev.type === 'error') {
            setMessages((m) => {
              const copyArr = [...m]
              copyArr[idx(copyArr)] = { role: 'assistant', content: ev.data.message, isError: true }
              return copyArr
            })
          }
        },
      )
    } catch (err: any) {
      setMessages((m) => {
        const copyArr = [...m]
        copyArr[idx(copyArr)] = { role: 'assistant', content: err.message ?? 'Request failed', isError: true }
        return copyArr
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
        [id]: err.message ?? 'Your feedback was not saved.',
      }))
    } finally {
      setFeedbackBusy((b) => ({ ...b, [id]: false }))
    }
  }

  const newChat = () => {
    setConversationId(null)
    setMessages([])
    setInput('')
    setStatusLine('')
  }

  return (
    <div className="flex h-full flex-col" style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
      {/* Top bar with equipment filter & New Chat button */}
      <div style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>
            Equipment Filter
          </span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={newChat}
              disabled={streaming}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                padding: '2px 4px',
              }}
            >
              + New question
            </button>
          )}
        </div>
        <EquipmentFilter selected={selected} onChange={(c) => setSelected(c)} />
      </div>

      {/* Messages Scroll Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-1 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div style={{ maxWidth: '760px', margin: '0', paddingTop: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                SubstationIQ Engineering Assistant
              </div>
              <h1 style={{
                margin: '0 0 8px',
                fontSize: '26px',
                fontWeight: 600,
                color: 'var(--ink)',
                fontFamily: 'var(--font-display)',
                lineHeight: 1.25,
              }}>
                {copy.pages.ask.emptyHeading}
              </h1>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--muted)', maxWidth: '58ch' }}>
                {copy.pages.ask.emptyDescription}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
              {SUGGESTED.map((s) => (
                <button
                  key={s.query}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '14px 16px',
                    border: '1px solid var(--rule)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--ink)',
                    fontFamily: 'var(--font-ui)',
                    transition: 'border-color 100ms, background-color 100ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.background = 'var(--surface-sunken)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--rule)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                  onClick={() => send(s.query)}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1.5, fontWeight: 500 }}>{s.query}</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-data)',
                  }}>
                    {s.intent}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div style={{ maxWidth: '760px', margin: '0' }}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{
                  maxWidth: '85%',
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  fontSize: '15px',
                  lineHeight: 1.5,
                  color: 'var(--ink)',
                  background: 'var(--surface-sunken)',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '4px' }}>
                    You
                  </div>
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} style={{ marginBottom: '20px' }}>
                <TestSheet
                  intent={m.result?.intent || ''}
                  equipment={m.result?.equipment || null}
                  test={m.result?.test || null}
                  sections={m.result?.sections || {}}
                  citations={(m.result?.citations || []) as CitationItem[]}
                  confidence={m.result?.confidence ?? 1}
                  sourceType={m.result?.source_type || 'rag'}
                  messageId={m.result?.message_id}
                  feedbackGiven={m.result?.message_id ? feedbackGiven[m.result.message_id] : undefined}
                  feedbackBusy={m.result?.message_id ? !!feedbackBusy[m.result.message_id] : false}
                  feedbackError={m.result?.message_id ? feedbackError[m.result.message_id] : undefined}
                  onFeedback={(r) => m.result?.message_id && giveFeedback(m, r)}
                  streaming={streaming && i === messages.length - 1}
                  onSelectSource={openSource}
                  answer={m.content || m.result?.answer || ''}
                  isError={m.isError}
                />
              </div>
            ),
          )}

          {streaming && statusLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '13px', color: 'var(--muted)' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', animation: 'token-fade 600ms infinite alternate' }} />
              <span>{statusLine}</span>
            </div>
          )}
        </div>
      </div>

      {/* Composer fixed at bottom */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        borderTop: '1px solid var(--rule)',
        background: 'var(--bg)',
        padding: '12px 0 16px',
        zIndex: 10,
      }}>
        <form
          style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}
          onSubmit={(e) => { e.preventDefault(); send(input) }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <textarea
              className="input resize-none"
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '10px 12px',
                lineHeight: 1.45,
              }}
              rows={Math.min(5, Math.max(1, input.split('\n').length))}
              placeholder={copy.pages.ask.composerPlaceholder}
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
            <span style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '2px' }}>
              Press Enter to send · Shift+Enter for new line
            </span>
          </div>
          <button
            className="btn-primary"
            style={{ minHeight: '48px', padding: '0 20px', alignSelf: 'flex-start' }}
            disabled={streaming || !input.trim()}
            aria-label="Send"
          >
            {copy.pages.ask.composerSend}
          </button>
        </form>
      </div>
    </div>
  )
}

export async function loadConversation(id: number): Promise<ConversationDetail> {
  return api.get<ConversationDetail>(`/api/chat/conversations/${id}`)
}
