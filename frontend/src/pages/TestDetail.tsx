import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { TestDetail } from '../types'
import type { LimitRow } from '../components/LimitsTable'
import { TestSheet, LimitsTable } from '../components/common'
import { Button } from '../components/Button'
import { Wordmark, SectionLabel } from '../components/common'

function parseLimitRows(limits: TestDetail['limits']): LimitRow[] {
  return limits.map((lim) => ({
    parameter: lim.parameter,
    value: lim.value,
    unit: lim.unit || '—',
    condition: lim.condition || '—',
    standard: lim.min !== undefined && lim.max !== undefined
      ? `${lim.min}–${lim.max} ${lim.unit}`
      : '—',
  }))
}

function parseNumberedSteps(steps: TestDetail['steps']): string[] {
  return steps.map((s) => s.text)
}

function parsePlainList(items: string[]): string[] {
  return items
}

export default function TestDetail() {
  const { testId } = useParams<{ testId: string }>()
  const navigate = useNavigate()
  const [test, setTest] = useState<TestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!testId) return
    setLoading(true)
    api.get<TestDetail>(`/api/catalog/tests/${testId}`)
      .then(setTest)
      .catch((e) => setError(e.message || 'Failed to load test'))
      .finally(() => setLoading(false))
  }, [testId])

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
        Loading test details…
      </div>
    )
  }

  if (error || !test) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>Test not found</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>{error || 'The requested test does not exist.'}</p>
        <Button variant="secondary" onClick={() => navigate('/catalog')} style={{ marginTop: '16px' }}>
          Back to Catalog
        </Button>
      </div>
    )
  }

  const metaParts: string[] = []
  metaParts.push(test.equipment_class.toUpperCase())
  if (test.category) metaParts.push(test.category)
  const metaLine = metaParts.join(' · ')

  const standardsLine = test.standards.map((s) => `${s.code}${s.clause ? ` §${s.clause}` : ''}`).join(' · ')

  const citations = [
    { document: 'Test Catalog', page: '—', section: `${test.equipment_class}: ${test.name}` },
    ...test.standards.map((s, i) => ({ document: s.title, page: '—', section: s.code + (s.clause ? ` §${s.clause}` : '') })),
  ]

  return (
    <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
      <TestSheet
        intent={test.category || 'Test'}
        equipment={test.equipment_class}
        test={test.name}
        sections={{
          equipment: test.equipment.map((e) => `${e.instrument}${e.spec ? ` · ${e.spec}` : ''}`).join(' · '),
          steps: parseNumberedSteps(test.steps).join('\n'),
          limits: test.limits.map((l) => `${l.parameter} ${l.value} ${l.unit} ${l.condition}`).join('\n'),
          troubleshooting: test.troubleshooting?.map((t) => `${t.cause} → ${t.action}`).join('\n') || '',
          standards: standardsLine,
          purpose: test.purpose || '',
        }}
        citations={citations}
        confidence={1.0}
        sourceType="catalog"
        messageId={undefined}
        onFeedback={() => {}}
      />

      {/* Verified by line */}
      {test.verified_by && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="2 8 6 12 14 3" />
          </svg>
          <span>Verified by {test.verified_by}{test.verified_at ? ` · ${new Date(test.verified_at).toLocaleDateString()}` : ''}</span>
        </div>
      )}

      {/* Action row */}
      <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={() => navigate(`/procedures?test=${test.id}`)}>
          Start guided run
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/result-checker?test=${test.id}`)}>
          Check a result
        </Button>
        <Button variant="tertiary" onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </div>
  )
}