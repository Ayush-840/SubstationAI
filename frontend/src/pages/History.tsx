import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ConversationDetail, ConversationSummary } from '../types'
import { SafetyBanner, ConfidenceBadge } from '../components/common'

const MODE_ICON: Record<string, string> = {
  qa: '💬',
  procedure: '📋',
  diagnosis: '🩺',
  learn: '🎓',
}

export default function History() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<ConversationDetail | null>(null)
  const [openLoading, setOpenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    setDeleteError(null)
    try {
      const res = await api.get<ConversationSummary[]>('/api/chat/conversations')
      setConversations(Array.isArray(res) ? res : [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load conversations.')
      setConversations([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const filtered = conversations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()),
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
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{open.title}</h2>
          <button className="btn-secondary" onClick={() => setOpen(null)}>Back</button>
        </div>
        <div className="space-y-3">
          {openLoading && (
            <div className="flex justify-center py-8">
              <span className="text-sm text-muted">Loading conversation…</span>
            </div>
          )}
          {!openLoading && open.messages.length === 0 && (
            <p className="text-sm text-muted">No messages in this conversation yet.</p>
          )}
          {!openLoading && open.messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="animate-fade-up flex justify-end">
                <div className="max-w-[80%] rounded-card bg-primary/10 px-4 py-2.5 text-sm">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="card space-y-2">
                {m.citations && m.citations.length > 0 && <SafetyBanner compact />}
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.intent && <span className="pill bg-primary/10 text-primary">{m.intent}</span>}
                  {m.confidence != null && <ConfidenceBadge value={m.confidence} />}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <p className="text-xs text-muted">
                    Sources: {m.citations.map((c, i) => `[${i + 1}] ${c.document} p.${c.page}`).join(' · ')}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
        <button className="btn-danger" disabled={openLoading} onClick={() => remove(open.id)}>
          {openLoading ? 'Deleting…' : 'Delete conversation'}
        </button>
        {deleteError && <p className="text-sm text-danger" role="alert">{deleteError}</p>}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">History</h2>
      <input className="input" placeholder="Search conversations…"
             value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted">Loading conversations…</p>}
        {!loading && openLoading && (
          <p className="text-sm text-muted">Opening conversation…</p>
        )}
        {!loading && error && <p className="text-sm text-danger" role="alert">{error}</p>}
        {!loading && detailError && (
          <p className="text-sm text-danger" role="alert">{detailError}</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted">
            {conversations.length === 0
              ? 'No conversations yet.'
              : 'No conversations match your search.'}
          </p>
        )}
        {filtered.map((c) => (
          <button key={c.id} className="card flex w-full items-center justify-between text-left hover:border-primary"
                  onClick={async () => {
                    setOpenLoading(true)
                    setDetailError(null)
                    setOpen(null)
                    try {
                      const detail = await api.get<ConversationDetail>(`/api/chat/conversations/${c.id}`)
                      setOpen(detail)
                    } catch (e: any) {
                      setDetailError(e.message ?? 'Failed to open conversation.')
                    } finally {
                      setOpenLoading(false)
                    }
                  }}>
            <span className="flex items-center gap-2">
              <span aria-hidden>{MODE_ICON[c.mode] ?? '💬'}</span>
              <span className="font-medium">{c.title ?? `Conversation ${c.id}`}</span>
            </span>
            <span className="text-xs text-muted">
              {c.message_count} messages · {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
