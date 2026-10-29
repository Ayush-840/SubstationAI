import React, { useState } from 'react'
import { Link } from 'react-router-dom'
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
  answer?: string
  isError?: boolean
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

/**
 * Cleanly format text responses that have markdown paragraphs, bullet points,
 * numbered steps, and citations without needing a heavy third-party markdown library.
 */
function renderFormattedContent(
  text: string,
  onSelectSource?: (s: CitationItem) => void,
  citations?: CitationItem[],
) {
  if (!text) return null

  // Strip raw source blocks if sources are already displayed separately
  const cleaned = text.replace(/\n\*\*Sources\*\*:\s*[\s\S]*$/i, '').trim()
  const paragraphs = cleaned.split(/\n{2,}/)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '15px', lineHeight: 1.65, color: 'var(--ink)' }}>
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) return null

        // Check if all lines are numbered steps
        const isNumbered = lines.every(l => /^\d+[\.\)]\s/.test(l))
        if (isNumbered) {
          return (
            <ol key={pIdx} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lines.map((l, i) => {
                const match = l.match(/^(\d+)[\.\)]\s*(.*)$/)
                const num = match ? match[1] : String(i + 1)
                const body = match ? match[2] : l
                return (
                  <li key={i} style={{ display: 'flex', gap: '14px', paddingLeft: '4px' }}>
                    <span style={{ flexShrink: 0, width: '28px', textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--muted)', fontSize: '20px', lineHeight: 1.2 }}>
                      {num}
                    </span>
                    <div style={{ flex: 1 }}>{renderInline(body, onSelectSource, citations)}</div>
                  </li>
                )
              })}
            </ol>
          )
        }

        // Check if all lines are bullet items
        const isBullet = lines.every(l => /^[-•*]\s/.test(l))
        if (isBullet) {
          return (
            <ul key={pIdx} style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {lines.map((l, i) => (
                <li key={i}>{renderInline(l.replace(/^[-•*]\s*/, ''), onSelectSource, citations)}</li>
              ))}
            </ul>
          )
        }

        // Section header line (e.g. **Safety Precautions** or ### Heading)
        if (lines.length === 1 && (/^(\#{1,4}|\*\*[^*]+\*\*)\s*$/.test(lines[0]) || lines[0].endsWith(':'))) {
          const title = lines[0].replace(/^[\#\s]+/, '').replace(/^\*\*|\*\*$/g, '').replace(/:$/, '')
          return (
            <div key={pIdx} style={{ borderTop: '1px solid var(--rule)', paddingTop: '12px', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>
                {title}
              </div>
            </div>
          )
        }

        // Standard paragraph
        return (
          <p key={pIdx} style={{ margin: 0 }}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInline(line, onSelectSource, citations)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/** Render inline bold, monospace, and citations */
function renderInline(text: string, onSelectSource?: (s: CitationItem) => void, citations?: CitationItem[]): React.ReactNode {
  // Regex to match **bold**, `code`, and [n] citations
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} style={{ fontWeight: 600, color: 'var(--ink)' }}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'var(--font-data)',
            background: 'var(--surface-sunken)',
            padding: '1px 5px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9em',
          }}
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (/^\[\d+\]$/.test(token)) {
      const num = parseInt(token.slice(1, -1), 10)
      const src = citations && citations[num - 1] ? citations[num - 1] : { document: `Source ${num}`, page: '—' }
      parts.push(
        <Citation
          key={match.index}
          n={num}
          source={src}
          onClick={onSelectSource}
        />
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function TestSheet({
  intent,
  equipment,
  test,
  sections = {},
  citations = [],
  confidence = 1,
  sourceType = 'rag',
  messageId,
  onFeedback,
  feedbackGiven,
  feedbackBusy,
  feedbackError,
  streaming = false,
  onSelectSource,
  answer = '',
  isError = false,
}: TestSheetProps) {
  const [copied, setCopied] = useState(false)
  const isGuardrail = sourceType === 'guardrail'
  const isNotFound = sourceType === 'not_found'
  const isOOS = sourceType === 'out_of_scope'

  // Error handling state
  if (isError) {
    return (
      <div
        className="card"
        role="alert"
        style={{
          border: '1px solid var(--danger)',
          background: 'var(--surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="8" cy="8" r="7" />
            <line x1="8" y1="5" x2="8" y2="9" />
            <line x1="8" y1="12" x2="8.01" y2="12" />
          </svg>
          <span>Unable to Complete Query</span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)' }}>
          {answer || 'An error occurred while communicating with the substation knowledge base. Please try rephrasing or checking your connection.'}
        </p>
      </div>
    )
  }

  // Guardrail / Not found / Out of scope notice
  if (isGuardrail || isNotFound || isOOS) {
    const noticeText =
      answer ||
      sections.safety ||
      sections.purpose ||
      sections.equipment ||
      (isNotFound
        ? "I could not find a verified procedure in the catalog or manuals for this inquiry. Verify with a senior engineer or check OEM specifications."
        : isOOS
        ? "This assistant is restricted to electrical substation maintenance, procedures, and test limits."
        : "Safety lockout/tagout and interlock bypass is strictly prohibited.")

    return (
      <div
        className="card"
        role="alert"
        style={{
          border: isGuardrail ? '2px solid var(--danger)' : '1px solid var(--rule)',
          background: 'var(--surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            style={{
              flexShrink: 0,
              marginTop: '2px',
              color: isGuardrail ? 'var(--danger)' : 'var(--warn)',
            }}
          >
            <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.6, color: 'var(--ink)' }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{noticeText}</p>
          </div>
        </div>
      </div>
    )
  }

  const metaParts: string[] = []
  if (equipment) metaParts.push(equipment.toUpperCase())
  if (intent) metaParts.push(intent.replace(/_/g, ' ').toUpperCase())
  const metaLine = metaParts.length > 0 ? metaParts.join(' · ') : 'SUBSTATION IQ'

  const standards = sections.standards || ''
  const hasStructuredSections = SECTION_ORDER.some(({ key }) => Boolean(sections[key]?.trim()))
  const rawTextContent = answer || Object.values(sections).join('\n\n')

  const handleCopy = () => {
    let copyText = ''
    if (test) copyText += `${test}\n`
    if (metaLine) copyText += `${metaLine}\n\n`
    if (sections.safety) copyText += `SAFETY:\n${sections.safety}\n\n`
    if (hasStructuredSections) {
      SECTION_ORDER.forEach(({ key, label }) => {
        if (sections[key]?.trim()) {
          copyText += `${label.toUpperCase()}:\n${sections[key].trim()}\n\n`
        }
      })
    } else if (rawTextContent) {
      copyText += rawTextContent
    }

    navigator.clipboard.writeText(copyText.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

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
        marginBottom: '16px',
      }}
      aria-label={`Test sheet for ${test || intent || 'Response'}`}
    >
      {/* Header */}
      <header style={{ padding: '16px 20px', borderBottom: '2px solid var(--rule-strong)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
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
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.25,
          }}
        >
          {test || (streaming ? 'Drafting Test Sheet…' : 'Verified Maintenance Answer')}
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

      {/* Content Area */}
      <div style={{ padding: '0 20px 20px' }}>
        {/* Streaming active indicator */}
        {streaming && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '16px 0 12px',
              color: 'var(--primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--primary)',
                animation: 'token-fade 800ms infinite alternate',
              }}
            />
            <span>Drafting verified procedure from knowledge base…</span>
          </div>
        )}

        {/* When structured sections are present */}
        {hasStructuredSections && (
          <>
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
                            paddingLeft: '4px',
                          }}
                        >
                          <span
                            style={{
                              flexShrink: 0,
                              width: '36px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-data)',
                              fontSize: '24px',
                              fontWeight: 700,
                              color: 'var(--muted)',
                              lineHeight: 1.1,
                              marginTop: '2px',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div style={{ flex: 1, fontSize: '15px', lineHeight: 1.55, color: 'var(--ink)' }}>
                            {renderInline(step, onSelectSource, citations)}
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
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)' }}>
                      {items.map((item, idx) => (
                        <li key={idx} style={{ marginTop: idx > 0 ? '6px' : '0' }}>
                          {renderInline(item, onSelectSource, citations)}
                        </li>
                      ))}
                    </ul>
                  </React.Fragment>
                )
              }

              return (
                <React.Fragment key={key}>
                  <SectionLabel>{label}</SectionLabel>
                  <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)' }}>
                    {renderFormattedContent(content, onSelectSource, citations)}
                  </div>
                </React.Fragment>
              )
            })}
          </>
        )}

        {/* When raw text or streaming text is available without structured sections */}
        {(!hasStructuredSections || streaming) && (rawTextContent || streaming) && (
          <div style={{ marginTop: '16px' }}>
            {rawTextContent ? (
              renderFormattedContent(rawTextContent, onSelectSource, citations)
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>
                Loading verified test documentation…
              </p>
            )}
            {streaming && (
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: '4px',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  animation: 'blink 1s step-start infinite',
                }}
              >
                ▍
              </span>
            )}
          </div>
        )}

        {/* Confidence notice - ONLY when below threshold */}
        {!streaming && <ConfidenceBadge value={confidence} />}

        {/* Sources List */}
        {!streaming && citations && citations.length > 0 && (
          <SourcesList sources={citations} onSelectSource={onSelectSource} />
        )}

        {/* Action Row */}
        {!streaming && (
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
            {/* Quick Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: '32px', padding: '0 12px', fontSize: '13px' }}
                onClick={handleCopy}
                aria-label="Copy procedure to clipboard"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>

              {test && (
                <Link
                  to={`/procedures?test=${encodeURIComponent(test)}`}
                  className="btn-secondary"
                  style={{
                    minHeight: '32px',
                    padding: '0 12px',
                    fontSize: '13px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Start procedure →
                </Link>
              )}
            </div>

            {/* Helpful / Not helpful feedback */}
            {messageId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Helpful?</span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 6px',
                    fontSize: '13px',
                    color: feedbackGiven === 1 ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: feedbackGiven === 1 ? 600 : 400,
                    textDecoration: 'underline',
                    cursor: feedbackBusy ? 'not-allowed' : 'pointer',
                  }}
                  disabled={feedbackBusy}
                  aria-pressed={feedbackGiven === 1}
                  onClick={() => handleFeedback(1)}
                >
                  Yes
                </button>
                <span style={{ color: 'var(--rule)' }}>·</span>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 6px',
                    fontSize: '13px',
                    color: feedbackGiven === -1 ? 'var(--danger)' : 'var(--muted)',
                    fontWeight: feedbackGiven === -1 ? 600 : 400,
                    textDecoration: 'underline',
                    cursor: feedbackBusy ? 'not-allowed' : 'pointer',
                  }}
                  disabled={feedbackBusy}
                  aria-pressed={feedbackGiven === -1}
                  onClick={() => handleFeedback(-1)}
                >
                  No
                </button>
                {feedbackBusy && (
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Saving…
                  </span>
                )}
                {feedbackGiven !== undefined && !feedbackBusy && (
                  <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                    Saved
                  </span>
                )}
                {feedbackError && (
                  <span style={{ fontSize: '12px', color: 'var(--danger)' }} role="alert">
                    {feedbackError}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
