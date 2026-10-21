# 04. Screens

Screen-by-screen layout instructions. Information architecture and flows stay as in `DESIGN.md` sections 2 and 3. Only the visual treatment changes. Components referenced are defined in `03-components.md`.

## Global shell

### Desktop (>= 1024 px)

- **Left sidebar, 240 px:** wordmark at top, text navigation (Ask, Catalog, Procedures, Tools, Learn, History, plus role-gated items), theme control and user menu at the bottom. Background `--bg`, separated from the workspace by a 1 px `--rule` line. No card styling.
- **Workspace:** max readable width 760 px for chat and sheets, left-aligned in the available space (not centered). Wide tools (DGA, Admin tables) use the full width.
- **Sources panel, 360 px, right:** opens when a citation is clicked, 1 px left rule, same background as the workspace. Closes with a visible `Close` text button and the Esc key.
- **Footer line:** the standard disclaimer in 14 px muted text, on one line at the bottom of the workspace.

### Tablet (768 to 1023 px)

- Sidebar collapses to a drawer opened by a labeled `Menu` button.
- Sources open as a right drawer, 80% width.

### Mobile (< 768 px)

- Bottom bar: Ask, Catalog, Procedures, More (4 items, text labels).
- Sources open as a bottom sheet, up to 85% height, with a drag handle and a `Close` button.
- Sticky composer above the bottom bar. Safe-area insets respected.
- Sheet panels lose their outer border and run edge to edge with 16 px padding.

---

## 1. Login, register, reset

- Two-column layout on desktop, single column on mobile. **Not** a centered card on a gradient.
- Left (or top on mobile): wordmark, one plain sentence of purpose ("Test procedures, limits and standards for substation maintenance."), and a small single-line-diagram line illustration. No stock photos and no abstract blobs.
- Right: the form (see Forms in `03-components.md`). Demo credentials, if shown, go in a clearly labeled monospace block marked `Demo accounts`, visible only when the app runs in demo mode.
- Footer: the disclaimer.

## 2. Ask (chat)

### Empty state

- Heading in display font: `What do you need to check?`
- Under it, the equipment filter (segmented row).
- Then a **plain list of 4 to 6 real example queries**, each a text link with the intent in muted text beside it, for example:
  - `IR value low on 132 kV CT after rain, what next?` · Troubleshooting
  - `Acceptable contact resistance, 220 kV SF6 breaker` · Limits
  - `Instruments needed for tan delta on a CVT` · Equipment
- No suggestion cards, no icons, no "Hi, I'm your AI assistant" greeting.

### Conversation

- User messages: right-aligned plain text with a 1 px border, 4 px radius, max width 80%. No colored bubbles.
- Assistant messages: **no bubble**. The answer renders full width as a Test Sheet (component 1) or as plain prose for short replies. No avatar and no robot icon.
- Time and model details live in a small muted line below, collapsed behind a `Details` link.
- Streaming state: show only a single muted status line, `Checking test catalog…`, then `Reading manuals…`, then the sheet fills in. Reserve space to prevent layout jumps.
- Not-found and out-of-scope replies: a plain bordered note (see `05-copy-and-microcopy.md`).
- Composer fixed at the bottom (component 10).

## 3. Catalog

- Top: page title (display font), a one-line search field full width, then the equipment segmented row.
- Filters (category, and status for engineers and admins) sit in a single inline row of selects on desktop and in a `Filters` sheet on mobile.
- **List as a table**, not cards: columns Test · Equipment · Category · Standard · Status (engineers and admins). Sortable headers with an arrow glyph. Row height 56 px, whole row clickable, hover highlight is `--surface-sunken`.
- Pagination as plain `Previous · Page 2 of 9 · Next` text controls.
- On mobile, rows stack: test name large, equipment and standard below.

## 4. Test detail

- Identical to the Test Sheet component, with one addition in the header: `Verified by <name> · <date>` as plain text with a check icon in `--success`.
- Right-aligned action row: `Start guided run`, `Check a result`, `Print`.
- Print stylesheet: hide navigation, keep header, safety, procedure, limits, sources. Black on white, 12 pt. This should print like a real test sheet.

## 5. Guided procedure

### Safety gate (first step)

- Full-width page with the **hazard stripe** at the top.
- Title: `Before you start: <Test name>`.
- A list of mandatory checks, each a **row with a 56 px checkbox** and the check text at 18 px. Rows separated by 1 px rules.
- `Continue` button disabled until all are ticked, with the helper text `Tick every item to continue.` next to it.
- Timestamp recorded when the last box is ticked (shown later in the PDF).

### Step view

- A thin text progress line at the top: `Step 4 of 12`, plus a 4 px progress bar, no rounded ends.
- One step per screen on mobile; on desktop, the current step is large with the previous and next steps visible but muted.
- Step number in large mono at the left margin; step text at 20 px.
- Source as a footnote superscript, and a `Flag an issue` text button and `Done` primary button (min 56 px) at the bottom, one-handed reachable.
- Note field is a collapsed `Add note` text link that expands inline.

### Summary

- Rendered as a **completed job card**: header (test, equipment, date, operator), table of steps with Done / Flagged and any notes, safety confirmations with timestamps, `Export PDF` button.
- The PDF layout matches this card (use the same print stylesheet).

## 6. Result Checker

- Two columns on desktop: form on the left (max 420 px), result on the right. Single column on mobile, with the result below the form and the page scrolling to it after submit.
- Form: Equipment, Test, Parameter, Value + Unit (combined control), Conditions (temperature etc.).
- Result: the verdict stamp (component 5), then the definition list (Value entered, Limit applied, Condition, Source), then, if outside or borderline, a `Probable causes and actions` list in sheet style.
- If no applicable limit is found, show the plain not-found note. Do not guess a verdict.

## 7. DGA tool (Duval triangle)

- Left column: gas inputs in ppm (H2, CH4, C2H6, C2H4, C2H2, CO, CO2) as a compact two-column form with mono inputs and units. A `Calculate` primary button.
- Right: the **Duval triangle as inline SVG**, drawn cleanly.
  - Zone fills use a restrained 6-tone palette (muted, desaturated, distinguishable in grayscale), zone labels (PD, T1, T2, T3, D1, D2, DT) in mono at the polygon centers, 1 px `--ink` outlines.
  - Axis tick labels along each edge in mono at every 10 or 20%.
  - The result point is a 10 px ring with a crosshair and a leader line to a label `CH4 x% · C2H4 y% · C2H2 z%`.
  - **Zone boundary polygons must come from the verified standard data (IEC 60599 / IEEE C57.104 guidance as stored in the catalog).** Do not approximate boundaries from memory.
  - Convert the percentages to coordinates with barycentric weights: `P = (a·A + b·B + c·C) / 100` where A, B, C are the triangle's vertex positions and a, b, c are the percentages.
- Below the triangle: interpretation text, the standard reference as a footnote, a link to troubleshooting, and the disclaimer.
- Provide a text alternative (zone name and percentages) for screen readers.

## 8. Learn

- Topic list as a plain table-of-contents style list (equipment, then topic), with progress shown as `3 of 5 done` text.
- Explanation panel in a reading layout (60 to 75 characters per line, serif display for titles).
- Quiz: one question per screen, the question at 20 px, options as large 56 px rows with radio inputs (not cards). After answering, show `Correct` or `Not quite` with the explanation and source footnote, and a `Next` button.
- Progress: a simple bar chart or table, in tokens only, no confetti and no streak badges.

## 9. History

- A table: Date · Question or procedure · Equipment · Outcome, with search. Procedure runs show Done / Flagged counts and a PDF link.
- Rows open the original conversation or run.

## 10. Catalog Editor (engineer, admin)

- Tabbed form: Basics · Steps · Instruments · Limits · Standards · Troubleshooting · Safety.
- Tabs as a text row with a 2 px bottom rule for the active tab.
- Steps tab: draggable list with visible drag handles (a six-dot grip), numbers in mono, and keyboard reordering (Alt+Up/Down).
- Limits tab: table-style editor, each row with mandatory Source field marked `Required`. Rows missing a source show an inline error and block submission.
- Status: text with dot (`● Verified`, `○ Draft`) in the header, and `Submit for verification` as the primary button.

## 11. Admin

- **Documents:** upload as a bordered drop area with a dashed 1 px `--ink` outline and the text `Drop a PDF, DOCX or TXT file, or choose a file`. Table below: File · Type · Equipment · Status · Added · Delete. Live progress via a static text status and a thin progress line.
- **Verification queue:** two-column compare view. Left, the draft as a Test Sheet; right, the source passage. Changed fields flagged with a 3 px left rule in `--hazard`. `Approve` (primary) and `Return with comment` (secondary).
- **Analytics:** a row of four plain figures (big mono number, small label under it, no card backgrounds), then simple line and bar charts in `--primary` and `--ink` only with direct labels instead of legends, then the unanswered-queries table.
- **Evaluation:** latest run metrics as a table with target and result columns; ablation table below. Failing metrics use `--danger` text + icon.
- **Users:** a table with role selector inline and a confirmation dialog on role change.

## Cross-screen consistency rules

- Page title (display font, 28 px) + one-line description in muted text at the top of every page except Ask.
- One primary action per screen.
- Tables for lists, sheets for content, forms for input. Don't default everything to cards.
- Keep the vertical rhythm on a 4-pt grid. Section gaps 32 or 48 px.
- Every async screen has an error state and a static loading state.
