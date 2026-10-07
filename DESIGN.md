# DESIGN — SubstationIQ UI/UX Specification (Capstone Edition)

Version 2.0 · Companion to PRD.md and TRD.md

---

## 1. Principles

1. **Safety first, visibly.** Safety blocks are high-contrast and never hidden.
2. **Trust through sources.** Every claim shows where it came from, one tap away.
3. **Structure over prose.** Answers use a predictable card layout so users find limits, steps and equipment instantly.
4. **Field-ready.** Large touch targets, readable outdoors, works on a phone.
5. **Teach as you answer.** Learn mode and quizzes are one click from any answer.

## 2. Information Architecture

```
Auth (Login · Register · Forgot/Reset password)
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
Navigation items appear only for roles that can use them.

## 3. Key Flows

**A. Ask a question:** choose optional equipment chip → type or tap a suggestion → intent shown as a small tag ("Limits · Circuit Breaker") → streamed structured answer → open a citation → thumbs up/down or "Start guided procedure" / "Explain simply".

**B. Guided procedure:** Catalog or answer → "Start guided run" → safety gate (all mandatory items ticked) → step cards with sources → notes → completion summary → PDF export.

**C. Check a result:** pick equipment and test → enter value, unit, conditions → verdict (within / borderline / outside) with the cited limit → if outside, show troubleshooting causes.

**D. DGA:** enter gas values → Duval triangle plotted with the point and zone → interpretation with the standard referenced → link to troubleshooting.

**E. Learn:** choose equipment → "Explain simply" summary → 5-question quiz → results with explanations and progress.

**F. Catalog authoring:** engineer creates a draft (steps, instruments, limits with **required source**, standards) → submits → admin reviews side by side with the source → verifies or returns with a comment.

**G. Admin upload:** drop file → set type and equipment → live progress (Processing → Ready) via SSE.

## 4. Layouts

**Desktop (≥ 1024 px):** left sidebar (navigation, history), centre workspace, right sources panel (opens on citation click).
**Tablet:** collapsible sidebar; sources as a drawer.
**Mobile (< 768 px):** bottom tab bar (Ask · Catalog · Procedures · Learn · More); sources as a bottom sheet; sticky composer.

## 5. Screens

### 5.1 Ask (chat)
- Header: equipment chips (All, Transformer, Reactor, Breaker, Instrument Transformer, Surge Arrester).
- Empty state: four suggested questions covering procedure, limits, troubleshooting, standards.
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
- "Not found" state: neutral card explaining nothing reliable was found, with links to browse the catalog.

### 5.2 Catalog
Search box, filters (equipment, category, status for engineers/admins), sortable list with pagination. Test detail page shows the same structured sections as the answer card, plus "Verified by / date" badge.

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
- **Documents:** upload zone, table with status pills and delete.
- **Verification queue:** drafts with diff-style view and Approve / Return.
- **Analytics:** cards (queries, average rating, unanswered rate, cache hit rate), charts (queries per day, top intents), unanswered list.
- **Evaluation:** latest run metrics and ablation table.
- **Users:** list, role change.

## 6. Design Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F6F8FA | #0E1621 | Background |
| `--surface` | #FFFFFF | #16212E | Cards |
| `--border` | #DDE3EA | #263547 | Dividers |
| `--text` | #14202B | #E6EDF5 | Primary text |
| `--muted` | #5B6B7B | #9FB0C1 | Secondary text |
| `--primary` | #0B5FFF | #4D8DFF | Actions |
| `--accent` | #00A6A6 | #2CC8C8 | Citations, highlights |
| `--warning` | #F5A300 | #FFB733 | Safety banner |
| `--danger` | #D92D20 | #FF6B5E | Outside limits, critical |
| `--success` | #12A150 | #3DD68C | Within limits, verified |

Typography: Inter (UI), JetBrains Mono (values, standard codes). Scale 12/14/16/20/24/32; body 16 px on mobile. Spacing on a 4-pt scale; radius 8/12/999. Icons: Lucide.

## 7. Components

Equipment chip · Intent tag · Confidence badge (text + colour) · Citation chip (`[1] Manual · p.14`) · Safety banner · Limits table · Step card · Checklist item (48 px min) · Verdict badge · Status pill (Draft/Verified/Processing/Ready/Failed) · Toast · Empty state · Skeleton loaders · Confirmation dialog for destructive actions.

## 8. States and Microcopy

| Situation | Message |
|---|---|
| Not found | "I couldn't find a reliable answer in the verified catalog or documents. Try browsing the catalog or ask a senior engineer." |
| Out of scope | "I can only help with substation maintenance topics." |
| Bypass request | "I can't help with bypassing safety devices or interlocks." |
| Session expired | "Your session ended. Please sign in again." (auto refresh attempted first) |
| Rate limited | "Too many requests. Please wait a moment." |
| Upload failed | "This file couldn't be processed. Use a text-based PDF or DOCX under 25 MB." |
| Footer | "SubstationIQ is an aid, not a substitute for official procedures and permits." |

## 9. Accessibility and Responsiveness

WCAG AA contrast (check the amber banner text); never colour alone (badges have icon + text); full keyboard support with visible focus; ARIA live region for streaming; 44 px touch targets; `prefers-color-scheme` and `prefers-reduced-motion` respected; breakpoints at 640, 768, 1024.

## 10. Demo Polish Checklist

- [ ] Seed data loaded; no empty screens in the demo
- [ ] Three rehearsed scenarios: (1) limits question with structured answer, (2) guided procedure with safety gate, (3) result checker plus DGA
- [ ] Light and dark themes both checked
- [ ] Mobile screenshots for the report
- [ ] Loading skeletons and error states on every async screen
- [ ] Favicon, titles, meta tags
