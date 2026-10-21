# 06. Implementation Plan

Phased tasks, commands and acceptance criteria. Paths assume the structure in the repo README (`frontend/` with React 18, Vite, TypeScript, Tailwind). **Verify real paths in Step 0 and adapt.**

Work on a branch: `git checkout -b ui/redesign-test-sheet`. Commit at the end of each phase.

---

## Phase 0: Audit (do not skip)

The frontend source was not reviewed when this pack was written, so confirm what is actually there.

```bash
cd frontend
cat package.json                         # versions, UI libraries (shadcn? MUI? Radix?)
ls src src/components src/pages 2>/dev/null
cat tailwind.config.* postcss.config.* 2>/dev/null
grep -rn "className" src | wc -l         # size of the migration
```

Run the "AI tell" scan and record the counts in `docs/ui-redesign/AUDIT.md`:

```bash
# Emoji in source
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{FE0F}]" src | wc -l

# Large radius, shadows, gradients, blur
grep -rnE "rounded-(xl|2xl|3xl|full)" src | wc -l
grep -rnE "shadow-(md|lg|xl|2xl)" src | wc -l
grep -rnE "bg-gradient|from-|to-|backdrop-blur" src | wc -l

# Default palette usage
grep -rnE "(bg|text|border)-(blue|indigo|violet|purple|sky|slate|gray|zinc|neutral)-[0-9]{2,3}" src | wc -l

# Hard-coded colors
grep -rnE "#[0-9a-fA-F]{3,8}\b" src | wc -l
```

Also take **before screenshots** (desktop and mobile, light and dark) of: Ask (empty and answered), Catalog, Procedure, Result Checker, DGA, Admin.

**Acceptance:** `AUDIT.md` exists with counts, a component inventory, and before screenshots.

---

## Phase 1: Foundations (tokens, fonts, themes)

1. Install fonts: `npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/newsreader` and import them (see `02-design-tokens.md`).
2. Create `src/styles/tokens.css` with the CSS variables for Light, Dark and Outdoor and import it in `main.tsx` before other styles.
3. Replace `tailwind.config` colors, radius, shadow and fonts with the token-mapped config (replace, not extend).
4. Add the theme switcher: sets `data-theme` on `<html>`, persisted in `localStorage`, with a tiny inline script in `index.html` that applies it before paint.
5. Set global styles: body font, `tabular-nums` utility, focus ring, `prefers-reduced-motion` guard.
6. Build `npm run dev` and fix compile or visual breakage caused by the removed default colors. Don't re-add the old palette. Map each case to a token.

**Acceptance:**
- App renders in the three themes, no flash on load.
- `grep` for default-palette classes trends toward zero (record the number).
- Fonts load offline (check with the network disabled).

---

## Phase 2: Core components

Implement or restyle, in this order (see `03-components.md`):

1. `Button`, `Link`, form controls (`Input`, `Select`, `Checkbox`, `Field`)
2. `SectionLabel` (uppercase label with top rule)
3. `SafetyBlock` (hazard stripe)
4. `LimitsTable` (with the mobile stacked layout)
5. `Citation` (superscript) and `SourcesList`, then wire the sources panel and bottom sheet
6. `VerdictStamp`
7. `StatusText` (dot + label)
8. `EquipmentFilter` (segmented row with custom glyphs)
9. `Dialog`, `Toast`, `EmptyState`, `Placeholder` (static)
10. `Wordmark` and favicon

Create a `/dev/components` page (hidden in production) that renders each component in all themes and states for visual review.

**Acceptance:**
- Each component passes the component checklist in `03-components.md` section 15.
- No emoji, no default-palette classes, no radius above 4 px in `src/components`.

---

## Phase 3: The answer sheet

1. Build `TestSheet` from the components above and replace the existing answer card.
2. Make section rendering **conditional on data**. Omit empty sections and don't render empty headings.
3. Replace citation chips with superscripts and the Sources list.
4. Confidence indicator only when below threshold.
5. Streaming: fade-in of text, reserved section structure, one muted status line.
6. Implement the print stylesheet and reuse `TestSheet` on the Test detail page.

**Acceptance:**
- Compare with a real printed test sheet. It should be recognizably in the same family.
- Limits table readable on a 360 px wide phone without horizontal scroll.
- Safety block is the first strong element on the sheet, in all three themes.

---

## Phase 4: Screens

Go in this order, applying `04-screens.md`:

1. App shell (sidebar, mobile bottom bar, sources panel/sheet)
2. Ask (empty state, conversation, composer)
3. Catalog (table) and Test detail
4. Guided procedure (safety gate, step view, summary, PDF)
5. Result Checker
6. DGA (SVG triangle using verified zone data)
7. Learn and History
8. Catalog Editor
9. Admin
10. Login, register, reset

After each screen: capture an after screenshot, delete leftover decoration, and run the scan commands from Phase 0.

**Acceptance:** all flows in `DESIGN.md` section 3 (A to G) complete end to end with no visual or functional regressions.

---

## Phase 5: Copy

1. Move all UI strings into one file (for example `src/copy.ts` or your i18n resource) if they are scattered.
2. Apply `05-copy-and-microcopy.md` to every string.
3. Update page titles, meta description, favicon and the Open Graph image (a plain typographic card, not a gradient).

**Acceptance:** copy checklist at the end of `05-copy-and-microcopy.md` fully ticked.

---

## Phase 6: Accessibility and field-readiness QA

Run each check and record results in `docs/ui-redesign/QA.md`.

| Check | How | Pass criteria |
|-------|-----|---------------|
| Contrast | axe DevTools or Lighthouse, plus manual check of every token pair | AA everywhere, outdoor theme >= 7:1 |
| Keyboard | Tab through every screen | All controls reachable, visible focus, no traps |
| Screen reader | NVDA or VoiceOver on Ask and Guided Procedure | Streaming uses a live region, citations have labels, verdicts read as text |
| Color independence | Grayscale screenshot | Every state still distinguishable |
| Touch targets | Chrome mobile emulation | >= 44 px generally, >= 56 px for safety gate and Done |
| Reduced motion | Enable OS setting | No animation except instant state changes |
| Outdoor | Phone outdoors, or max brightness + glare simulation | Safety block and limit values readable at arm's length |
| Print | Print Test detail and procedure summary to PDF | One clean page, no UI chrome |
| Responsive | 360, 768, 1024, 1440 px | No horizontal scroll (except explicit wide tables), no overlap |
| Performance | Lighthouse mobile | No regression versus Phase 0 baseline; fonts self-hosted |

---

## Phase 7: Final de-AI pass

Do this last, with fresh eyes.

1. Re-run all Phase 0 scans. Targets: emoji = 0, large radius = 0, gradients = 1 (hazard stripe only), default palette classes = 0, hard-coded hex = 0 outside `tokens.css`.
2. Look at each screenshot side by side with the "before" set and with your reference collection. Ask:
   - Would someone guess this was built from a template?
   - Is anything here purely decorative? Remove it.
   - Does any screen look like another screen with different text? Vary its rhythm.
3. Remove 20% of visual decoration anywhere that remains.
4. Ask one real technician or engineer to try three tasks and watch silently. Fix what slows them.

**Acceptance:** all targets met, QA log complete, before/after screenshots committed to `docs/ui-redesign/`.

---

## Master acceptance checklist

- [ ] No emoji in the UI
- [ ] Single accent color, semantic colors used only for meaning
- [ ] IBM Plex (or the chosen pair) everywhere, values in mono with tabular numbers
- [ ] Radius <= 4 px, no shadows except overlays
- [ ] No nested cards, with sections separated by rules and whitespace
- [ ] Answer rendered as a Test Sheet with footnote citations
- [ ] Safety block is hazard-striped, first, and never collapsible
- [ ] Verdicts are stamps with icon + text + color
- [ ] Light, Dark and Outdoor themes all verified
- [ ] Copy rewritten in plain domain language
- [ ] Backend, API contracts and features untouched
- [ ] Accessibility checks pass
- [ ] Before/after screenshots saved

## Risks and how to handle them

| Risk | Mitigation |
|------|------------|
| UI library (for example shadcn/MUI) fights the new tokens | Override at the theme layer; wrap components in your own thin components rather than patching each use |
| Removing the default palette breaks many classes at once | Migrate screen by screen using the build errors and the scan commands as a to-do list |
| Duval triangle geometry looks right but is wrong | Use boundary data from the verified standard source in the catalog; test with known reference points |
| Redesign accidentally reduces safety visibility | Safety block is a must-keep. Review each screen against this rule |
| Scope creep into backend changes | Out of scope. Log requests in `docs/ui-redesign/FOLLOWUPS.md` |
