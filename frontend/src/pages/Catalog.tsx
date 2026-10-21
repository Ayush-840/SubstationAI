import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, TestListItem } from '../types'
import {
  SectionLabel,
  EquipmentFilter,
  type EquipmentCategory,
  Wordmark,
  Link,
} from '../components/common'

interface TestListResponse {
  data: TestListItem[]
  total: number
  page: number
  page_size: number
}

export default function Catalog() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [tests, setTests] = useState<TestListItem[]>([])
  const [selectedEquip, setSelectedEquip] = useState<EquipmentCategory>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState<keyof TestListItem>('name')
  const [sortDesc, setSortDesc] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'draft' | 'archived'>('all')

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  const fetchTests = async () => {
    setLoading(true)
    try {
      const equipName = selectedEquip === 'all' ? undefined : selectedEquip
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort: `${sortDesc ? '-' : ''}${sortCol}`,
      })
      if (equipName) params.set('equipment', equipName)
      if (search) params.set('q', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await api.get<TestListResponse>(`/api/catalog/tests?${params}`)
      setTests(res.data || [])
      setTotal(res.total || 0)
    } catch {
      setTests([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTests()
  }, [page, sortCol, sortDesc, search, selectedEquip, statusFilter])

  const handleSort = (col: keyof TestListItem) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc)
    } else {
      setSortCol(col)
      setSortDesc(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div style={{ maxWidth: '1200px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          Test Catalog
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Browse and search maintenance tests by equipment, category, or standard.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ width: '100%' }}>
          <input
            type="search"
            placeholder="Search tests…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            style={{
              width: '100%',
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <EquipmentFilter selected={selectedEquip} onChange={(c) => { setSelectedEquip(c); setPage(1) }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'verified', 'draft', 'archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: statusFilter === s ? '2px solid var(--primary)' : '1px solid var(--rule)',
                  background: statusFilter === s ? 'var(--surface-sunken)' : 'var(--surface)',
                  color: statusFilter === s ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: statusFilter === s ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading tests…
        </div>
      )}

      {!loading && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
                  {[
                    { key: 'name', label: 'Test' },
                    { key: 'equipment_class', label: 'Equipment' },
                    { key: 'category', label: 'Category' },
                    { key: 'standard_code', label: 'Standard' },
                    { key: 'status', label: 'Status' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => handleSort(col.key as keyof TestListItem)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: '10px' }}>
                            {sortDesc ? '▼' : '▲'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tests.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                      No tests found. Adjust your filters or search.
                    </td>
                  </tr>
                ) : (
                  tests.map((test) => (
                    <tr
                      key={test.id}
                      style={{
                        borderBottom: '1px solid var(--rule)',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--ink)' }}>
                        <Link href={`/catalog/tests/${test.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                          {test.name}
                        </Link>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--ink)' }}>{test.equipment_class}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: '14px' }}>{test.category || '—'}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-data)', color: 'var(--muted)', fontSize: '13px' }}>
                        {test.standard_code || '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: test.status === 'verified' ? 'var(--success)' : test.status === 'draft' ? 'var(--warn)' : 'var(--muted)',
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: test.status === 'verified' ? 'var(--success)' : test.status === 'draft' ? 'var(--warn)' : 'var(--muted)',
                            flexShrink: 0,
                          }} />
                          {test.status?.charAt(0).toUpperCase() + test.status?.slice(1) || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked layout */}
          <div className="block md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {tests.map((test) => (
              <div
                key={test.id}
                style={{
                  padding: '16px',
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                }}
              >
                <Link href={`/catalog/tests/${test.id}`} style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{test.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                    <span><strong>Equipment:</strong> {test.equipment_class}</span>
                    <span><strong>Category:</strong> {test.category || '—'}</span>
                    <span><strong>Standard:</strong> <span style={{ fontFamily: 'var(--font-data)' }}>{test.standard_code || '—'}</span></span>
                    <span style={{ color: test.status === 'verified' ? 'var(--success)' : test.status === 'draft' ? 'var(--warn)' : 'var(--muted)' }}>
                      <strong>Status:</strong> {test.status?.charAt(0).toUpperCase() + test.status?.slice(1) || '—'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                style={{ minHeight: '36px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{ minHeight: '36px' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}