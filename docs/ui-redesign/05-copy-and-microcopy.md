# 05. Copy and Microcopy

Text is half of whether a UI feels human-made. Rewrite every user-facing string in the voice below.

## Voice

- **Plain and direct.** Write the way a senior engineer would talk to a colleague on site.
- **Short sentences, active verbs.** "Isolate. Earth. Verify dead."
- **Domain terms over generic ones.** "Test sheet", "permit-to-work", "limits", "isolation", not "workflow", "insights", "magic".
- **No hype, no exclamation marks, no emoji.**
- **Never anthropomorphize the tool.** Avoid "I'm thinking…", "Oops!", "Hi there! 👋".
- **When unsure, say so plainly** and tell the user what to do next.

## Words to avoid

`Supercharge`, `Unlock`, `Seamless`, `Effortless`, `Powerful`, `Leverage`, `Insights`, `Intelligent assistant`, `Delve`, `Let's dive in`, `Oops`, `Whoops`, `Magic`, `AI-powered` (in the UI chrome), and decorative sparkle or robot icons.

## Brand and app chrome

| Where | Current | New |
|-------|---------|-----|
| Wordmark | `⚡ SubstationIQ` | `SubstationIQ` (typographic, no emoji) |
| Tagline (login) | long README-style sentence | `Test procedures, limits and standards for substation maintenance.` |
| Page `<title>` | generic | `Ask · SubstationIQ`, `Catalog · SubstationIQ`, etc. |
| Footer | `SubstationIQ is an aid, not a substitute for official procedures and permits.` | Keep as is |

## Section labels (answer sheet)

| Current (with emoji) | New |
|----------------------|-----|
| 🦺 Safety | `SAFETY BEFORE YOU START` |
| 🧪 Test equipment | `INSTRUMENTS` |
| 📝 Procedure | `PROCEDURE` |
| 📏 Acceptable limits | `ACCEPTABLE LIMITS` |
| 📚 Standards | `STANDARDS` (or fold into the header line) |
| 🛠️ If values are outside limits | `IF OUTSIDE LIMITS` |
| Sources | `SOURCES` |

## Safety text

Keep the fixed notice, but format it as imperative lines:

> Isolate. Earth. Verify dead. Permit-to-work in place. PPE on.
> This is a reminder, not your site procedure. Follow your utility's safety rules.

(Confirm the final wording with a safety-qualified person from your target organization.)

## Streaming status lines

| Current | New |
|---------|-----|
| Understanding question… | (remove) |
| Searching catalog and manuals… | `Checking test catalog…` |
| Writing answer… | `Reading manuals…` (then just the sheet filling in) |

Use one muted line at a time and replace it as the stage changes.

## Empty states

| Screen | Copy |
|--------|------|
| Ask | Heading: `What do you need to check?` Then 4 to 6 real example queries (below) |
| Catalog (no results) | `No tests match these filters.` + `Clear filters` |
| History | `Nothing here yet. Ask a question or start a procedure.` |
| Procedures | `No runs yet. Start one from any test in the catalog.` |
| Admin, documents | `No documents uploaded.` + `Drop a PDF, DOCX or TXT file, or choose a file.` |
| Admin, unanswered | `No unanswered questions this period.` |

### Example queries (empty state of Ask)

Write them the way technicians type, with abbreviations and context:

- `IR value low on 132 kV CT after rain, what next?`
- `Acceptable contact resistance, 220 kV SF6 breaker`
- `Instruments needed for tan delta on a CVT`
- `Which standard covers DGA interpretation for transformers?`
- `Leakage current high on surge arrester`
- `PI test steps, power transformer`

Pair each with a small muted intent label (`Troubleshooting`, `Limits`, `Equipment`, `Standards`, `Troubleshooting`, `Procedure`).

## System states

| Situation | Message |
|-----------|---------|
| Not found | `No reliable answer found in the verified catalog or documents. Browse the catalog, or ask a senior engineer.` |
| Out of scope | `SubstationIQ only covers substation maintenance.` |
| Bypass request | `This tool can't help bypass safety devices or interlocks.` |
| Low confidence | `Low confidence. Check this against the OEM manual before acting.` |
| Session expired | `Your session has ended. Sign in again.` |
| Rate limited | `Too many requests. Wait a moment and try again.` |
| Upload failed | `This file couldn't be processed. Use a text-based PDF or DOCX under 25 MB.` |
| Network error | `Can't reach the server. Check your connection and try again.` |
| Generic error | `Something went wrong on our side. Try again, or report it from the Help link.` |

## Buttons and actions

| Current style | New |
|---------------|-----|
| Send | `Ask` |
| Start guided procedure | `Start guided run` |
| Explain simply | `Explain simply` (keep) |
| Thumbs up / down icons | `Helpful?  Yes / No` text links |
| Submit | Use the specific verb: `Submit for verification`, `Approve`, `Return with comment`, `Export PDF` |
| Cancel | `Cancel` (keep). Destructive confirms name the object: `Delete "Transformer SOP.pdf"` |

## Field labels and helper text

- Always visible labels. Use specific names: `Measured value`, `Unit`, `Ambient temperature (°C)`, `Winding temperature (°C)`.
- Helper text says what to do: `Enter the value as read from the instrument.`
- Required: write `required` in muted text next to the label.
- Errors say what is wrong and how to fix it: `Value must be a number.`, `Choose a test first.`

## Verdict text

| Verdict | Label | Supporting line |
|---------|-------|-----------------|
| Within | `WITHIN LIMIT` | `Meets the limit of <limit> <unit> (<standard>).` |
| Borderline | `BORDERLINE` | `Close to the limit of <limit>. Repeat the test and trend against previous readings.` |
| Outside | `OUTSIDE LIMIT` | `Exceeds the limit of <limit>. See probable causes below.` |

Values in these lines are filled from the catalog, never typed by hand in the UI.

## Units and number formatting

- Use proper symbols: `MΩ`, `°C`, `kV`, `µA`, `ppm`. Put a thin space between value and unit (`1000 MΩ`).
- Use `≥`, `≤`, `±` instead of `>=`, `<=`, `+-`.
- Do not localize or round numbers on the frontend. Display what the backend returns.

## Hindi and English (if enabled later)

- Keep the domain terms and units in English even in Hindi UI (for example insulation tester, MΩ, DGA, SFRA) unless an official translation exists in the target utility's documentation.
- Leave extra room in components: Devanagari needs more line height (1.7) and may be longer.

## Copy review checklist

- [ ] No emoji anywhere in the UI
- [ ] No exclamation marks
- [ ] No filler words from the "avoid" list
- [ ] Every error says what to do next
- [ ] Every button uses a specific verb
- [ ] Domain terms are used correctly and consistently
- [ ] Safety wording reviewed by a qualified person
