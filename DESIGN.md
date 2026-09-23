# DESIGN — SubstationIQ UI/UX Specification

Version 1.0 · Companion to PRD.md and TRD.md

---

## 1. Design Principles

1. **Safety first, visibly.** Safety notices are never buried; they are high-contrast and impossible to miss.
2. **Trust through sources.** Every answer shows where it came from, one tap away.
3. **Field-ready.** Large touch targets, readable in bright light, usable with gloves on a phone or tablet.
4. **Calm and industrial.** A clean, utility-grade look, not a flashy chatbot.
5. **Fast to first answer.** Suggested prompts and quick modes reduce typing.

## 2. Information Architecture

```
Login
└── App Shell
    ├── Chat (default)           ← Q&A mode
    ├── Guided Procedures        ← checklist mode
    ├── Fault Diagnosis          ← symptom mode
    ├── History                  ← saved conversations and completed checklists
    └── Admin (admin only)
        ├── Documents
        ├── Analytics
        └── Evaluation
```

## 3. Key User Flows

**Flow A — Quick question**
Open app → pick equipment chip (optional) → type or tap a suggested question → streamed answer with citation chips → tap a chip to see the source snippet and page → thumbs up/down.

**Flow B — Guided procedure**
Procedures tab → choose equipment and task (e.g. *Transformer → Buchholz relay inspection*) → review safety preconditions → tick each safety step → step-by-step cards with sources → completion summary → export PDF.

**Flow C — Fault diagnosis**
Diagnosis tab → select equipment → enter symptoms and readings → ranked causes with confidence and sources → "Start procedure for this check" shortcut.

**Flow D — Admin upload**
Admin → Documents → drag and drop file → set title, type, equipment → progress state (Processing → Ready) → appears in the knowledge base.

## 4. Layout

### Desktop (≥ 1024 px)
```
┌──────────────┬───────────────────────────────────────┬────────────────┐
│ Sidebar      │  Chat / Main panel                    │ Sources panel  │
│ - Logo       │  - Equipment filter chips             │ - Cited chunks │
│ - New chat   │  - Message list                       │ - Doc name     │
│ - Modes      │  - Composer                           │ - Page         │
│ - History    │                                       │ - Snippet      │
└──────────────┴───────────────────────────────────────┴────────────────┘
```

### Mobile (< 768 px)
- Bottom tab bar: **Chat · Procedures · Diagnose · History**
- Sources open as a bottom sheet.
- Composer is sticky at the bottom with a mic button.

## 5. Screens

### 5.1 Login
Centered card, logo, email, password, primary button. Below: "Demo credentials" hint (for evaluators).

### 5.2 Chat
- **Header:** equipment filter chips (All, Transformer, Breaker, Isolator, CT/PT, Relay, Battery).
- **Empty state:** greeting plus 4 suggested prompts, e.g.
  - "Pre-commissioning checks for a 132 kV circuit breaker"
  - "What are the causes of high oil temperature in a transformer?"
  - "Steps to safely isolate a feeder"
  - "How often should battery bank tests be done?"
- **Assistant message:** answer text, inline citation chips `[1]`, confidence badge, action row (copy, thumbs up/down, "Open as procedure").
- **Safety banner** (when triggered) above the answer, amber/red.
- **Composer:** multiline input, send button, mic icon, attach disabled for non-admin.
- **Streaming state:** blinking caret and a subtle "Searching manuals…" then "Writing answer…" status line.

### 5.3 Guided Procedure
- Top: title, equipment, progress bar (Step 3 of 12).
- **Safety gate card:** list of mandatory checks with large checkboxes; "Continue" disabled until all ticked.
- **Step card:** step number, instruction, source chip, "Done" and "Flag issue" buttons, optional note field.
- **Summary:** time taken, notes, flagged issues, "Export PDF".

### 5.4 Fault Diagnosis
- Form: equipment dropdown, symptom text area, optional readings (oil temperature, gas values, load %).
- Result: ranked list of cause cards with likelihood bar, recommended checks, sources; disclaimer footer.

### 5.5 History
Searchable list with date, title, mode icon; tabs for Chats and Completed Procedures.

### 5.6 Admin — Documents
Table: title, type, equipment, status pill, pages, uploaded by, date, delete. Upload drop zone at top.

### 5.7 Admin — Analytics and Evaluation
Cards: total queries, average rating, unanswered rate. Charts: top questions, unanswered list, retrieval and faithfulness metrics from the latest eval run.

## 6. Visual Design Tokens

### Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F6F8FA | #0E1621 | App background |
| `--surface` | #FFFFFF | #16212E | Cards |
| `--border` | #DDE3EA | #263547 | Dividers |
| `--text` | #14202B | #E6EDF5 | Primary text |
| `--text-muted` | #5B6B7B | #9FB0C1 | Secondary text |
| `--primary` | #0B5FFF | #4D8DFF | Actions, links |
| `--accent` | #00A6A6 | #2CC8C8 | Highlights, citation chips |
| `--warning` | #F5A300 | #FFB733 | Caution banners |
| `--danger` | #D92D20 | #FF6B5E | Critical safety |
| `--success` | #12A150 | #3DD68C | Completed steps |

Safety banner: amber background with a dark text and a high-voltage icon. Critical (bypass request refused): red.

### Typography
- **UI:** Inter (fallback system-ui), 16 px base on mobile, 15 px desktop.
- **Headings:** 600 weight; scale 12 / 14 / 16 / 20 / 24 / 32.
- **Code / IDs / readings:** JetBrains Mono.
- Line height 1.5 for body text.

### Spacing and shape
- 4-pt spacing scale (4, 8, 12, 16, 24, 32).
- Radius: 8 px controls, 12 px cards, 999 px chips.
- Elevation: subtle 1–2 px shadows; borders preferred over heavy shadows.

### Iconography
Lucide icons: `zap` (brand), `shield-alert` (safety), `book-open` (sources), `wrench` (procedures), `activity` (diagnosis), `history`.

## 7. Components

| Component | Notes |
|---|---|
| **Chip (filter)** | Selected state fills with primary at 12% and a primary border |
| **Citation chip** | Small pill `[1] Manual · p.14`; hover shows snippet; click opens sources panel |
| **Safety banner** | Icon, bold title "Safety first", 4–5 bullet reminders, collapsible after the first view but always present |
| **Confidence badge** | High / Medium / Low with colour and text (never colour alone) |
| **Message bubble** | User right-aligned in primary tint; assistant full width on surface with no bubble on mobile |
| **Checklist item** | 48 px min height, large checkbox, source chip on the right |
| **Status pill** | Processing (blue), Ready (green), Failed (red) |
| **Toast** | Bottom right; used for uploads, copy, export |
| **Empty state** | Illustration-free, icon plus a single line plus suggested actions |

## 8. States and Microcopy

| Situation | Message |
|---|---|
| Low confidence | "I couldn't find a reliable answer in the uploaded documents. Please check the relevant SOP or ask a senior engineer." |
| Out of scope | "I can only help with substation maintenance topics." |
| Bypass request | "I can't help with bypassing safety devices or interlocks." |
| API failure | "Something went wrong. Trying a backup model…" then retry option |
| Upload failed | "This file couldn't be processed. Try a text-based PDF or DOCX under 25 MB." |
| Footer disclaimer | "SubstationIQ is an aid, not a substitute for official procedures and permits." |

## 9. Accessibility

- WCAG AA contrast on all text and controls (verify amber banner text).
- Never rely on colour alone; badges include text and icons.
- Full keyboard navigation, visible focus ring (2 px primary outline).
- ARIA live region for streaming answers; labelled form controls.
- Touch targets at least 44 × 44 px.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.

## 10. Motion

- 150–200 ms ease-out for chip selection, sheet open, and toast.
- Streaming text appears token by token with no bounce.
- Progress bars animate width only.

## 11. Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| < 640 px | Single column, bottom tabs, sources as a bottom sheet |
| 640–1023 px | Collapsible sidebar, sources as a drawer |
| ≥ 1024 px | Three-column layout |

## 12. Branding

- **Name:** SubstationIQ
- **Logo:** a simple lightning bolt inside a rounded square, in primary blue.
- **Tagline:** "Right answer. Safe steps. Every time."

## 13. Demo Polish Checklist

- [ ] Seed data loaded so the demo never starts empty
- [ ] 3 rehearsed demo scenarios (question, guided procedure, diagnosis)
- [ ] Dark and light theme both verified
- [ ] Mobile view screenshot for the report
- [ ] Loading skeletons on every async view
- [ ] Favicon, page title, and meta tags set
