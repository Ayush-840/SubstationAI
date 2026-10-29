# Design — SubstationIQ UI/UX Specification

Version 2.0 · Companion to PRD.md and TRD.md

---

## 1. Principles

1. **Safety first, visibly.** Safety blocks are high-contrast and never tucked away.
2. **Trust through sources.** Every claim shows where it came from, one tap away.
3. **Structure over prose.** Answers use a predictable card layout so a reader finds limits, steps and equipment instantly.
4. **Field-ready.** Large touch targets, readable outdoors, works on a phone.
5. **Teach as you answer.** Learn mode and quizzes sit one click away from any answer.

## 2. Information Architecture

```
Auth (Login · Register · Forgot / Reset password)
App shell
├── Ask (chat)                     all roles
├── Catalog (browse tests)         all roles
│   └── Test detail
├── Procedures (guided runs)       all roles
├── Tools
│   ├── Result Checker             all roles
│   ├── Fault Diagnosis            engineer, admin
│   └── DGA / Duval Triangle       engineer, admin
├── Learn (explain, quizzes, progress)
├── History
├── Catalog Editor                 engineer (drafts), admin
└── Admin                          admin
    ├── Documents
    ├── Verification queue
    ├── Analytics
    ├── Evaluation
    └── Users
```

Navigation items appear only for the roles that can use them.

## 3. Key Flows

**A. Ask a question.** Choose an optional equipment chip → type or tap a suggestion → intent shown as a small tag ("Limits · Circuit Breaker") → streamed, structured answer → open a citation → thumbs up/down or "Start guided procedure" / "Explain simply".

**B. Guided procedure.** Catalog or answer → "Start guided run" → safety gate (all mandatory items ticked) → step cards with sources → notes → completion summary → PDF export.

**C. Check a result.** Pick equipment and test → enter value, unit, conditions → verdict (within / borderline / outside) with the cited limit → if outside, show troubleshooting causes.

**D. DGA.** Enter gas values → Duval triangle plotted with the point and zone → interpretation with the standard referenced → link to troubleshooting.

**E. Learn.** Choose equipment → "Explain simply" summary → 5-question quiz → results with explanations and progress.

**F. Catalog authoring.** An engineer creates a draft (steps, instruments, limits with **required source**, standards) → submits → an admin reviews it side by side with the source → verifies or returns it with a comment.

**G. Admin upload.** Drop a file → set type and equipment → watch live progress (Processing → Ready) via SSE.

## 4. Layouts

**Desktop (≥ 1024 px).** Left sidebar (navigation, history), centre workspace, right sources panel that opens on citation click.

**Tablet.** Collapsible sidebar; sources as a drawer.

**Mobile (< 768 px).** Bottom tab bar (Ask · Catalog · Procedures · Learn · More); sources as a bottom sheet; sticky composer.

## 5. Screens

### 5.1 Ask (chat)

- Header: equipment chips (All, Transformer, Reactor, Breaker, Instrument Transformer, Surge Arrester).
- Empty state: four suggested questions covering procedure, limits, troubleshooting and standards.
- **Structured answer card** (assistant message):
  1. Title row: test name + equipment + intent tag + confidence badge
  2. 🦺 **Safety banner** (amber; fixed text)
  3. 🧪 **Test equipment** (chips)
  4. 📝 **Procedure** (numbered steps with citation chips)
  5. 📏 **Limits table** (parameter, value, unit, condition, standard)
  6. 📚 **Standards** (chips)
  7. 🛠️ **If outside limits** (cause → action list)
  8. Action row: copy, thumbs, "Start guided run", "Explain simply"
- Sections not relevant to the intent are omitted; each is collapsible.
- Streaming state: "Understanding question…" → "Searching catalog and manuals…" → "Writing answer…".
- "Not found" state: a neutral card explaining that nothing reliable was found, with links to browse the catalog.

### 5.2 Catalog

Search box, filters (equipment, category, status for engineers/admins), sortable list with pagination. The test detail page shows the same structured sections as the answer card, plus a "Verified by / date" badge.

### 5.3 Guided Procedure

Progress bar; **safety gate** with large checkboxes ("Continue" disabled until all ticked); step cards (type icon, text, source chip, Done / Flag issue, note); summary and PDF export; runs list under History.

### 5.4 Result Checker

Form (equipment, test, parameter, value, unit, conditions). Result card: verdict badge (icon + text + colour), the limit applied, condition, source. Outside-limit results expand the troubleshooting list.

### 5.5 DGA Tool

Gas inputs on the left; interactive triangle on the right (SVG), point marker, zone label, interpretation text, standard reference, disclaimer.

### 5.6 Learn

Topic picker, plain-language explanation panel, quiz (one question per screen, feedback with explanation), progress chart.

### 5.7 Catalog Editor

Tabbed form: Basics · Steps (drag to reorder) · Instruments · Limits (source mandatory) · Standards · Troubleshooting · Safety. Status chip (Draft / Verified). Validation messages inline.

### 5.8 Admin

- **Documents.** Upload zone, table with status pills and delete.
- **Verification queue.** Drafts with a diff-style view and Approve / Return.
- **Analytics.** Cards (queries, average rating, unanswered rate, cache hit rate), charts (queries per day, top intents), unanswered list.
- **Evaluation.** Latest run metrics and ablation table.
- **Users.** List, role change.

## 6. Design Tokens

| Token | Light (Paper) | Dark (Control Room) | Use |
|---|---|---|---|
| `--bg` | #F3F0E8 | #101512 | App background (warm paper / control room) |
| `--surface` | #FBF9F4 | #161D19 | Panels & cards |
| `--rule` | #CFCABD | #2B3630 | Dividers & borders |
| `--ink` | #17201C | #E7EBE4 | Primary text |
| `--muted` | #5E6B63 | #93A097 | Secondary text |
| `--primary` | #1F5C45 | #7BC9A0 | Primary actions & active tabs (forest green) |
| `--hazard` | #F2B800 | #FFC933 | Safety banner & hazard stripe |
| `--danger` | #B3261E | #FF7A70 | Outside limits, critical actions |
| `--warn` | #A15C00 | #F0A63A | Borderline limits |
| `--success` | #2F7A3E | #6FD08A | Within limits, verified |
| `--focus` | #B45309 | #F59E0B | Focus ring (warm amber, zero blue) |

Typography: IBM Plex Sans for the UI, IBM Plex Mono for values and standards, Newsreader for headings. Spacing on a 4-pt scale; radius 2 / 4 px. Icons: custom technical SVGs. Zero blue palette.

## 7. Components

Equipment chip · Intent tag · Confidence badge (text + colour) · Citation chip (`[1] Manual · p.14`) · Safety banner · Limits table · Step card · Checklist item (48 px min) · Verdict badge · Status pill (Draft / Verified / Processing / Ready / Failed) · Toast · Empty state · Skeleton loaders · Confirmation dialog for destructive actions.

## 8. States and Microcopy

| Situation | Message |
|---|---|
| Not found | "I couldn't find a reliable answer in the verified catalog or documents. Try browsing the catalog, or ask a senior engineer." |
| Out of scope | "I can only help with substation maintenance topics." |
| Bypass request | "I can't help with bypassing safety devices or interlocks." |
| Session expired | "Your session ended. Please sign in again." (an auto-refresh is attempted first) |
| Rate limited | "Too many requests. Please wait a moment." |
| Upload failed | "This file couldn't be processed. Use a text-based PDF or DOCX under 25 MB." |
| Footer | "SubstationIQ is an aid, not a substitute for official procedures and permits." |

## 9. Accessibility and Responsiveness

WCAG AA contrast (check the amber banner text). Never rely on colour alone — badges carry icon + text. Full keyboard support with visible focus. ARIA live region for streaming. 44 px touch targets. `prefers-color-scheme` and `prefers-reduced-motion` respected. Breakpoints at 640, 768, 1024.

## 10. Demo Polish Checklist

- [ ] Seed data loaded; no empty screens in the demo
- [ ] Three rehearsed scenarios: (1) limits question with structured answer, (2) guided procedure with safety gate, (3) result checker plus DGA
- [ ] Light and dark themes both checked
- [ ] Mobile screenshots for the report
- [ ] Loading skeletons and error states on every async screen
- [ ] Favicon, titles, meta tags
