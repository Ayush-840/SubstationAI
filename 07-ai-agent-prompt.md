# 07. Prompt for an AI Coding Agent

Use this with Claude Code, Cursor, Copilot or similar. Put this whole folder in the repo first (for example `docs/ui-redesign/`). Then paste the prompt below.

---

## Master prompt

```text
You are redesigning the frontend of SubstationIQ (React 18 + Vite + TypeScript + Tailwind) so it looks and feels hand-designed for substation maintenance engineers, not like a generated SaaS template.

Read these files in order before writing any code:
  README_.md
  docs/ui-redesign/01-design-direction.md
  docs/ui-redesign/02-design-tokens.md
  docs/ui-redesign/03-components.md
  docs/ui-redesign/04-screens.md
  docs/ui-redesign/05-copy-and-microcopy.md
  docs/ui-redesign/06-implementation-plan.md

Hard rules:
1. Visual and copy changes only. Do NOT change backend code, API contracts, routes, auth, or data models.
2. Do NOT remove or break any feature or flow (Ask, Catalog, Guided Procedure, Result Checker, DGA, Learn, History, Catalog Editor, Admin).
3. Safety content stays prominent and non-collapsible. Never reduce its visibility.
4. Display limits, units and standard codes exactly as returned by the backend. Never round, reformat or invent numbers. Never invent Duval triangle boundaries; use the verified data in the catalog and ask me if it is missing.
5. Follow the design tokens exactly. No hard-coded hex values outside tokens.css, no default Tailwind palette classes, no emoji in the UI, no gradients except the hazard stripe, no shadows except overlays, radius <= 4px.
6. Accessibility must not regress: WCAG AA, visible focus, keyboard support, state never by color alone, prefers-reduced-motion respected.

Process:
- Phase 0 first: audit the actual frontend (the planning docs were written without seeing the source). Produce docs/ui-redesign/AUDIT.md with the scan counts from 06-implementation-plan.md, a component inventory, and a mapping from existing components to the new ones. Show me this before continuing.
- Then work phase by phase (1 to 7). At the end of each phase: run the build and tests, run the scan commands, commit with a clear message, and give me a short summary of what changed, what you were unsure about, and what you skipped.
- If the repo's reality differs from the docs (different libraries, paths, component names), adapt and tell me what you changed and why.
- If something is ambiguous or needs a product or safety decision (for example the exact wording of the safety notice), ask instead of guessing.
- Keep diffs reviewable: one concern per commit.

Definition of done: the master acceptance checklist at the end of 06-implementation-plan.md is fully ticked, before/after screenshots are saved in docs/ui-redesign/, and the final de-AI pass (Phase 7) is complete.

Start with Phase 0 now.
```

---

## Shorter prompts for individual phases

### Tokens and themes only

```text
Implement Phase 1 from docs/ui-redesign/06-implementation-plan.md using docs/ui-redesign/02-design-tokens.md. Replace (don't extend) the Tailwind color, radius, shadow and font config, add tokens.css with Light/Dark/Outdoor themes, self-host IBM Plex fonts, and add a theme switcher with no flash on load. Fix build or visual breakage by mapping old classes to tokens, never by restoring the old palette. Report the scan counts before and after.
```

### Answer sheet only

```text
Implement Phase 3. Replace the current structured answer card with a TestSheet component per docs/ui-redesign/03-components.md section 1: single container, ruled sections, hazard-stripe safety block first and never collapsible, plain-text instruments, hanging step numerals, a large mono limits table with a stacked mobile layout, superscript footnote citations with a Sources list, confidence shown only when low, and conditional sections (omit empty ones). Reuse it on the Test detail page and add the print stylesheet. Do not change what data is shown, only how.
```

### Copy only

```text
Implement Phase 5. Move scattered UI strings into one resource file and rewrite every string using docs/ui-redesign/05-copy-and-microcopy.md. Remove all emoji and exclamation marks, use specific button verbs, and make every error message say what to do next. List any string you were unsure about.
```

### Duval triangle only

```text
Implement the DGA triangle from docs/ui-redesign/04-screens.md section 7 as inline SVG. Use the zone boundary polygons from the verified catalog data; if they are not in the repo, stop and ask me rather than approximating them. Convert percentages to coordinates with barycentric weights, add axis ticks, zone labels, a ring marker with leader label, and a text alternative for screen readers. Test with at least three known reference points and show the results.
```

### Final review

```text
Run Phase 7. Re-run all scan commands and report counts against the targets (emoji 0, large radius 0, gradients 1 for the hazard stripe, default palette classes 0, hard-coded hex 0 outside tokens.css). Review each screen against the master acceptance checklist, list anything that still looks templated or purely decorative, and propose specific removals. Do not make changes until I approve the list.
```

---

## Tips for getting good results from the agent

- **Review the Phase 0 audit before approving the rest.** Everything else depends on it being accurate.
- **One phase per session** keeps context focused and diffs small.
- **Ask for screenshots** (or use a Playwright script) at each phase so you can judge the look, since code review alone won't show whether it feels designed.
- **Don't let it "improve" the tokens.** If the agent proposes adding gradients, glow, larger radii or a second accent, decline.
- **Keep a human in the loop for safety text and for the Duval boundary data.** These are not purely design decisions.
