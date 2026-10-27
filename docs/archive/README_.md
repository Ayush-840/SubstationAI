# SubstationIQ UI Redesign: Instruction Pack

Goal: make the SubstationIQ frontend look and feel **hand-designed for substation engineers**, not like a generated SaaS template.

> **Important note.** These instructions were written from the repo README and `DESIGN.md`. The `frontend/` source was not readable at the time, so the files tell you to **audit the real code first** (Step 0 in `06-implementation-plan.md`) and adapt names and paths to what actually exists.

## Files, in reading order

| # | File | What it contains |
|---|------|------------------|
| 0 | `README.md` | This index and the ground rules |
| 1 | `01-design-direction.md` | Why the UI looks AI-made, the new design concept, principles, references |
| 2 | `02-design-tokens.md` | Colors (light / dark / outdoor), fonts, spacing, radius, CSS variables, Tailwind config |
| 3 | `03-components.md` | Component-by-component redesign (answer card, citations, safety block, badges, tables, buttons, forms) |
| 4 | `04-screens.md` | Screen-by-screen layout instructions (Ask, Catalog, Procedure, Checker, DGA, Learn, Editor, Admin, Login) |
| 5 | `05-copy-and-microcopy.md` | Rewrite of all UI text in plain domain language |
| 6 | `06-implementation-plan.md` | Phased task list, audit commands, acceptance checklist, QA |
| 7 | `07-ai-agent-prompt.md` | Ready-to-paste prompt for Claude Code / Cursor / Copilot to execute the plan |

## Ground rules (apply to every file)

1. **Do not change backend, API contracts, routes, auth or data models.** This is a visual and copy redesign only.
2. **Do not remove features.** Every flow in `DESIGN.md` section 3 must still work.
3. **Safety content stays prominent and uncollapsible.** Never reduce the visibility of safety information while "cleaning up".
4. **Numbers are sacred.** Limits, units and standard codes display exactly as the backend returns them. Never reformat, round or invent values.
5. **Accessibility does not regress.** WCAG AA minimum, never rely on color alone, keyboard support, visible focus, `prefers-reduced-motion`.
6. **Less decoration, more structure.** If a visual element does not help someone find, read or trust information, delete it.

## How to use this pack

- **Doing it yourself:** read files 01 to 05, then follow 06 phase by phase.
- **Using an AI coding agent:** put this whole folder in the repo (for example `docs/ui-redesign/`) and paste `07-ai-agent-prompt.md` into the agent.
