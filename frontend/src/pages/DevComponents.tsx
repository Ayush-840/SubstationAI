import React, { useState } from 'react'
import {
  Button,
  Link,
  Field,
  Input,
  Select,
  Checkbox,
  SectionLabel,
  SafetyBlock,
  LimitsTable,
  Citation,
  SourcesList,
  SourcesPanel,
  type CitationItem,
  VerdictStamp,
  StatusText,
  EquipmentFilter,
  type EquipmentCategory,
  AllEquipmentGlyph,
  TransformerGlyph,
  ReactorGlyph,
  BreakerGlyph,
  InstrumentTransformerGlyph,
  SurgeArresterGlyph,
  Dialog,
  Toast,
  EmptyState,
  Placeholder,
  Wordmark,
  TestSheet,
} from '../components/common'
import { useTheme, type Theme } from '../hooks/useTheme'

const MOCK_SOURCES: CitationItem[] = [
  {
    id: 1,
    document: 'IEEE C57.152-2013 Guide for Field Testing',
    page: 42,
    section: '6.2.1',
    quote:
      'Insulation resistance readings shall be taken at or corrected to 20 °C. For oil-filled power transformers rated 34.5 kV and above, the minimum 1-minute insulation resistance is 1000 MΩ, with a Polarization Index (10 min / 1 min) exceeding 1.5.',
    standard: 'IEEE C57.152',
  },
  {
    id: 2,
    document: 'IEC 60076-1 Power Transformers',
    page: 18,
    section: 'Clause 11.2',
    quote:
      'Measurement of insulation resistance of windings against earth and between windings. Test voltages typically 2.5 kV or 5 kV DC.',
    standard: 'IEC 60076-1',
  },
]

const MOCK_LIMITS = [
  {
    parameter: 'IR (60 s)',
    value: '≥ 1000',
    unit: 'MΩ',
    condition: 'at 20 °C',
    standard: 'IEEE C57.152 §6.2',
  },
  {
    parameter: 'PI (10 min / 1 min)',
    value: '≥ 1.5',
    unit: '—',
    condition: 'Ambient 10–40 °C',
    standard: 'IEEE C57.152 §6.2',
  },
  {
    parameter: 'Dissipation Factor (tan δ)',
    value: '≤ 0.5',
    unit: '%',
    condition: 'at 20 °C',
    standard: 'IEC 60076-1',
    notes: 'Values above 0.5% warrant oil moisture test',
  },
]

export default function DevComponents() {
  const { theme, setTheme } = useTheme()
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentCategory>('all')
  const [activeSource, setActiveSource] = useState<CitationItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isToastOpen, setIsToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('Safety checklist confirmed.')
  const [inputValue, setInputValue] = useState('1250')
  const [checkboxVal, setCheckboxVal] = useState(true)

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'var(--bg)',
        color: 'var(--ink)',
        padding: '32px 24px',
        maxWidth: '1000px',
        margin: '0 auto',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Dev Header & Theme Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderBottom: '2px solid var(--rule-strong)',
          paddingBottom: '20px',
          marginBottom: '32px',
        }}
      >
        <div>
          <Wordmark size="large" />
          <span
            style={{
              display: 'inline-block',
              marginLeft: '12px',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--rule)',
              fontSize: '12px',
              fontFamily: 'var(--font-data)',
              fontWeight: 600,
              color: 'var(--muted)',
            }}
          >
            /dev/components
          </span>
        </div>

        {/* Quick Theme Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Theme:</span>
          {(['light', 'dark', 'outdoor'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: theme === t ? '2px solid var(--primary)' : '1px solid var(--rule)',
                background: theme === t ? 'var(--surface-sunken)' : 'var(--surface)',
                color: theme === t ? 'var(--ink)' : 'var(--muted)',
                fontWeight: theme === t ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {/* 1. Buttons & Links */}
        <section>
          <SectionLabel topRule={false}>1. Buttons & Links</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="tertiary">Tertiary Action</Button>
            <Button variant="destructive">Destructive Action</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <Button variant="primary" size="small">Small Primary</Button>
            <Button variant="secondary" size="small">Small Secondary</Button>
            <Button
              variant="primary"
              disabled
              disabledReason="Verify isolation certificate before energizing"
            >
              Disabled with Reason
            </Button>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0 }}>
            Inline Link example: Refer to <Link href="#limits">Acceptable Limits Table</Link> or standard definitions.
          </p>
        </section>

        {/* 2. Form Controls */}
        <section>
          <SectionLabel>2. Form Controls (Input, Select, Checkbox, Field)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <Field label="Measured Resistance" required hint="60-second stabilized value at reference temp">
              <Input
                isNumeric
                unitSuffix="MΩ"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </Field>

            <Field label="Equipment Class" required requiredNotice="required for test">
              <Select defaultValue="tx_oil">
                <option value="tx_oil">Power Transformer (Oil Immersed)</option>
                <option value="tx_dry">Dry-Type Transformer</option>
                <option value="cb_gis">GIS Circuit Breaker</option>
              </Select>
            </Field>

            <Field label="Ambient Temperature" error="Temperature must be between -20 °C and 60 °C">
              <Input isNumeric unitSuffix="°C" defaultValue="85" hasError />
            </Field>
          </div>

          <Checkbox
            label="Earthing verified with calibrated discharge stick"
            description="All capacitive charge dissipated prior to test lead connection"
            checked={checkboxVal}
            onChange={(e) => setCheckboxVal(e.target.checked)}
          />
        </section>

        {/* 3. Safety Block */}
        <section>
          <SectionLabel>3. Safety Block (Hazard Stripe & Gate)</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SafetyBlock />
            <SafetyBlock compact label="Safety Notice (Compact)" />
          </div>
        </section>

        {/* 4. Limits Table */}
        <section id="limits">
          <SectionLabel>4. Limits Table (Desktop Table & Mobile Stacked Layout)</SectionLabel>
          <LimitsTable rows={MOCK_LIMITS} caption="Acceptable Acceptance Criteria (20 °C Baseline)" />
        </section>

        {/* 5. Test Sheet (Phase 3) */}
        <section>
          <SectionLabel>5. Test Sheet (Full Structured Answer)</SectionLabel>
          <TestSheet
            intent="Limits"
            equipment="Power Transformer"
            test="Insulation Resistance & Polarisation Index"
            sections={{
              equipment: 'Insulation tester, 5 or 10 kV · Test leads · Temperature probe',
              steps: '1. Disconnect all external connections from the transformer windings.\n2. Clean bushings and terminals thoroughly.\n3. Connect test leads to winding terminals and ground.\n4. Apply test voltage and record readings at 1 minute and 10 minutes.\n5. Calculate Polarization Index (10 min / 1 min).\n6. Discharge windings after test.',
              limits: 'IR (60 s) ≥ 1000 MΩ at 20 °C IEEE C57.152 §6.2\nPI (10 min / 1 min) ≥ 1.5 — Ambient 10–40 °C IEEE C57.152 §6.2',
              troubleshooting: 'Check bushing porcelain for moisture or surface tracking and clean thoroughly.\nPerform Karl Fischer titration oil test for moisture content in insulation paper.\nRepeat measurement after 24 hours of dry nitrogen purge if under vacuum.',
              standards: 'IEC 60076-1 · IEEE C57.152',
            }}
            citations={MOCK_SOURCES}
            confidence={0.85}
            sourceType="catalog+rag"
            messageId={123}
            onFeedback={() => {}}
            feedbackGiven={1}
            feedbackBusy={false}
          />
        </section>

        {/* 6. Citations & Sources */}
        <section>
          <SectionLabel>5. Citations (Superscript) & Sources List</SectionLabel>
          <p style={{ fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px' }}>
            The minimum insulation resistance value for oil-filled windings at 20 °C is 1000 MΩ
            <Citation n={1} source={MOCK_SOURCES[0]} onClick={(src) => setActiveSource(src)} />
            . Ensure both line and neutral terminals are clean and free of contamination before test
            application
            <Citation n={2} source={MOCK_SOURCES[1]} onClick={(src) => setActiveSource(src)} />.
          </p>
          <SourcesList sources={MOCK_SOURCES} onSelectSource={(src) => setActiveSource(src)} />
        </section>

        {/* 6. Verdict Stamps */}
        <section>
          <SectionLabel>6. Verdict Stamp (Result Checker)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <VerdictStamp
              verdict="within_limit"
              details={{
                enteredValue: '1250 MΩ',
                limitApplied: '≥ 1000 MΩ',
                condition: 'at 20 °C',
                source: 'IEEE C57.152 §6.2',
              }}
            />
            <VerdictStamp
              verdict="borderline"
              details={{
                enteredValue: '1020 MΩ',
                limitApplied: '≥ 1000 MΩ',
                condition: 'Marginal margin (+2%)',
                source: 'IEEE C57.152 §6.2',
              }}
            />
            <VerdictStamp
              verdict="outside_limit"
              details={{
                enteredValue: '450 MΩ',
                limitApplied: '≥ 1000 MΩ',
                condition: 'Degraded',
                source: 'IEEE C57.152 §6.2',
              }}
              troubleshooting={[
                'Check bushing porcelain for moisture or surface tracking and clean thoroughly.',
                'Perform Karl Fischer titration oil test for moisture content in insulation paper.',
                'Repeat measurement after 24 hours of dry nitrogen purge if under vacuum.',
              ]}
            />
          </div>
        </section>

        {/* 7. Status Indicators */}
        <section>
          <SectionLabel>7. Status Indicators (Dot + Label)</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
            <StatusText status="verified" label="Verified" />
            <StatusText status="ready" label="Ready" />
            <StatusText status="draft" label="Draft" />
            <StatusText status="processing" label="Processing…" progress={65} />
            <StatusText status="failed" label="Failed" reason="Bushing calibration expired 2026-04" />
          </div>
        </section>

        {/* 8. Equipment Filter & Custom Glyphs */}
        <section>
          <SectionLabel>8. Equipment Filter & Custom 24px Glyphs</SectionLabel>
          {/* Glyphs showcase */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            {[
              { name: 'All Substation', Icon: AllEquipmentGlyph },
              { name: 'Transformer', Icon: TransformerGlyph },
              { name: 'Reactor', Icon: ReactorGlyph },
              { name: 'Breaker', Icon: BreakerGlyph },
              { name: 'CT / CVT', Icon: InstrumentTransformerGlyph },
              { name: 'Surge Arrester', Icon: SurgeArresterGlyph },
            ].map(({ name, Icon }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <Icon size={24} style={{ color: 'var(--ink)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
                  {name}
                </span>
              </div>
            ))}
          </div>

          {/* Segmented Filter */}
          <EquipmentFilter selected={selectedEquipment} onChange={(c) => setSelectedEquipment(c)} />
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
            Currently selected category: <strong style={{ color: 'var(--ink)' }}>{selectedEquipment}</strong>
          </p>
        </section>

        {/* 9. Feedback (Dialog, Toast, EmptyState, Placeholder) */}
        <section>
          <SectionLabel>9. Feedback (Dialog, Toast, EmptyState, Placeholder)</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
              Open Sample Dialog
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setToastMsg(`Safety checklist confirmed at ${new Date().toLocaleTimeString()}`)
                setIsToastOpen(true)
              }}
            >
              Trigger Toast Notification
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <EmptyState
              title="No Test Procedures Found"
              description="No diagnostic test matches your equipment query. Browse the full substation catalog or refine the filter."
              actionLabel="Reset Filter"
              onAction={() => setSelectedEquipment('all')}
            />

            <div
              style={{
                padding: '24px',
                background: 'var(--surface)',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  marginBottom: '12px',
                }}
              >
                Static Placeholder (No Shimmer)
              </span>
              <Placeholder lines={4} height="18px" />
            </div>
          </div>
        </section>
      </div>

      {/* Sources Slide-out Panel / Sheet */}
      <SourcesPanel
        source={activeSource}
        isOpen={Boolean(activeSource)}
        onClose={() => setActiveSource(null)}
      />

      {/* Dialog Preview */}
      <Dialog
        isOpen={isDialogOpen}
        title="Confirm High-Voltage Test Injection"
        description="Verify all personnel have cleared the test perimeter and earth switches are tagged out before applying 10 kV DC."
        onClose={() => setIsDialogOpen(false)}
        onConfirm={() => {
          setIsDialogOpen(false)
          setToastMsg('High-voltage test authorized.')
          setIsToastOpen(true)
        }}
        confirmLabel="Authorize Injection"
        confirmVariant="destructive"
      />

      {/* Toast Notification */}
      <Toast
        isOpen={isToastOpen}
        message={toastMsg}
        onClose={() => setIsToastOpen(false)}
        actionLabel="Undo"
        onAction={() => setIsToastOpen(false)}
      />
    </div>
  )
}
