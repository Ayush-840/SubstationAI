import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DocumentInfo, EquipmentClass } from '../types'
import { StatusPill } from '../components/common'

interface Analytics {
  total_queries: number
  avg_rating: number
  unanswered_rate: number
  top_questions: { question: string; count: number }[]
  unanswered_queries: { query: string; intent: string | null; score: number | null; created_at: string }[]
}

export default function Admin() {
  const [tab, setTab] = useState<'documents' | 'analytics'>('documents')
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Admin</h2>
      <div className="flex gap-2">
        <button className={`chip ${tab === 'documents' ? 'chip-selected' : ''}`} onClick={() => setTab('documents')}>Documents</button>
        <button className={`chip ${tab === 'analytics' ? 'chip-selected' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
      </div>
      {tab === 'documents' ? <Documents /> : <AnalyticsView />}
    </div>
  )
}

function Documents() {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('manual')
  const [equipId, setEquipId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.get<DocumentInfo[]>('/api/admin/documents').then(setDocs).catch((e) => setError(e.message))
  useEffect(() => {
    load()
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Choose a file first'); return }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('title', title || file.name)
      form.append('doc_type', docType)
      if (equipId) form.append('equipment_class_id', equipId)
      form.append('file', file)
      await api.postForm('/api/admin/documents', form)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this document and its index entries?')) return
    await api.del(`/api/admin/documents/${id}`)
    load()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="card space-y-3">
        <h3 className="font-medium">Upload document (PDF, DOCX, TXT · max 25 MB)</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className="input sm:col-span-2" placeholder="Title" value={title}
                 onChange={(e) => setTitle(e.target.value)} required />
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="manual">OEM manual</option>
            <option value="sop">SOP</option>
            <option value="standard">Standard</option>
            <option value="guideline">Guideline</option>
          </select>
          <select className="input sm:col-span-2" value={equipId} onChange={(e) => setEquipId(e.target.value)}>
            <option value="">Equipment class (optional)</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input className="input" type="file" accept=".pdf,.docx,.txt" ref={fileRef} required />
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brdr text-left text-muted">
              <th className="p-3">Title</th>
              <th className="p-3">Type</th>
              <th className="p-3">Pages</th>
              <th className="p-3">Status</th>
              <th className="p-3">Uploaded</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-brdr last:border-0">
                <td className="p-3 font-medium">{d.title}</td>
                <td className="p-3">{d.doc_type ?? '—'}</td>
                <td className="p-3">{d.page_count}</td>
                <td className="p-3"><StatusPill status={d.status} /></td>
                <td className="p-3 text-muted">{new Date(d.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <button className="pill bg-danger/10 text-danger" onClick={() => remove(d.id)}>delete</button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td className="p-3 text-muted" colSpan={6}>No documents uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Analytics>('/api/admin/analytics').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="text-sm text-danger" role="alert">{error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-2xl font-semibold">{data.total_queries}</p>
          <p className="text-sm text-muted">Total queries</p>
        </div>
        <div className="card">
          <p className="text-2xl font-semibold">{Number(data.avg_rating).toFixed(2)}</p>
          <p className="text-sm text-muted">Average rating</p>
        </div>
        <div className="card">
          <p className="text-2xl font-semibold">{(data.unanswered_rate * 100).toFixed(0)}%</p>
          <p className="text-sm text-muted">Unanswered rate</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-medium">Top questions</h3>
        <ul className="space-y-1 text-sm">
          {data.top_questions.map((q, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="truncate">{q.question}</span>
              <span className="pill bg-primary/10 text-primary">{q.count}×</span>
            </li>
          ))}
          {data.top_questions.length === 0 && <li className="text-muted">No data yet.</li>}
        </ul>
      </div>

      <div className="card">
        <h3 className="mb-2 font-medium">Unanswered queries</h3>
        <ul className="space-y-1 text-sm">
          {data.unanswered_queries.map((u, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="truncate">{u.query}</span>
              <span className="pill bg-danger/10 text-danger">{u.intent ?? 'unknown'}</span>
            </li>
          ))}
          {data.unanswered_queries.length === 0 && <li className="text-muted">None logged.</li>}
        </ul>
      </div>
    </div>
  )
}
