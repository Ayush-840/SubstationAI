# 03. Components

For each component: **what it replaces**, **the new spec**, **do / don't**. Tokens come from `02-design-tokens.md`.

---

## 1. Structured answer ("Test Sheet")

The most important component in the product. It replaces the eight-card answer with a single document-style sheet.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ POWER TRANSFORMER · PROCEDURE                       (meta line)
│ Insulation Resistance & Polarisation Index          (title)
│ IEC 60076-1 · IEEE C57.152                          (mono, muted)
├══════════════════════════════════════════════════════════════┤  2px rule-strong
│ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨   hazard stripe
│ SAFETY BEFORE YOU START
│ Isolate. Earth. Verify dead. Permit-to-work. PPE.
├──────────────────────────────────────────────────────────────┤
│ INSTRUMENTS
│ Insulation tester, 5 or 10 kV · Test leads · Temperature probe¹
├──────────────────────────────────────────────────────────────┤
│ PROCEDURE
│ 1  Disconnect all external connections …¹
│ 2  Clean bushings …¹
├──────────────────────────────────────────────────────────────┤
│ ACCEPTABLE LIMITS
│ Parameter      Value      Unit   Condition        Standard
│ IR (60 s)      ≥ 1000     MΩ     at 20 °C         …²
│ PI             ≥ 1.5      –      10 min / 1 min   …²
├──────────────────────────────────────────────────────────────┤
│ IF OUTSIDE LIMITS
│ Probable cause → Action
├──────────────────────────────────────────────────────────────┤
│ SOURCES
│ 1  OEM manual, p. 42        2  Standard summary, §5
└──────────────────────────────────────────────────────────────┘
 [Copy]  [Start guided run]  [Explain simply]        Helpful?  Yes / No
```

(The numbers shown are layout placeholders only. Real values always come from the catalog or cited source.)

### Spec

- **One container.** A single panel with a 1 px `--rule` border (or no border on mobile), `--radius` 4 px, no shadow. Sections are separated by 1 px rules, not boxes.
- **Header:** meta line (`EQUIPMENT · INTENT` in 12 px uppercase label style), test name in `--text-lead` or display serif, standards line in mono + muted. A 2 px `--rule-strong` rule under the header.
- **Section labels:** 12 px uppercase, letter-spacing .08em, `--muted`, top rule 1 px. No emoji.
- **Safety block:** always first after the header, never collapsible, uses the hazard-stripe pattern (see 3 below).
- **Instruments:** plain comma/dot-separated list in text, not chips.
- **Procedure:** numbered list with large step numbers in mono at the left margin (hanging numerals). No numbered circles.
- **Limits table:** see component 4. This is the visual hero.
- **Citations:** superscript numerals with a **Sources** list at the bottom (component 2).
- **Omitted sections:** sections irrelevant to the intent are **omitted entirely**. If someone asks only for limits, show only header, safety line, limits and sources. Variation in answer length and shape is correct behavior.
- **Collapse:** only Procedure (when > 8 steps) and "If outside limits" may collapse. Never Safety, never Limits.
- **Action row:** text buttons (component 7), right-aligned feedback as plain "Helpful? Yes / No" text links.
- **Confidence:** show a confidence line **only when below threshold**: `Low confidence. Verify against the OEM manual.` in `--warn` with an icon. Do not show a badge when confidence is high.
- **Streaming:** text appears in place with a 150 ms fade. Reserve the section structure as it arrives. No spinners over the sheet.

### Don't

- Don't wrap each section in its own card.
- Don't put chips around instruments or standards.
- Don't center anything.

---

## 2. Citations (footnote style)

Replaces: `[1] Manual · p.14` colored chips.

- **Inline:** superscript number (`¹`, `²`) styled as a link: `--primary`, no background, underline on hover/focus. Minimum hit area 24 x 24 px (use padding), 44 px on touch.
- **Sources list** at the bottom of the sheet: numbered rows with `document title · section · page` in `--text-small`; the document name is the link.
- **Click behavior:** opens the sources panel (desktop right panel, mobile bottom sheet) scrolled to the passage with the quoted text highlighted using a subtle `--hazard` at 25% opacity highlight (the only soft tint permitted).
- **Hover:** a plain tooltip with document and page. No animated popover.
- **Accessibility:** each superscript has `aria-label="Source 2: OEM manual, page 42"`.

---

## 3. Safety block

Replaces: the amber rounded banner.

- Structure: 10 px **hazard stripe** across the top edge, then a block with `--surface` background and `--ink` text.
- Label: `SAFETY BEFORE YOU START` in condensed/uppercase label style.
- Text: the fixed notice, 17 to 18 px, `--ink` on `--surface` (high contrast, no yellow-on-white text).
- Optional icon: a plain triangle-exclamation in a 2 px stroke. No emoji.
- Never collapsible, never dismissible, always the first block after the header.
- In the Guided Procedure the safety block becomes the **safety gate** (see `04-screens.md`).
- Test the block at arm's length on a phone outdoors. If it isn't the first thing you notice, it isn't strong enough.

```css
.safety { border: 2px solid var(--ink); background: var(--surface); }
.safety__label { font: 600 12px/16px var(--font-ui); letter-spacing: .08em; text-transform: uppercase; padding: 12px 16px 0; }
.safety__body { padding: 4px 16px 16px; font-size: 18px; }
```

---

## 4. Limits table

The component people read most. Treat it like a typeset standards table.

- Full width of the sheet, `border-collapse: collapse`.
- Header row: 12 px uppercase labels, `--surface-sunken` background, 2 px `--rule-strong` bottom rule.
- Body rows: 1 px `--rule` bottom borders only. No vertical borders, no zebra striping.
- **Value column:** mono, `--text-value` size (large), right-aligned or aligned at the decimal point, `tabular-nums`.
- **Unit column:** mono, `--muted`, regular weight.
- **Condition and standard columns:** `--text-small`, muted. Standard codes in mono.
- On mobile (< 640 px) each row becomes a stacked block: **value + unit** large on top, parameter name above it, condition and standard below. Avoid horizontal scrolling for the primary table.
- Never abbreviate or reformat numbers from the backend.

---

## 5. Verdict stamp (Result Checker)

Replaces: soft colored verdict badge.

- Rectangular stamp: 2 px border in the semantic color, uppercase 14 px mono label, slightly letter-spaced, `--radius-sm`. Transparent background (or `--surface`).
- Always **icon + text + color**:
  - `WITHIN LIMIT` with a check icon, `--success`
  - `BORDERLINE` with a minus/alert icon, `--warn`
  - `OUTSIDE LIMIT` with an X icon, `--danger`
- Below the stamp: the entered value, the limit applied, the condition and the source, in a small two-column definition list.
- Outside-limit results expand the troubleshooting list directly beneath, in the same sheet style.

---

## 6. Status indicators

Replaces: colored pills for Draft / Verified / Processing / Ready / Failed.

- Use a **text label with a 8 px dot** (circle is allowed here) and no background pill: `● Verified`, `○ Draft`.
- Processing shows a static dot plus `Processing…` and a plain progress line. No spinner.
- Failed uses `--danger` text with an icon and a short reason on the next line.
- For tables, status is a plain column with the dot and word.

---

## 7. Buttons and links

- **Primary:** solid `--primary`, `--primary-ink` text, 4 px radius, 48 px min height, 16 px / 600.
- **Secondary:** 1 px `--ink` border, transparent background.
- **Tertiary:** text only, underlined on hover, `--primary`.
- **Destructive:** `--danger` border or solid, always with a confirmation dialog.
- No icon-only buttons without an `aria-label` and a visible tooltip.
- Disabled buttons: 40% opacity plus `aria-disabled`, and explain why in nearby text (for example "Tick all safety items to continue").
- Keep **one** primary button per view.

---

## 8. Equipment filter

Replaces: row of colored chips.

- A single-select **segmented row** (like tabs) with the custom equipment glyph and a text label: `All · Transformer · Reactor · Breaker · Instrument Transformer · Surge Arrester`.
- Selected state: 2 px bottom rule in `--primary` and `--ink` text. Unselected: `--muted`.
- On mobile it scrolls horizontally with a visible edge fade (a fade is acceptable as it's functional).

---

## 9. Intent indicator

Replaces: intent tag chip.

- Plain text in the answer's meta line: `Circuit breaker · Limits`. No chip, no color.
- If the user filtered by equipment, show `Filtered: Circuit breaker` as a text link with an ×.

---

## 10. Chat composer

- A bordered input bar fixed at the bottom, 4 px radius, 1 px `--ink` border when focused.
- Send button is a text button (`Ask`), with the icon only on very narrow widths.
- Under the composer, one muted line: the disclaimer from `DESIGN.md` section 8.
- Suggested questions appear only in the empty state, as a plain list of real queries (see `05-copy-and-microcopy.md`).

---

## 11. Forms (Result Checker, Catalog Editor, Login)

- Labels above fields, 14 px / 600, always visible. No floating labels and no placeholder-as-label.
- Inputs: 48 px height, 1 px `--ink` border, 2 px radius, `--surface` background, mono font for numeric fields.
- Unit selectors attach to the right edge of the numeric input as a single control.
- Inline validation under the field in `--danger` with an icon and plain text.
- Required fields marked with the word "required" in muted text, not a red asterisk only.
- The Catalog Editor "source is mandatory" rule is shown as a visible field label: `Source (required for every limit)`.

---

## 12. Dialogs, toasts, empty states, loading

- **Dialog:** 4 px radius, 1 px border, overlay shadow allowed, no scale-in animation.
- **Toast:** top or bottom bar, solid `--ink` background with `--bg` text, 4 px radius, 4 s, dismissible, `role="status"`.
- **Empty states:** a small custom line illustration (single-line-diagram style: a busbar, breaker symbol, transformer symbol), one sentence, one action. No generic sad-face or robot illustration.
- **Loading:** static placeholder bars in `--surface-sunken`. Avoid shimmer.
- **Not found:** a plain bordered note with the "not found" copy and a link to browse the catalog (copy in `05-copy-and-microcopy.md`).

---

## 13. Navigation

- **Desktop sidebar:** text-first. Active item has a 3 px left rule in `--primary` and `--ink` text. No filled pill highlight, no icons required.
- **Mobile bottom bar:** 4 items maximum (Ask · Catalog · Procedures · More), 56 px tall, text labels always visible.
- **Wordmark:** replace the ⚡ emoji with a typographic wordmark. For example `SubstationIQ` in the display or condensed font, with the "IQ" in `--primary`. Optionally add a simple custom single-line-diagram mark. Design a matching favicon.

---

## 14. Tooltips and popovers

- Plain, square-ish (2 px radius), `--ink` background, `--bg` text, 14 px.
- Appear on focus as well as hover. No animation.

---

## 15. Component checklist (each component is done when)

- [ ] Uses only tokens, with no hard-coded hex values and no default Tailwind palette classes
- [ ] No emoji, no gradient (except the hazard stripe), no shadow (except overlays)
- [ ] Radius <= 4 px (pill only for status dots and avatars)
- [ ] Works in Light, Dark and Outdoor themes
- [ ] 48 px minimum touch target
- [ ] Keyboard and screen-reader behavior verified
- [ ] State not conveyed by color alone
