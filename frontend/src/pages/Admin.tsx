import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { DocumentInfo, EquipmentClass, User } from '../types'
import {
  SectionLabel,
  Button,
  Field,
  Input,
  Select,
  Dialog,
  Wordmark,
  StatusText,
} from '../components/common'
import { StatusText as StatusTextComp } from '../components/StatusText'

interface Analytics {
  total_queries: number
  avg_rating: number
  unanswered_rate: number
  top_questions: { question: string; count: number }[]
  unanswered_queries: { query: string; intent: string | null; score: number | null; created_at: string }[]
}

interface VerificationItem {
  id: number
  draft: { test_name: string; equipment_class: string; sections: Record<string, string> }
  source: { document: string; passage: string }
  changed_fields: string[]
  status: 'pending' | 'approved' | 'returned'
}

interface EvaluationMetrics {
  run_id: number
  created_at: string
  metrics: { name: string; target: number; result: number; status: 'pass' | 'fail' }[]
  ablation: { name: string; baseline: number; with_feature: number }[]
}

interface AdminUser {
  id: number
  name: string
  email: string
  role: 'trainee' | 'engineer' | 'admin'
}

type AdminTab = 'documents' | 'verification' | 'analytics' | 'evaluation' | 'users'

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>('documents')

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
          Admin
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Manage documents, verification queue, analytics, evaluation, and users.
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--rule)', paddingBottom: '12px' }}>
        {(['documents', 'verification', 'analytics', 'evaluation', 'users'] as AdminTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: tab === t ? 'var(--primary)' : 'transparent',
              color: tab === t ? 'var(--primary-ink)' : 'var(--muted)',
              fontSize: '13px',
              fontWeight: tab === t ? 600 : 500,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              borderBottom: tab === t ? '3px solid var(--primary)' : '3px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'documents' && <Documents />}
      {tab === 'verification' && <VerificationQueue />}
      {tab === 'analytics' && <AnalyticsView />}
      {tab === 'evaluation' && <EvaluationView />}
      {tab === 'users' && <UsersView />}
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const load = () => api.get<DocumentInfo[]>('/api/admin/documents').then(setDocs).catch((e) => setError(e.message))
  useEffect(() => {
    load()
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setError('')
    try {
      const form = new FormData()
      form.append('title', title || file.name)
      form.append('doc_type', docType)
      if (equipId) form.append('equipment_class_id', equipId)
      form.append('file', file)

      // Simulate progress since we can't track real progress easily
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 10, 90))
      }, 200)

      await api.postForm('/api/admin/documents', form)
      clearInterval(progressInterval)
      setUploadProgress(100)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setUploadProgress(0), 500)
      load()
    } catch (err: any) {
      setError(err.message)
      setUploadProgress(0)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionLabel topRule={false}>Upload Document</SectionLabel>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${dragActive ? 'var(--primary)' : 'var(--ink)'}`,
          borderRadius: 'var(--radius)',
          background: dragActive ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'var(--surface)',
          padding: '32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        <input type="file" ref={fileRef} accept=".pdf,.docx,.txt" onChange={handleFileSelect} style={{ display: 'none' }} />
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--ink)' }}>
          Drop a PDF, DOCX or TXT file, or{' '}
          <button type="button" onClick={() => fileRef.current?.click()} style={{ color: 'var(--primary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}>
            choose a file
          </button>
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Maximum file size: 25 MB</p>

        {(uploading || uploadProgress > 0) && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>
              <span>Uploading {title || 'document'}…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ height: '4px', background: 'var(--rule)', borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary)', transition: 'width 100ms' }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <Field label="Title" hint="Optional, defaults to filename">
          <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
        </Field>
        <Field label="Type" required>
          <Select defaultValue={docType} disabled={uploading}>
            <option value="manual">OEM manual</option>
            <option value="sop">SOP</option>
            <option value="standard">Standard</option>
            <option value="guideline">Guideline</option>
          </Select>
        </Field>
        <Field label="Equipment Class" hint="Optional">
          <Select defaultValue={equipId} disabled={uploading}>
            <option value="">—</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}
      <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 'fit-content' }}>
        {uploading ? 'Uploading…' : 'Upload'}
      </Button>

      <SectionLabel>Documents</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['File', 'Type', 'Equipment', 'Status', 'Added', ''].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{d.title}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{d.doc_type ?? '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{d.equipment_class ?? '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <StatusTextComp status={d.status} />
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <Button variant="tertiary" size="small" onClick={() => remove(d.id)}>Delete</Button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No documents uploaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VerificationQueue() {
  const [items, setItems] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null)
  const [compareSource, setCompareSource] = useState<string>('')

  useEffect(() => {
    api.get<VerificationItem[]>('/api/admin/verification').then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const approve = async (id: number) => {
    await api.post(`/api/admin/verification/${id}/approve`, {})
    setItems(items.map(i => i.id === id ? { ...i, status: 'approved' } : i))
    setSelectedItem(null)
  }

  const returnItem = async (id: number, comment: string) => {
    await api.post(`/api/admin/verification/${id}/return`, { comment })
    setItems(items.map(i => i.id === id ? { ...i, status: 'returned' } : i))
    setSelectedItem(null)
  }

  if (loading) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading verification queue…</p>

  return (
    <div>
      <SectionLabel topRule={false}>Verification Queue</SectionLabel>
      {items.length === 0 && (
        <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No items pending verification.</p>
      )}
      {items.map((item) => (
        <div key={item.id} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>{item.draft.test_name}</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>{item.draft.equipment_class}</p>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: item.status === 'pending' ? 'var(--warn)' : item.status === 'approved' ? 'var(--success)' : 'var(--danger)',
              padding: '2px 8px',
              border: `1px solid ${item.status === 'pending' ? 'var(--warn)' : item.status === 'approved' ? 'var(--success)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius-sm)',
            }}>
              {item.status}
            </span>
          </div>

          <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Draft (Test Sheet)</p>
              <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', maxHeight: '400px', overflow: 'auto', background: 'var(--surface-sunken)' }}>
                <pre style={{ margin: 0, padding: '16px', fontSize: '12px', fontFamily: 'var(--font-ui)', whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                  {JSON.stringify(item.draft.sections, null, 2)}
                </pre>
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Source Passage</p>
              <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', maxHeight: '400px', overflow: 'auto', background: 'var(--surface-sunken)', padding: '16px', fontSize: '13px', lineHeight: 1.6, color: 'var(--ink)' }}>
                {item.source.passage}
              </div>
            </div>
          </div>

          {item.changed_fields.length > 0 && (
            <div style={{ padding: '12px 16px', borderTop: '3px solid var(--hazard)', background: 'color-mix(in srgb, var(--hazard) 5%, transparent)' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--hazard)' }}>
                Changed Fields
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--ink)' }}>
                {item.changed_fields.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rule)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="small" onClick={() => { setSelectedItem(item); setCompareSource(item.source.passage) }}>View Details</Button>
            {item.status === 'pending' && (
              <>
                <Button variant="secondary" size="small" onClick={() => { const c = prompt('Return comment:'); if (c) returnItem(item.id, c) }}>Return with comment</Button>
                <Button variant="primary" size="small" onClick={() => approve(item.id)}>Approve</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalyticsView() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Analytics>('/api/admin/analytics').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>
  if (!data) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading analytics…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionLabel topRule={false}>Key Figures</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '36px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{data.total_queries}</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Total Queries</p>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '36px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{Number(data.avg_rating).toFixed(2)}</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Avg Rating</p>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '36px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{(data.unanswered_rate * 100).toFixed(0)}%</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Unanswered Rate</p>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '36px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{data.unanswered_queries.length}</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Open Unanswered</p>
        </div>
      </div>

      <SectionLabel>Top Questions</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Question', 'Count'].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.top_questions.map((q, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', color: 'var(--ink)', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--primary)', textAlign: 'right' }}>{q.count}×</td>
              </tr>
            ))}
            {data.top_questions.length === 0 && <tr><td colSpan={2} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionLabel>Unanswered Queries</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Query', 'Intent', 'Score', 'Date'].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.unanswered_queries.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', color: 'var(--ink)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.query}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: u.intent ? 'var(--muted)' : 'var(--danger)', fontWeight: u.intent ? 400 : 500 }}>{u.intent ?? 'unknown'}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: u.score !== null ? 'var(--ink)' : 'var(--muted)' }}>{u.score !== null ? u.score.toFixed(2) : '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {data.unanswered_queries.length === 0 && <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>None logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EvaluationView() {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<EvaluationMetrics>('/api/admin/evaluation').then(setMetrics).catch((e) => setError(e.message))
  }, [])

  if (error) return <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>
  if (!metrics) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading evaluation…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>Latest Evaluation Run</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Run #{metrics.run_id} · {new Date(metrics.created_at).toLocaleString()}</p>
        </div>
      </header>

      <SectionLabel topRule={false}>Metrics</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Metric', 'Target', 'Result', 'Status'].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.metrics.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{m.name}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: 'var(--ink)' }}>{m.target.toFixed(3)}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: 'var(--ink)' }}>{m.result.toFixed(3)}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: m.status === 'pass' ? 'var(--success)' : 'var(--danger)',
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.status === 'pass' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                    {m.status === 'pass' ? 'Pass' : 'Fail'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionLabel>Ablation Study</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Feature', 'Baseline', 'With Feature', 'Delta'].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.ablation.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{a.name}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: 'var(--ink)' }}>{a.baseline.toFixed(3)}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: 'var(--ink)' }}>{a.with_feature.toFixed(3)}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', color: a.with_feature > a.baseline ? 'var(--success)' : a.with_feature < a.baseline ? 'var(--danger)' : 'var(--muted)' }}>
                  {(a.with_feature - a.baseline).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UsersView() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogUser, setDialogUser] = useState<AdminUser | null>(null)
  const [dialogRole, setDialogRole] = useState<'trainee' | 'engineer' | 'admin'>('trainee')

  useEffect(() => {
    api.get<AdminUser[]>('/api/admin/users').then(setUsers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const openRoleDialog = (user: AdminUser) => {
    setDialogUser(user)
    setDialogRole(user.role)
  }

  const saveRole = async () => {
    if (!dialogUser) return
    await api.patch(`/api/admin/users/${dialogUser.id}`, { role: dialogRole })
    setUsers(users.map(u => u.id === dialogUser.id ? { ...u, role: dialogRole } : u))
    setDialogUser(null)
  }

  if (loading) return <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>Loading users…</p>

  return (
    <div>
      <SectionLabel topRule={false}>Users</SectionLabel>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Name', 'Email', 'Role', ''].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)' }}>{u.name}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{u.email}</td>
                <td style={{ padding: '12px 14px' }}>
                  <select
                    value={u.role}
                    onChange={(e) => { openRoleDialog(u); setDialogRole(e.target.value as 'trainee' | 'engineer' | 'admin') }}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--rule)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="trainee">Trainee</option>
                    <option value="engineer">Engineer</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <Button variant="tertiary" size="small" onClick={() => openRoleDialog(u)}>Change</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        isOpen={!!dialogUser}
        title="Change User Role"
        description={dialogUser ? `Change role for ${dialogUser.name} (${dialogUser.email})` : ''}
        onClose={() => setDialogUser(null)}
        onConfirm={saveRole}
        confirmLabel="Save"
        confirmVariant="primary"
        cancelLabel="Cancel"
      >
        <Field label="Role" required>
          <Select defaultValue={dialogRole} onChange={(e) => setDialogRole(e.target.value as 'trainee' | 'engineer' | 'admin')}>
            <option value="trainee">Trainee</option>
            <option value="engineer">Engineer</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </Dialog>
    </div>
  )
}