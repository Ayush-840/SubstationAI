import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ConversationDetail, ConversationSummary, ProcedureRun } from '../types'
import {
  SectionLabel,
  Button,
} from '../components/common'

const MODE_LABEL: Record<string, string> = {
  qa: 'Q&A',
  procedure: 'Procedure',
  diagnosis: 'Diagnosis',
  learn: 'Learn',
}

export default function History() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [runs, setRuns] = useState<ProcedureRun[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<ConversationDetail | null>(null)
  const [openRun, setOpenRun] = useState<ProcedureRun | null>(null)
  const [openLoading, setOpenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    setDeleteError(null)
    try {
      const [convRes, runRes] = await Promise.all([
        api.get<ConversationSummary[]>('/api/chat/conversations'),
        api.get<ProcedureRun[]>('/api/procedures/runs'),
      ])
      setConversations(Array.isArray(convRes) ? convRes : [])
      setRuns(Array.isArray(runRes) ? runRes : [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load history.')
      setConversations([])
      setRuns([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const filteredConvs = conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredRuns = runs.filter((r) =>
    r.test_id.toString().includes(search) || r.notes?.toLowerCase().includes(search.toLowerCase()),
  )

  const remove = async (id: number | string) => {
    if (!confirm('Delete this conversation?')) return
    setDeleteError(null)
    try {
      await api.del(`/api/chat/conversations/${id}`)
      setOpen(null)
      load()
    } catch (e: any) {
      setDeleteError(e.message ?? 'Delete failed — please retry.')
    }
  }

  if (open) {
    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            {open.title}
          </h2>
          <Button variant="secondary" onClick={() => setOpen(null)}>Back</Button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {openLoading && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading conversation…</div>
          )}
          {!openLoading && open.messages.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>No messages in this conversation yet.</p>
          )}
          {!openLoading && open.messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <div style={{ maxWidth: '80%', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '15px', lineHeight: 1.5, color: 'var(--ink)', background: 'var(--surface)' }}>{m.content}</div>
              </div>
            ) : (
              <div key={m.id} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '16px' }}>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', lineHeight: 1.55, color: 'var(--ink)' }}>{m.content}</div>
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
                  {m.intent && <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{m.intent}</span>}
                  {m.confidence != null && m.confidence < 0.5 && (
                    <span style={{ color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
                        <path d="M7 1.5L13 12.5H1L7 1.5Z" />
                        <path d="M7 5.5v3M7 10h.01" />
                      </svg>
                      Low confidence. Verify against the OEM manual.
                    </span>
                  )}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                    Sources: {m.citations.map((c, i) => `[${i + 1}] ${c.document} p.${c.page}`).join(' · ')}
                  </p>
                )}
              </div>
            ),
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="destructive" disabled={openLoading} onClick={() => remove(open.id)}>
            {openLoading ? 'Deleting…' : 'Delete conversation'}
          </Button>
        </div>
        {deleteError && <p style={{ marginTop: '8px', color: 'var(--danger)', fontSize: '14px' }} role="alert">{deleteError}</p>}
      </div>
    )
  }

  if (openRun) {
    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            Procedure Run #{openRun.id}
          </h2>
          <Button variant="secondary" onClick={() => setOpenRun(null)}>Back</Button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '16px', fontSize: '14px' }}>
              <span><strong>Test ID:</strong> {openRun.test_id}</span>
              <span><strong>Started:</strong> {openRun.started_at ? new Date(openRun.started_at).toLocaleString() : '—'}</span>
              <span><strong>Completed:</strong> {openRun.completed_at ? new Date(openRun.completed_at).toLocaleString() : 'In progress'}</span>
            </div>
            {openRun.notes && (
              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--rule)' }}>
                <strong style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</strong>
                <p style={{ margin: '8px 0 0', color: 'var(--ink)' }}>{openRun.notes}</p>
              </div>
            )}
          </div>

          <SectionLabel topRule={false}>Steps</SectionLabel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
                  {['Step', 'Type', 'Status', 'Note'].map((col) => (
                    <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(openRun.steps_state)
                  .sort((a, b) => a.step_no - b.step_no)
                  .map((s) => (
                    <tr key={s.step_no} style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--ink)' }}>{s.step_no}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{s.type}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: s.done ? 'var(--success)' : s.flagged ? 'var(--danger)' : 'var(--muted)',
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.done ? 'var(--success)' : s.flagged ? 'var(--danger)' : 'var(--muted)', flexShrink: 0 }} />
                          {s.done ? 'Done' : s.flagged ? 'Flagged' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--ink)' }}>{s.note || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {openRun.completed_at && (
              <Button variant="secondary" onClick={() => {
                api.download(`/api/procedures/${openRun.id}/export`, `procedure_run_${openRun.id}.pdf`)
                  .catch(e => alert(e.message))
              }}>
                Export PDF
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          History
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Past conversations and guided procedure runs.
        </p>
      </header>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="search"
          placeholder="Search conversations and runs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 14px',
            border: '1px solid var(--ink)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: '15px',
            fontFamily: 'var(--font-ui)',
          }}
        />
      </div>

      {/* Conversations table */}
      <div style={{ marginBottom: '32px' }}>
        <SectionLabel topRule={false}>Conversations</SectionLabel>
        {loading && <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading history…</p>}
        {!loading && error && <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}
        {!loading && filteredConvs.length === 0 && conversations.length === 0 && (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No conversations yet.</p>
        )}
        {!loading && filteredConvs.length === 0 && conversations.length > 0 && (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No conversations match your search.</p>
        )}
{!loading && filteredConvs.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
                  {['Date', 'Question / Procedure', 'Equipment', 'Outcome'].map((col) => (
                    <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredConvs.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--rule)', cursor: 'pointer' }}
                    onClick={async () => {
                      setOpenLoading(true)
                      setDetailError(null)
                      try {
                        const detail = await api.get<ConversationDetail>(`/api/chat/conversations/${c.id}`)
                        setOpen(detail)
                      } catch (e: any) {
                        setDetailError(e.message ?? 'Failed to open conversation.')
                      } finally {
                        setOpenLoading(false)
                      }
                    }}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '14px', color: 'var(--ink)', fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{MODE_LABEL[c.mode] ?? 'Q&A'}</span>
                        {c.title ?? `Conversation ${c.id}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>—</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>
                      {c.message_count} messages
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked layout */}
          <div className="block md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredConvs.map((c) => (
              <button
                key={c.id}
                onClick={async () => {
                  setOpenLoading(true)
                  setDetailError(null)
                  try {
                    const detail = await api.get<ConversationDetail>(`/api/chat/conversations/${c.id}`)
                    setOpen(detail)
                  } catch (e: any) {
                    setDetailError(e.message ?? 'Failed to open conversation.')
                  } finally {
                    setOpenLoading(false)
                  }
                }}
                style={{ textAlign: 'left', padding: '16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{c.title ?? `Conversation ${c.id}`}</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{MODE_LABEL[c.mode] ?? 'Q&A'}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {c.created_at ? new Date(c.created_at).toLocaleString() : ''} · {c.message_count} messages
                </div>
              </button>
            ))}
          </div>
        </>
        )}
      </div>

      {/* Procedure runs table */}
      <div>
        <SectionLabel topRule={false}>Procedure Runs</SectionLabel>
        {!loading && runs.length === 0 && (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No procedure runs yet.</p>
        )}
        {!loading && filteredRuns.length === 0 && runs.length > 0 && (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No runs match your search.</p>
        )}
{!loading && filteredRuns.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
                  {['Date', 'Test', 'Status', 'Done / Flagged', 'Outcome'].map((col) => (
                    <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => {
                  const done = Object.values(r.steps_state).filter(s => s.done).length
                  const flagged = Object.values(r.steps_state).filter(s => s.flagged).length
                  const total = Object.keys(r.steps_state).length
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--rule)', cursor: 'pointer' }}
                      onClick={() => setOpenRun(r)}>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '14px', color: 'var(--ink)', fontWeight: 500 }}>
                        Test #{r.test_id}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                        <span style={{
                          color: r.completed_at ? 'var(--success)' : 'var(--warn)',
                          fontWeight: 500,
                        }}>
                          {r.completed_at ? 'Completed' : 'In progress'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
                        {done} / {flagged} / {total}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>
                        {r.notes ? (r.notes.length > 50 ? r.notes.slice(0, 50) + '…' : r.notes) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredRuns.map((r) => {
              const done = Object.values(r.steps_state).filter(s => s.done).length
              const flagged = Object.values(r.steps_state).filter(s => s.flagged).length
              const total = Object.keys(r.steps_state).length
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenRun(r)}
                  style={{ textAlign: 'left', padding: '16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Test #{r.test_id}</span>
                    <span style={{ fontSize: '11px', color: r.completed_at ? 'var(--success)' : 'var(--warn)', fontWeight: 500 }}>
                      {r.completed_at ? 'Completed' : 'In progress'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {r.started_at ? new Date(r.started_at).toLocaleString() : ''} · {done}/{flagged}/{total} steps
                  </div>
                  {r.notes && <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--ink)' }}>{r.notes}</p>}
                </button>
              )
            })}
          </div>
        </>
        )}
      </div>
    </div>
  )
}