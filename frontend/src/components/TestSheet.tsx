import React from 'react'
import { SafetyBlock } from './SafetyBlock'
import { LimitsTable, type LimitRow } from './LimitsTable'
import { Citation, type CitationItem } from './Citation'
import { SourcesList } from './Sources'
import { SectionLabel } from './SectionLabel'
import { ConfidenceBadge } from './common'
import { copy } from '../copy'

export interface TestSheetProps {
  intent: string
  equipment: string | null
  test: string | null
  sections: Record<string, string>
  citations: CitationItem[]
  confidence: number
  sourceType: string
  messageId?: number
  onFeedback?: (rating: number) => void
  feedbackGiven?: number
  feedbackBusy?: boolean
  feedbackError?: string
  streaming?: boolean
  onSelectSource?: (source: CitationItem) => void
}

const SECTION_ORDER = [
  { key: 'equipment', label: copy.pages.components.testSheet.sections.instruments },
  { key: 'steps', label: copy.pages.components.testSheet.sections.procedure },
  { key: 'limits', label: copy.pages.components.testSheet.sections.limits },
  { key: 'troubleshooting', label: copy.pages.components.testSheet.sections.troubleshooting },
  { key: 'standards', label: copy.pages.components.testSheet.sections.standards },
  { key: 'purpose', label: copy.pages.components.testSheet.sections.purpose },
  { key: 'comparison', label: copy.pages.components.testSheet.sections.comparison },
] as const

function parseLimitRows(text: string): LimitRow[] {
  const rows: LimitRow[] = []
  const lines = text.split('\n').filter(l => l.trim())

  for (const line of lines) {
    const match = line.match(/^(.+?)\s+([\d≥≤\.\-\+]+)\s*(\S*)\s*(.*)$/)
    if (match) {
      let [, parameter, value, unit, rest] = match
      parameter = parameter.trim()
      value = value.trim()
      unit = unit.trim()
      rest = rest.trim()

      let condition = ''
      let standard = ''
      let notes = ''

      if (rest) {
        const condMatch = rest.match(/^(?:at|@)\s+(.+?)(?:\s+(?:per|IEC|IEEE|ASTM|ANSI|\d+))?$/i)
        if (condMatch) {
          condition = condMatch[1].trim()
          standard = rest.replace(condMatch[0], '').trim()
        } else {
          const stdMatch = rest.match(/\b(IEC|IEEE|ASTM|ANSI)\s+[\d\.\-]+\b/)
          if (stdMatch) {
            standard = stdMatch[0].trim()
            condition = rest.replace(stdMatch[0], '').replace('per', '').replace('Per', '').trim()
          } else {
            condition = rest
          }
        }
      }

      rows.push({ parameter, value, unit: unit || '—', condition: condition || '—', standard: standard || '—', notes })
    }
  }

  if (rows.length === 0 && lines.length > 0) {
    for (const line of lines) {
      const parts = line.split(/[\t|]/).map(p => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        rows.push({
          parameter: parts[0],
          value: parts[1],
          unit: parts[2] || '—',
          condition: parts[3] || '—',
          standard: parts[4] || '—',
        })
      }
    }
  }

  return rows
}

function parseNumberedSteps(text: string): string[] {
  const steps: string[] = []
  const lines = text.split('\n')

  let currentStep = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const stepMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)$/)
    if (stepMatch) {
      if (currentStep) steps.push(currentStep.trim())
      currentStep = stepMatch[2]
    } else if (currentStep) {
      currentStep += ' ' + trimmed
    } else {
      steps.push(trimmed)
    }
  }
  if (currentStep) steps.push(currentStep.trim())

  return steps.length > 0 ? steps : lines.filter(l => l.trim()).map(l => l.trim())
}

function parsePlainList(text: string): string[] {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^[-•*]\s*/, ''))
}

export function TestSheet({
  intent,
  equipment,
  test,
  sections,
  citations,
  confidence,
  sourceType,
  messageId,
  onFeedback,
  feedbackGiven,
  feedbackBusy,
  feedbackError,
  streaming = false,
  onSelectSource,
}: TestSheetProps) {
  const isGuardrail = sourceType === 'guardrail'
  const isNotFound = sourceType === 'not_found'
  const isOOS = sourceType === 'out_of_scope'

  if (isGuardrail || isNotFound || isOOS) {
    return (
      <div className="card space-y-3" role="alert">
        <div
          style={{
            border: '2px solid var(--danger)',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {sections.safety || sections.purpose || sections.equipment || 'Unable to provide an answer.'}
        </div>
      </div>
    )
  }

  const metaParts: string[] = []
  if (equipment) metaParts.push(equipment.toUpperCase())
  if (intent) metaParts.push(intent)
  const metaLine = metaParts.join(' · ')

  const standards = sections.standards || ''

  const handleFeedback = (rating: number) => {
    onFeedback?.(rating)
  }

  return (
    <article
      className="test-sheet"
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-ui)',
      }}
      aria-label={`Test sheet for ${test || intent}`}
    >
      {/* Header */}
      <header style={{ padding: '16px 20px', borderBottom: '2px solid var(--rule-strong)' }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            fontFamily: 'var(--font-ui)',
            marginBottom: '4px',
          }}
        >
          {metaLine}
        </div>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.2,
          }}
        >
          {test || 'Answer'}
        </h1>
        {standards && (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              fontFamily: 'var(--font-data)',
            }}
          >
            {standards}
          </div>
        )}
      </header>

      {/* Safety Block - Always first, never collapsible */}
      <SafetyBlock />

      {/* Conditional Sections */}
      <div style={{ padding: '0 20px 20px' }}>
        {SECTION_ORDER.map(({ key, label }) => {
          const content = sections[key]
          if (!content || !content.trim()) return null

          if (key === 'limits') {
            const rows = parseLimitRows(content)
            return (
              <React.Fragment key={key}>
                <SectionLabel>{label}</SectionLabel>
                <LimitsTable rows={rows} caption="" />
              </React.Fragment>
            )
          }

          if (key === 'steps') {
            const steps = parseNumberedSteps(content)
            return (
              <React.Fragment key={key}>
                <SectionLabel>{label}</SectionLabel>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {steps.map((step, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '16px',
                        paddingLeft: '8px',
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: '40px',
                          textAlign: 'right',
                          fontFamily: 'var(--font-data)',
                          fontSize: '28px',
                          fontWeight: 700,
                          color: 'var(--muted)',
                          lineHeight: 1.1,
                          marginTop: '2px',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, fontSize: '16px', lineHeight: 1.55, color: 'var(--ink)' }}>
                        {step}
                      </div>
                    </li>
                  ))}
                </ol>
              </React.Fragment>
            )
          }

          if (key === 'equipment') {
            const items = parsePlainList(content)
            return (
              <React.Fragment key={key}>
                <SectionLabel>{label}</SectionLabel>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)' }}>
                  {items.join(' · ')}
                </p>
              </React.Fragment>
            )
          }

          if (key === 'troubleshooting') {
            const items = parsePlainList(content)
            return (
              <React.Fragment key={key}>
                <SectionLabel>{label}</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)' }}>
                  {items.map((item, idx) => (
                    <li key={idx} style={{ marginTop: idx > 0 ? '6px' : '0' }}>{item}</li>
                  ))}
                </ul>
              </React.Fragment>
            )
          }

          return (
            <React.Fragment key={key}>
              <SectionLabel>{label}</SectionLabel>
              <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                {content}
              </div>
            </React.Fragment>
          )
        })}

        {/* Confidence - only when low */}
        <ConfidenceBadge value={confidence} />

        {/* Sources List */}
        {citations && citations.length > 0 && (
          <SourcesList sources={citations} onSelectSource={onSelectSource} />
        )}

        {/* Action Row */}
        {messageId && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--rule)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: '32px', padding: '0 12px', fontSize: '13px' }}
                disabled={feedbackBusy}
                aria-label="Helpful"
                aria-pressed={feedbackGiven === 1}
                onClick={() => handleFeedback(1)}
              >
                {copy.pages.components.testSheet.feedback.helpful}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  minHeight: '32px',
                  padding: '0 12px',
                  fontSize: '13px',
                  color: feedbackGiven === -1 ? 'var(--danger)' : undefined,
                  borderColor: feedbackGiven === -1 ? 'var(--danger)' : undefined,
                }}
                disabled={feedbackBusy}
                aria-label="Not helpful"
                aria-pressed={feedbackGiven === -1}
                onClick={() => handleFeedback(-1)}
              >
                {copy.pages.components.testSheet.feedback.notHelpful}
              </button>
              {feedbackBusy && (
                <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center' }}>
                  {copy.pages.components.testSheet.feedback.saving}
                </span>
              )}
              {feedbackError && (
                <span style={{ fontSize: '12px', color: 'var(--danger)' }} role="alert">
                  {feedbackError} — {copy.pages.components.testSheet.feedback.error}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}