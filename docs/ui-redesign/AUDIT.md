# Phase 0 Audit — SubstationIQ UI Redesign

Source of truth for Phase 0: `docs/ui-redesign/06-implementation-plan.md`.

This audit was produced against the real `frontend/` source, not the planning docs alone. The pack itself warns that the frontend was not read when the docs were written, so this file records what actually exists and where the plan needs to be adapted.

---

## 1. What “Phase 0” requires, in plan language

From `06-implementation-plan.md`, Phase 0 acceptance is:

- Run the “AI tell” scan and record the counts in `docs/ui-redesign/AUDIT.md`.
- Also take **before screenshots** of: Ask empty, Ask answered, Catalog, Procedure, Result Checker, DGA, Admin, in desktop and mobile, light and dark.
- **Acceptance:** `AUDIT.md` exists with counts, a component inventory, and before screenshots.

So this file is only complete when the screenshots exist too.

---

## 2. Files staged for the pack

- `docs/ui-redesign/README.md`
- `docs/ui-redesign/README_.md`
- `docs/ui-redesign/01-design-direction.md`
- `docs/ui-redesign/02-design-tokens.md`
- `docs/ui-redesign/03-components.md`
- `docs/ui-redesign/04-screens.md`
- `docs/ui-redesign/05-copy-and-microcopy.md`
- `docs/ui-redesign/06-implementation-plan.md`
- `docs/ui-redesign/07-ai-agent-prompt.md`
- `docs/ui-redesign/AUDIT.md` — this file

The prompt in `07-ai-agent-prompt.md` says to read these files in this order:

1. `docs/ui-redesign/README.md`
2. `docs/ui-redesign/01-design-direction.md`
3. `docs/ui-redesign/02-design-tokens.md`
4. `docs/ui-redesign/03-components.md`
5. `docs/ui-redesign/04-screens.md`
6. `docs/ui-redesign/05-copy-and-microcopy.md`
7. `docs/ui-redesign/06-implementation-plan.md`

That order is satisfied because `docs/ui-redesign/README.md` now exists in the staged tree.

---

## 3. Step 0 inspect — what is actually in `frontend/`

- React 18, Vite, TypeScript, Tailwind 3.4.6.
- No UI kit: no shadcn, MUI, Radix, Headless UI, Lucide, class-variance-authority, clsx, tailwind-merge, or fontsource packages.
- Fonts today: `Inter` (sans) and `JetBrains Mono` (mono), loaded as web font names, not self-hosted.
- Tailwind config: `tailwind.config.js`, not `.ts`.
- Dark mode today: `darkMode: 'class'` on a `.dark` class, with colors expressed as `rgb(var(--rgb-*)/<alpha-value>)`.
- Theme toggle today: `useTheme.ts` toggles `.dark` on `document.documentElement`, and the UI uses emoji `☀️ Light` / `🌙 Dark`.
- Source files:
  - `src/App.tsx`
  - `src/api/client.ts`
  - `src/auth.tsx`
  - `src/components/common.tsx`
  - `src/context/*`
  - `src/hooks/useTheme.ts`
  - `src/index.css`
  - `src/main.tsx`
  - `src/pages/Admin.tsx`
  - `src/pages/Chat.tsx`
  - `src/pages/Diagnosis.tsx`
  - `src/pages/History.tsx`
  - `src/pages/Learn.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Procedures.tsx`
  - `src/pages/ResultChecker.tsx`
  - `src/styles/*`
  - `src/types.ts`

There is no separate Catalog frontend page in `src/pages`. Catalog-style content today lives in Chat and as cards/steps in the other pages.

---

## 4. Phase 0 scan counts

Run from `frontend/src`.

### Emoji

- Plan command: `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{FE0F}]" src | wc -l`
- Result on this machine: **0**
- Why this is misleading: this environment’s `grep` does not support `-P`, so the block regex is not really matching.
- Targeted glyph scan result: **20 lines** with emoji/pictograph glyphs.
- Emoji/pictograph locations:
  - `App.tsx`: nav icons `💬🩺🎓🕘✅⚙️`, theme toggle `☀️🌙`, mobile nav icon.
  - `components/common.tsx`: `🦺` in SafetyBanner, `⛔` in DangerBanner.
  - `pages/History.tsx`: `MODE_ICON` map and fallback.
  - `pages/Chat.tsx`: feedback thumbs `👍👎`.
  - `pages/Procedures.tsx`: `🦺` safety gate text, `⚠ flagged` labels.

### Large radius

- Command: `grep -rnE "rounded-(xl|2xl|3xl|full)" src | wc -l`
- Result: **4**
- All are `rounded-full`. None are `xl/2xl/3xl`.
- Locations:
  - `src/index.css:65`
  - `src/index.css:76`
  - `src/pages/Diagnosis.tsx:90`
  - `src/pages/Procedures.tsx:115`

### Shadows

- Command: `grep -rnE "shadow-(md|lg|xl|2xl)" src | wc -l`
- Result: **0**

### Gradients / blur

- Command: `grep -rnE "bg-gradient|from-|to-|backdrop-blur" src | wc -l`
- Result: **1**
- This is a false positive. The only match is the literal phrase “permit-to-work” in `components/common.tsx:19`, not a gradient or blur class.
- No real gradient/blur classes were found.

### Default palette classes

- Command: `grep -rnE "(bg|text|border)-(blue|indigo|violet|purple|sky|slate|gray|zinc|neutral)-[0-9]{2,3}" src | wc -l`
- Result: **0**

### Hard-coded hex

- Command: `grep -rnE "#[0-9a-fA-F]{3,8}\b" src | wc -l`
- Result in source: **1**
- Result in `index.css`: **0**
- The single hard-coded hex is `fill="#fff"` in `components/common.tsx:98`, inside `Logo`.

### Supplementary counts

- `.pill` usages: **19**
- `rounded-card` usages: **7**
- `rounded-control` usages: **5**
- Total `className` usage in `src/`: **312**

---

## 5. Component inventory

### Global shell

- `App.tsx` is the shell.
- Desktop sidebar + mobile bottom bar.
- Theme toggle in the shell.
- Admin tab gating in the shell.
- No separate sources panel exists today.

### Wordmark / logo

- `components/common.tsx::Logo`
- Inline SVG plus “SubstationIQ” text.
- The SVG hardcodes `fill="#fff"`.

### Safety

- `components/common.tsx::SafetyBanner`
- Today: amber card-style banner, emoji `🦺`, “Safety first” label.
- The plan wants: hazard stripe, 2px ink border, no emoji, never collapsible.

### Danger / out-of-scope / confidence / status / citation

- `DangerBanner`, `OutOfScopeNotice`, `ConfidenceBadge`, `StatusPill`, `CitationChip`
- Today these are pills/chips, not the stamp/dot+label/footnote shapes the plan wants.

### Chat

- `pages/Chat.tsx`
- User messages: card, max-width 80%.
- Assistant replies: `m.content` rendered into a card, with a `Sources` sub-block made of `CitationChip` components.
- Feedback: emoji thumbs.
- Streaming: blinking caret, not the plan’s 150ms text fade-in only.

### Procedures

- `pages/Procedures.tsx`
- Safety gate exists.
- Steps and runs exist.
- Progress bar uses `rounded-full`.

### Result Checker

- `pages/ResultChecker.tsx`
- Exists. Uses cards/pills.

### DGA / Diagnosis

- `pages/Diagnosis.tsx`
- Exists.
- I did not find a Duval triangle SVG implementation in the file I read.
- The plan explicitly says not to invent Duval boundaries.

### History / Learn / Admin

- Exist.
- Use cards, pills, emoji icons.

### Forms

- Built from `index.css` component classes: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.chip`, `.chip-selected`, `.input`, `.pill`.
- No dedicated `Field`/`Select`/`Checkbox` components yet.

---

## 6. Mapping: existing → planned

| Planned thing | Exists today? | Closest existing thing | Gap |
|---|---|---|---|
| Themes: Light / Dark / Outdoor + no-flash switcher | Partially | `.dark` class + RGB vars + toggle | No Outdoor theme; no `data-theme` on `<html>`; no inline no-flash script; token shape differs. |
| `tokens.css` + Tailwind replacement | Not yet | `index.css` + `tailwind.config.js` | Plan says replace, repo extends. Plan snippet assumes `.ts` config and `data-theme` selector. |
| Self-hosted IBM Plex + Newsreader (or Barlow) | Not yet | Inter + JetBrains Mono web fonts | Need `npm i @fontsource/...` and a new font stack. |
| `SectionLabel` | Not as a component | Labels exist inline | No uppercase top-rule label component. |
| `SafetyBlock` hazard stripe | Exists, wrong shape | `SafetyBanner` | Needs hazard-stripe pattern, no emoji, 2px ink border, never collapsible. |
| `LimitsTable` mono big values, stacked mobile, no zebra | Not implemented | No limits table component found | Needs a real table component with mobile stacking. |
| `Citation` superscript + `SourcesList` + sources panel/sheet | Not implemented | `CitationChip` + Sources block in Chat | Needs superscript + panel/sheet, not chips. |
| `VerdictStamp` icon + text + color | Not implemented | Pill-style status/confidence | Needs stamp, not pill. |
| `StatusText` dot + label | Not implemented | `StatusPill` | Needs dot + text. |
| `EquipmentFilter` segmented row | Not implemented in files read | Chips / intent pills | Needs segmented row with custom glyphs. |
| `Dialog`, `Toast`, `EmptyState`, `Placeholder` | Not implemented | Ad hoc UI | Needs dedicated components, static placeholders, no shimmer. |
| `Wordmark` + favicon | Exists as `Logo` | `Logo` | Needs typographic wordmark, no emoji, matching favicon. |
| `TestSheet` answer sheet | Not implemented | Per-message/reply cards + Sources block | Needs the full sheet layout. |
| Print stylesheet | Not implemented | Not seen | Needs print CSS. |
| DGA Duval triangle SVG | Not implemented in files read | `Diagnosis.tsx` exists | Needs inline SVG with verified zone data; do not invent boundaries. |
| Custom equipment glyphs (5 types) | Not implemented | Emoji icons used for nav/categories | Needs custom SVGs. |

---

## 7. Where the plan needs adaptation before use on this repo

1. **Config file name.** The plan’s Tailwind snippet says `tailwind.config.ts`. This repo has `tailwind.config.js`.
2. **Dark mode selector.** The plan wants `darkMode: ["selector", '[data-theme="dark"]']`. This repo uses `darkMode: 'class'` on `.dark`.
3. **Token shape.** The plan wants `var(--primary)` style tokens. This repo currently maps colors through `rgb(var(--rgb-*)/<alpha-value>)`.
4. **Font choice not decided yet.** The plan says pick serif display **or** condensed labels, not both. That decision should be locked before Phase 1.
5. **Icon library not installed.** The plan wants Lucide plus custom equipment SVGs. Neither exists yet.
6. **Real app is smaller than the plan’s picture.** The plan describes a richer multi-screen app with a dedicated Catalog page and a full answer-sheet flow. The current frontend is real but simpler, so some planned screens/components will be “implement” rather than “retrofit.”

---

## 8. Things I did not verify yet

- No before screenshots were taken. The dev server is live on `localhost:5173`, so screenshots are possible, but they were not captured this session.
- I did not find a separate Catalog frontend page to audit beyond Chat and the other pages.
- I did not run a browser-based accessibility tool (axe/Lighthouse) yet.
- I did not run a grayscale screenshot check yet.
- I did not check whether the backend actually serves the catalog or guided-procedure data this frontend expects, beyond the fact that the frontend build succeeds.

---

## 9. Acceptance status against Phase 0

- [x] `docs/ui-redesign/` populated from the untracked pack.
- [x] Step 0 inspect done.
- [x] Scan commands run.
- [x] Counts recorded here.
- [x] Component inventory recorded here.
- [x] Existing→new mapping recorded here.
- [ ] Before screenshots captured. **Not done.**
- [ ] `docs/ui-redesign/AUDIT.md` complete per plan acceptance. **Not fully done until screenshots exist.**

---

## 10. Recommendation

This audit is written to match the plan’s Phase 0 acceptance wording. The only remaining Phase 0 item is the before screenshots.

If you want me to finish Phase 0, the next move is to capture before screenshots from the live dev server on `localhost:5173` for:

- Ask empty
- Ask answered
- Catalog (or its front-end equivalent today)
- Procedure
- Result Checker
- DGA
- Admin

in desktop and mobile, light and dark.

After that, Phase 0 is complete and we can move to Phase 1, one phase at a time as the pack says.

---

## 11. Blocked decisions to preserve

Two decisions from the pack are not mine to make:

- Final safety wording should be confirmed by a safety-qualified person.
- Duval triangle boundaries must come from verified catalog data, or this should stop and ask rather than approximate them.

---

## 12. Phase 1 — Foundations (tokens, fonts, themes) — COMPLETED

### What was done

1. **Fonts installed:** `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@fontsource/newsreader` — self-hosted, offline-friendly.
2. **`frontend/src/styles/tokens.css` created:** CSS custom properties for Light (paper), Dark (control room), and Outdoor (sunlight) themes via `data-theme` attribute on `<html>`. Includes type scale, radius, font stacks, hazard stripe, focus ring, stream animation, and `prefers-reduced-motion` support.
3. **`tailwind.config.js` replaced:** Colors, border-radius, box-shadow, and font-family are now *replaced* (not extended) to prevent default-palette leak. Only `transparent`, `currentColor`, `white`, `black`, and the 14 token colors exist.
4. **`useTheme.ts` upgraded:** 3-way theme hook (`light` / `dark` / `outdoor` / `system`). Sets `data-theme` on `<html>`, persists in `localStorage`, listens for system media query changes. Legacy `toggle()` kept for compat.
5. **`index.html` updated:** No-flash inline `<script>` reads `localStorage` before first paint and sets `data-theme`.
6. **`main.tsx` updated:** Imports font weights (400/500/600 sans, 400/500 mono, 500 display) and `tokens.css` before `index.css`.
7. **`index.css` rewritten:** All component classes (`.btn`, `.card`, `.input`, `.chip`, `.pill`, `.section-label`, `.status-dot`, `.hazard-stripe`) mapped to CSS custom properties. No hex values. Print reset included.
8. **`components/common.tsx` rewritten:** SafetyBanner → hazard stripe + 2px ink border + imperative text, no emoji. DangerBanner → danger-bordered note with SVG icon. ConfidenceBadge → only shows when low. StatusPill → dot + label text. CitationChip → superscript footnote link. Logo → typographic wordmark with "IQ" in primary.
9. **`App.tsx` rewritten:** 3-way theme selector (`<select>`), text-only sidebar nav with 3px left-rule active indicator, no emoji anywhere.
10. **All page files migrated:** `Login.tsx`, `Chat.tsx`, `Procedures.tsx`, `Diagnosis.tsx`, `History.tsx`, `Learn.tsx`, `Admin.tsx` — all stale classes replaced.

### Post-Phase-1 audit counts

All counts run from `frontend/src`, excluding `styles/tokens.css` for hex:

| Check | Before | After |
|---|---|---|
| Emoji | 20 | **0** |
| Large radius (xl/2xl/3xl) | 0 | **0** |
| Shadow md/lg/xl/2xl | 0 | **0** |
| Gradients / blur | 0 | **0** |
| Default palette classes | 0 | **0** |
| Hard-coded hex (outside tokens.css) | 1 | **0** |
| `rgb(var(--rgb-*))` old vars | 22 | **0** |
| `text-txt` old class | 4 | **0** |
| `border-brdr` old class | 12 | **0** |
| `rounded-card/control` old | 9 | **0** |
| `bg-primary/10` old pattern | 10 | **0** |

### Acceptance

- [x] Fonts installed and imported.
- [x] `tokens.css` created with Light/Dark/Outdoor themes.
- [x] `tailwind.config.js` replaced (not extended) with token-mapped config.
- [x] Theme switcher supports 3 themes + system preference.
- [x] No-flash inline script in `index.html`.
- [x] All old classes migrated — zero audit violations.
- [x] Build succeeds cleanly (`npm run build` exits 0).

---

## 13. Phase 2 — Core components (Complete)

All Phase 2 components implemented per `03-components.md` and `06-implementation-plan.md`:

### Components Built

| Component | File | Description |
|---|---|---|
| `Button`, `Link` | [`Button.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Button.tsx) | Primary (solid --primary, --primary-ink, 48px, 4px radius), Secondary (--ink border), Tertiary (text link), Destructive (--danger), disabled with reason. |
| Form Controls | [`Forms.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Forms.tsx) | `Field` (always-visible 14px label, "required" text label, inline error with icon), `Input` (48px, 2px radius, numeric mono/tabular-nums, unit suffix support), `Select`, `Checkbox` (48px interactive row). |
| `SectionLabel` | [`SectionLabel.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/SectionLabel.tsx) | 12px uppercase, letter-spacing .08em, 1px top rule, --muted. |
| `SafetyBlock` | [`SafetyBlock.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/SafetyBlock.tsx) | 10px hazard stripe, 2px solid --ink border, 17-18px imperative notice, caution triangle SVG, never collapsible/dismissible. |
| `LimitsTable` | [`LimitsTable.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/LimitsTable.tsx) | Desktop typeset table (12px uppercase headers on --surface-sunken, 2px --rule-strong bottom rule, mono tabular values) + Mobile (<640px) stacked block layout with zero horizontal scroll. |
| `Citation` | [`Citation.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Citation.tsx) | Superscript footnote button in --primary with min 24x24 touch target and explicit aria-label. |
| `SourcesList` & `SourcesPanel` | [`Sources.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Sources.tsx) | Numbered source list with clickable document links; slide-out panel (desktop 420px right drawer, mobile bottom sheet) highlighting cited text in --hazard at 25% opacity. |
| `VerdictStamp` | [`VerdictStamp.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/VerdictStamp.tsx) | 2px border semantic stamp (WITHIN LIMIT, BORDERLINE, OUTSIDE LIMIT) with icon + text + color, definition list for values/limits, and troubleshooting list. |
| `StatusText` | [`StatusText.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/StatusText.tsx) | 8px dot + text label (Verified, Ready, Draft, Processing with progress line, Failed with reason). No background pills. |
| `EquipmentGlyphs` | [`EquipmentGlyphs.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/EquipmentGlyphs.tsx) | Custom 24px SVG single-line diagram glyphs: All (busbar/nodes), Transformer (two coils), Reactor (inductor/core), Breaker (contacts/box), CT/CVT (toroid conductor), Surge Arrester (varistor/ground). |
| `EquipmentFilter` | [`EquipmentFilter.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/EquipmentFilter.tsx) | Segmented row with custom glyphs and text labels. 2px bottom rule in --primary and --ink text when selected. Horizontal scroll on mobile. |
| Feedback | [`Feedback.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Feedback.tsx) | `Dialog` (4px radius, overlay shadow, accessible esc close), `Toast` (solid --ink bg, --bg text, 4px radius), `EmptyState` (custom line diagram mark, 1 sentence, 1 action), `Placeholder` (static bars in --surface-sunken, no shimmer). |
| `Wordmark` & Favicon | [`Wordmark.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/components/Wordmark.tsx), [`favicon.svg`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/public/favicon.svg) | Typographic SubstationIQ with "IQ" in --primary and 4px radius single-line diagram symbol. Matching SVG favicon. |
| `/dev/components` | [`DevComponents.tsx`](file:///Users/studentuse33gmail.com/Desktop/SubstationAI/frontend/src/pages/DevComponents.tsx) | Visual verification page rendering all components across Light, Dark, and Outdoor themes and all interaction states. |

### Post-Phase-2 Audit Scan

All counters run across `src/components/` and `src/`:

| Check | Target | Actual |
|---|---|---|
| Emoji in `src/components` | 0 | **0** |
| Large radius (`rounded-xl/2xl/3xl`, arbitrary >4px) in `src/components` | 0 | **0** |
| Shadows (`shadow-md/lg/xl/2xl`) in `src/components` | 0 | **0** |
| Gradients (`bg-gradient`) in `src/components` | 0 | **0** |
| Default Tailwind palette in `src/components` | 0 | **0** |
| Hard-coded hex in `src/components` | 0 | **0** |

### Acceptance

- [x] All Phase 2 components implemented per `03-components.md`.
- [x] No emoji, no default-palette classes, no radius above 4 px in `src/components`.
- [x] `/dev/components` visual harness created and accessible in development.
- [x] `npm run build` succeeds cleanly with 0 errors.

---

### Next: Phase 3 — The Answer Sheet (`TestSheet`)
1. Build `TestSheet` combining `SafetyBlock`, `LimitsTable`, `Citation`, `SourcesList`, conditional section rendering, confidence indicator, and print stylesheet.

