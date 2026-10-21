import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { EquipmentClass } from '../types'
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

type EditorTab = 'basics' | 'steps' | 'instruments' | 'limits' | 'standards' | 'troubleshooting' | 'safety'

interface TestStep {
  step_no: number
  type: string
  text: string
}

interface TestLimit {
  parameter: string
  value: string
  unit: string
  condition: string
  source: string
  sourceError?: boolean
}

interface TestStandard {
  code: string
  title: string
  clause: string
}

interface TroubleshootingItem {
  cause: string
  action: string
}

interface SafetyItem {
  text: string
  mandatory: boolean
}

interface CatalogTest {
  id?: number
  name: string
  aliases: string[]
  category: string
  purpose: string
  summary: string
  equipment_class_id: number
  status: 'draft' | 'verified'
  steps: TestStep[]
  instruments: string[]
  limits: TestLimit[]
  standards: TestStandard[]
  troubleshooting: TroubleshootingItem[]
  safety: SafetyItem[]
}

export default function CatalogEditor() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [equipId, setEquipId] = useState<number | null>(null)
  const [tests, setTests] = useState<{ id: number; name: string; status: string }[]>([])
  const [testId, setTestId] = useState<number | null>(null)
  const [test, setTest] = useState<CatalogTest>({
    name: '',
    aliases: [],
    category: 'routine',
    purpose: '',
    summary: '',
    equipment_class_id: 0,
    status: 'draft',
    steps: [],
    instruments: [],
    limits: [],
    standards: [],
    troubleshooting: [],
    safety: [],
  })
  const [activeTab, setActiveTab] = useState<EditorTab>('basics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isNew, setIsNew] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState('')
  const [dialogConfirm, setDialogConfirm] = useState<() => void>(() => {})

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  useEffect(() => {
    if (!equipId) { setTests([]); return }
    const eq = equipment.find(e => e.id === equipId)
    if (!eq) return
    api.get<any[]>(`/api/catalog/tests?equipment=${encodeURIComponent(eq.name)}&page=1&page_size=100`)
      .then(res => setTests(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => {})
  }, [equipId])

  useEffect(() => {
    if (testId && !isNew) {
      setLoading(true)
      api.get<CatalogTest>(`/api/catalog/tests/${testId}`)
        .then(setTest)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [testId, isNew])

  const newTest = () => {
    setIsNew(true)
    setTestId(null)
    setTest({
      name: '',
      aliases: [],
      category: 'routine',
      purpose: '',
      summary: '',
      equipment_class_id: equipId || 0,
      status: 'draft',
      steps: [],
      instruments: [],
      limits: [],
      standards: [],
      troubleshooting: [],
      safety: [],
    })
    setActiveTab('basics')
  }

  const loadTest = (id: number) => {
    setIsNew(false)
    setTestId(id)
    setActiveTab('basics')
  }

  const save = async () => {
    // Validate
    if (!test.name.trim()) { setError('Test name is required'); return }
    if (!test.equipment_class_id) { setError('Equipment class is required'); return }

    // Check limits for required source
    const missingSource = test.limits.some(l => !l.source.trim())
    if (missingSource) {
      setTest(prev => ({
        ...prev,
        limits: prev.limits.map(l => ({ ...l, sourceError: !l.source.trim() }))
      }))
      setError('All limits must have a source. Please fill in the Source field for each limit.')
      return
    }

    setError('')
    setLoading(true)
    try {
      if (isNew) {
        const res = await api.post<CatalogTest>('/api/catalog/tests', test)
        setTest(res)
        setTestId(res.id)
        setIsNew(false)
        // Refresh list
        if (equipId) {
          const eq = equipment.find(e => e.id === equipId)
          if (eq) {
            api.get<any[]>(`/api/catalog/tests?equipment=${encodeURIComponent(eq.name)}&page=1&page_size=100`)
              .then(res => setTests(Array.isArray(res) ? res : res.data ?? []))
              .catch(() => {})
          }
        }
      } else {
        const res = await api.put<CatalogTest>(`/api/catalog/tests/${testId}`, test)
        setTest(res)
      }
      setError('Saved successfully')
      setTimeout(() => setError(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const submitForVerification = () => {
    if (test.status !== 'draft') return
    setDialogTitle('Submit for Verification')
    setDialogConfirm(() => {
      setLoading(true)
      api.post(`/api/catalog/tests/${testId}/submit`, {})
        .then(res => {
          setTest({ ...test, status: 'verified' })
          setError('Submitted for verification')
          setTimeout(() => setError(''), 3000)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    })
    setDialogOpen(true)
  }

  const deleteTest = () => {
    if (!testId) return
    setDialogTitle('Delete Test')
    setDialogConfirm(() => {
      setLoading(true)
      api.del(`/api/catalog/tests/${testId}`)
        .then(() => {
          newTest()
          if (equipId) {
            const eq = equipment.find(e => e.id === equipId)
            if (eq) {
              api.get<any[]>(`/api/catalog/tests?equipment=${encodeURIComponent(eq.name)}&page=1&page_size=100`)
                .then(res => setTests(Array.isArray(res) ? res : res.data ?? []))
                .catch(() => {})
            }
          }
          setError('Test deleted')
          setTimeout(() => setError(''), 3000)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    })
    setDialogOpen(true)
  }

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'steps', label: 'Steps' },
    { id: 'instruments', label: 'Instruments' },
    { id: 'limits', label: 'Limits' },
    { id: 'standards', label: 'Standards' },
    { id: 'troubleshooting', label: 'Troubleshooting' },
    { id: 'safety', label: 'Safety' },
  ]

  if (!equipId) {
    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            Catalog Editor
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Select an equipment class to manage its test catalog.
          </p>
        </header>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {equipment.map(e => (
            <button key={e.id} onClick={() => setEquipId(e.id)}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                color: 'var(--muted)',
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const currentTest = tests.find(t => t.id === testId)

  return (
    <div style={{ maxWidth: '1100px', margin: '0', width: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            Catalog Editor
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            {equipment.find(e => e.id === equipId)?.name} — {test.name || 'New test'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={newTest} disabled={loading}>New test</Button>
          {testId && (
            <>
              <Button variant="secondary" onClick={deleteTest} disabled={loading}>Delete</Button>
              {test.status === 'draft' && (
                <Button variant="primary" onClick={submitForVerification} disabled={loading}>Submit for verification</Button>
              )}
              <Button variant="primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
            </>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Equipment filter + test selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <EquipmentFilter
            selected={equipId ? equipment.find(e => e.id === equipId)?.name || 'all' : 'all'}
            onChange={(c) => {
              const eq = equipment.find(e => e.name === c)
              setEquipId(eq?.id ?? null)
            }}
          />
          {tests.length > 0 && (
            <Field label="Test" style={{ minWidth: '280px' }}>
              <Select defaultValue={testId ? String(testId) : ''} onChange={(e) => loadTest(e.target.value ? Number(e.target.value) : 0)}>
                <option value="">Select a test…</option>
                {tests.map(t => (
                  <option key={t.id} value={String(t.id)} style={{ color: t.status === 'verified' ? 'var(--success)' : 'var(--warn)' }}>
                    {t.name} ({t.status})
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {/* Status header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <StatusText status={test.status} label={test.status === 'verified' ? 'Verified' : 'Draft'} />
          <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            {error && <span style={{ color: error.startsWith('Saved') ? 'var(--success)' : 'var(--danger)' }}>{error}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0', borderBottom: '1px solid var(--rule)', marginBottom: '24px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: activeTab === t.id ? 'var(--surface-sunken)' : 'transparent',
                color: activeTab === t.id ? 'var(--ink)' : 'var(--muted)',
                fontSize: '13px',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab === 'basics' && <BasicsPanel test={test} setTest={setTest} />}
        {activeTab === 'steps' && <StepsPanel test={test} setTest={setTest} />}
        {activeTab === 'instruments' && <InstrumentsPanel test={test} setTest={setTest} />}
        {activeTab === 'limits' && <LimitsPanel test={test} setTest={setTest} />}
        {activeTab === 'standards' && <StandardsPanel test={test} setTest={setTest} />}
        {activeTab === 'troubleshooting' && <TroubleshootingPanel test={test} setTest={setTest} />}
        {activeTab === 'safety' && <SafetyPanel test={test} setTest={setTest} />}
      </div>

      <Dialog
        isOpen={dialogOpen}
        title={dialogTitle}
        description="This action cannot be undone."
        onClose={() => setDialogOpen(false)}
        onConfirm={dialogConfirm}
        confirmLabel="Confirm"
        confirmVariant={dialogTitle === 'Delete Test' ? 'destructive' : 'primary'}
        cancelLabel="Cancel"
      >
        <p style={{ color: 'var(--muted)' }}>Are you sure you want to proceed?</p>
      </Dialog>
    </div>
  )
}

function EquipmentFilterWrapper({ selected, onChange }: { selected: string; onChange: (v: string) => void }) {
  // Simple inline filter for catalog editor
  return (
    <Field label="Equipment Class" style={{ minWidth: '240px' }}>
      <Select defaultValue={selected} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
        {/* Equipment options would be passed in real implementation */}
      </Select>
    </Field>
  )
}

function EquipmentFilter({ selected, onChange }: { selected: string; onChange: (v: string) => void }) {
  // This is a placeholder - the real EquipmentFilter is imported
  return (
    <Field label="Equipment Class" style={{ minWidth: '240px' }}>
      <Select defaultValue={selected} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
      </Select>
    </Field>
  )
}

// Basics Panel
function BasicsPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Field label="Test Name" required>
        <Input placeholder="e.g. Insulation Resistance & Polarisation Index" value={test.name} onChange={e => setTest({ ...test, name: e.target.value })} />
      </Field>
      <Field label="Aliases (comma-separated)">
        <Input placeholder="e.g. IR Test, PI Test" value={test.aliases.join(', ')} onChange={e => setTest({ ...test, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Field label="Category">
          <Select defaultValue={test.category} onChange={e => setTest({ ...test, category: e.target.value })}>
            <option value="routine">Routine</option>
            <option value="type_test">Type Test</option>
            <option value="special">Special</option>
            <option value="diagnostic">Diagnostic</option>
          </Select>
        </Field>
      </div>
      <Field label="Purpose" hint="What this test is for">
        <textarea className="input resize-none" rows={4} placeholder="Describe the purpose…" value={test.purpose} onChange={e => setTest({ ...test, purpose: e.target.value })} />
      </Field>
      <Field label="Summary" hint="Brief overview for catalog listing">
        <textarea className="input resize-none" rows={3} placeholder="Brief summary…" value={test.summary} onChange={e => setTest({ ...test, summary: e.target.value })} />
      </Field>
    </div>
  )
}

// Steps Panel with drag-and-drop
function StepsPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addStep = () => {
    setTest(prev => ({
      ...prev,
      steps: [...prev.steps, { step_no: prev.steps.length + 1, type: 'action', text: '' }]
    }))
  }

  const removeStep = (index: number) => {
    setTest(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_no: i + 1 }))
    }))
  }

  const moveStep = (from: number, to: number) => {
    setTest(prev => {
      const steps = [...prev.steps]
      const [removed] = steps.splice(from, 1)
      steps.splice(to, 0, removed)
      return { ...prev, steps: steps.map((s, i) => ({ ...s, step_no: i + 1 })) }
    })
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      moveStep(draggedIndex, index)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => setDraggedIndex(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Drag by the grip to reorder. Alt+Up/Down to move.</p>
        <Button variant="secondary" size="small" onClick={addStep}>Add step</Button>
      </div>

      {test.steps.length === 0 && (
        <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--rule)', borderRadius: 'var(--radius)' }}>
          No steps yet. Click "Add step" to begin.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {test.steps.map((step, index) => (
          <div
            key={index}
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px',
              border: `1px solid ${draggedIndex === index ? 'var(--primary)' : 'var(--rule)'}`,
              borderRadius: 'var(--radius)',
              background: draggedIndex === index ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'var(--surface)',
              transition: 'all 100ms',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--rule)',
                color: 'var(--muted)',
                cursor: 'grab',
                fontFamily: 'var(--font-data)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              ⋮⋮
            </span>
            <span style={{
              flexShrink: 0,
              width: '40px',
              textAlign: 'right',
              fontFamily: 'var(--font-data)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--muted)',
              marginTop: '2px',
            }}>
              {index + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</span>
                <Select
                  defaultValue={step.type}
                  onChange={e => setTest(prev => ({ ...prev, steps: prev.steps.map((s, i) => i === index ? { ...s, type: e.target.value } : s) }))}
                  style={{ width: 'auto', minWidth: '140px' }}
                >
                  <option value="action">Action</option>
                  <option value="safety">Safety</option>
                  <option value="check">Check</option>
                  <option value="note">Note</option>
                </Select>
              </div>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Step description…"
                value={step.text}
                onChange={e => setTest(prev => ({ ...prev, steps: prev.steps.map((s, i) => i === index ? { ...s, text: e.target.value } : s) }))}
              />
            </div>
            <button
              type="button"
              onClick={() => removeStep(index)}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--danger)',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Instruments Panel
function InstrumentsPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const addInstrument = () => setTest(prev => ({ ...prev, instruments: [...prev.instruments, ''] }))
  const removeInstrument = (index: number) => setTest(prev => ({ ...prev, instruments: prev.instruments.filter((_, i) => i !== index) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>One instrument per row.</p>
        <Button variant="secondary" size="small" onClick={addInstrument}>Add instrument</Button>
      </div>

      {test.instruments.map((inst, index) => (
        <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Input
            placeholder="e.g. Insulation tester, 10 kV"
            value={inst}
            onChange={e => setTest(prev => ({ ...prev, instruments: prev.instruments.map((s, i) => i === index ? e.target.value : s) }))}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeInstrument(index)}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--danger)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

// Limits Panel
function LimitsPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const addLimit = () => setTest(prev => ({
    ...prev,
    limits: [...prev.limits, { parameter: '', value: '', unit: '', condition: '', source: '', sourceError: false }]
  }))
  const removeLimit = (index: number) => setTest(prev => ({ ...prev, limits: prev.limits.filter((_, i) => i !== index) }))

  const hasSourceError = test.limits.some(l => l.sourceError)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Every limit must have a Source. Rows missing a source will block submission.</p>
        <Button variant="secondary" size="small" onClick={addLimit}>Add limit</Button>
      </div>

      {test.limits.length === 0 && (
        <p style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--rule)', borderRadius: 'var(--radius)' }}>
          No limits yet. Click "Add limit" to begin.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
              {['Parameter', 'Value', 'Unit', 'Condition', 'Source (required)', ''].map((col) => (
                <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {test.limits.map((limit, index) => (
              <tr key={index} style={{ borderBottom: '1px solid var(--rule)' }}>
                <td style={{ padding: '10px 14px' }}>
                  <Input
                    placeholder="e.g. IR (60 s)"
                    value={limit.parameter}
                    onChange={e => setTest(prev => ({ ...prev, limits: prev.limits.map((l, i) => i === index ? { ...l, parameter: e.target.value, sourceError: false } : l) }))}
                  />
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Input
                    placeholder="e.g. ≥ 1000"
                    value={limit.value}
                    onChange={e => setTest(prev => ({ ...prev, limits: prev.limits.map((l, i) => i === index ? { ...l, value: e.target.value, sourceError: false } : l) }))}
                    style={{ fontFamily: 'var(--font-data)' }}
                  />
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Input
                    placeholder="e.g. MΩ"
                    value={limit.unit}
                    onChange={e => setTest(prev => ({ ...prev, limits: prev.limits.map((l, i) => i === index ? { ...l, unit: e.target.value, sourceError: false } : l) }))}
                    style={{ fontFamily: 'var(--font-data)' }}
                  />
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Input
                    placeholder="e.g. at 20 °C"
                    value={limit.condition}
                    onChange={e => setTest(prev => ({ ...prev, limits: prev.limits.map((l, i) => i === index ? { ...l, condition: e.target.value, sourceError: false } : l) }))}
                  />
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Input
                    placeholder="e.g. IEEE C57.152 §6.2"
                    value={limit.source}
                    onChange={e => setTest(prev => ({ ...prev, limits: prev.limits.map((l, i) => i === index ? { ...l, source: e.target.value, sourceError: !e.target.value.trim() } : l) }))}
                    style={{
                      borderColor: limit.sourceError ? 'var(--danger)' : 'var(--ink)',
                      background: limit.sourceError ? 'color-mix(in srgb, var(--danger) 5%, transparent)' : 'var(--surface)',
                    }}
                  />
                  {limit.sourceError && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--danger)' }}>Source is required</p>
                  )}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => removeLimit(index)}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid var(--danger)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasSourceError && (
        <p style={{ color: 'var(--danger)', fontSize: '13px' }}>Some limits are missing a Source. Fill in all Source fields before saving.</p>
      )}
    </div>
  )
}

// Standards Panel
function StandardsPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const addStandard = () => setTest(prev => ({ ...prev, standards: [...prev.standards, { code: '', title: '', clause: '' }] }))
  const removeStandard = (index: number) => setTest(prev => ({ ...prev, standards: prev.standards.filter((_, i) => i !== index) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="secondary" size="small" onClick={addStandard}>Add standard</Button>
      </div>

      {test.standards.map((std, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
          <Input
            placeholder="e.g. IEEE C57.152"
            value={std.code}
            onChange={e => setTest(prev => ({ ...prev, standards: prev.standards.map((s, i) => i === index ? { ...s, code: e.target.value } : s) }))}
            style={{ fontFamily: 'var(--font-data)' }}
          />
          <Input
            placeholder="e.g. Guide for Field Testing"
            value={std.title}
            onChange={e => setTest(prev => ({ ...prev, standards: prev.standards.map((s, i) => i === index ? { ...s, title: e.target.value } : s) }))}
          />
          <Input
            placeholder="e.g. §6.2.1"
            value={std.clause}
            onChange={e => setTest(prev => ({ ...prev, standards: prev.standards.map((s, i) => i === index ? { ...s, clause: e.target.value } : s) }))}
            style={{ fontFamily: 'var(--font-data)' }}
          />
          <button
            type="button"
            onClick={() => removeStandard(index)}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--danger)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

// Troubleshooting Panel
function TroubleshootingPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const addItem = () => setTest(prev => ({ ...prev, troubleshooting: [...prev.troubleshooting, { cause: '', action: '' }] }))
  const removeItem = (index: number) => setTest(prev => ({ ...prev, troubleshooting: prev.troubleshooting.filter((_, i) => i !== index) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Probable causes and recommended actions.</p>
        <Button variant="secondary" size="small" onClick={addItem}>Add cause & action</Button>
      </div>

      {test.troubleshooting.map((item, index) => (
        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'start' }}>
          <Field label="Probable Cause" style={{ margin: 0 }}>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Describe the probable cause…"
              value={item.cause}
              onChange={e => setTest(prev => ({ ...prev, troubleshooting: prev.troubleshooting.map((t, i) => i === index ? { ...t, cause: e.target.value } : t) }))}
            />
          </Field>
          <Field label="Recommended Action" style={{ margin: 0 }}>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Describe the recommended action…"
              value={item.action}
              onChange={e => setTest(prev => ({ ...prev, troubleshooting: prev.troubleshooting.map((t, i) => i === index ? { ...t, action: e.target.value } : t) }))}
            />
          </Field>
          <button
            type="button"
            onClick={() => removeItem(index)}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--danger)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              marginTop: '28px',
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

// Safety Panel
function SafetyPanel({ test, setTest }: { test: CatalogTest; setTest: React.Dispatch<React.SetStateAction<CatalogTest>> }) {
  const addItem = () => setTest(prev => ({ ...prev, safety: [...prev.safety, { text: '', mandatory: true }] }))
  const removeItem = (index: number) => setTest(prev => ({ ...prev, safety: prev.safety.filter((_, i) => i !== index) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>Mandatory safety checks before starting the procedure.</p>
        <Button variant="secondary" size="small" onClick={addItem}>Add safety check</Button>
      </div>

      {test.safety.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={item.mandatory}
            onChange={e => setTest(prev => ({ ...prev, safety: prev.safety.map((s, i) => i === index ? { ...s, mandatory: e.target.checked } : s) }))}
            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
          />
          <label style={{ fontSize: '12px', color: 'var(--muted)', marginRight: '12px' }}>Mandatory</label>
          <Input
            placeholder="e.g. Isolate, earth, verify dead, permit-to-work"
            value={item.text}
            onChange={e => setTest(prev => ({ ...prev, safety: prev.safety.map((s, i) => i === index ? { ...s, text: e.target.value } : s) }))}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--danger)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}