# 02. Design Tokens

Replace the tokens in `DESIGN.md` section 6 with the following. All values are starting points. Adjust by eye, but keep the **rules** at the bottom of each section.

## 1. Color

### 1.1 Light theme ("Paper")

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#F3F0E8` | App background (warm paper) |
| `--surface` | `#FBF9F4` | Panels where separation is needed |
| `--surface-sunken` | `#EBE7DC` | Table headers, input backgrounds |
| `--ink` | `#17201C` | Primary text |
| `--muted` | `#5E6B63` | Secondary text, labels |
| `--rule` | `#CFCABD` | Dividers, table lines |
| `--rule-strong` | `#17201C` | Section top rules, table outer rules |
| `--primary` | `#1F5C45` | Primary actions, links, active nav |
| `--primary-ink` | `#FFFFFF` | Text on primary |
| `--hazard` | `#F2B800` | Safety block stripe and label |
| `--hazard-ink` | `#17201C` | Text on hazard |
| `--danger` | `#B3261E` | Outside limit, destructive actions |
| `--warn` | `#A15C00` | Borderline |
| `--success` | `#2F7A3E` | Within limit, verified |
| `--focus` | `#0B57D0` | Focus ring (deliberately different from primary) |

### 1.2 Dark theme ("Control room")

| Token | Value |
|-------|-------|
| `--bg` | `#101512` |
| `--surface` | `#161D19` |
| `--surface-sunken` | `#0C100E` |
| `--ink` | `#E7EBE4` |
| `--muted` | `#93A097` |
| `--rule` | `#2B3630` |
| `--rule-strong` | `#E7EBE4` |
| `--primary` | `#7BC9A0` |
| `--primary-ink` | `#0C100E` |
| `--hazard` | `#FFC933` |
| `--hazard-ink` | `#101512` |
| `--danger` | `#FF7A70` |
| `--warn` | `#F0A63A` |
| `--success` | `#6FD08A` |
| `--focus` | `#8AB4F8` |

### 1.3 Outdoor theme ("Sunlight")

Maximum contrast for use in direct sun. Offered as a third option in settings and via a quick toggle on mobile.

| Token | Value |
|-------|-------|
| `--bg` | `#FFFFFF` |
| `--surface` | `#FFFFFF` |
| `--ink` | `#000000` |
| `--muted` | `#2B2B2B` |
| `--rule` | `#000000` |
| `--primary` | `#0B4A33` |
| `--hazard` | `#FFD400` |
| `--danger` | `#9B0000` |
| `--success` | `#0B5A1E` |

Outdoor-theme rules: borders 2 px and black, base font 18 px, no gray text lighter than `#2B2B2B`.

### 1.4 Color rules

- Exactly **one** accent (`--primary`). Do not add a second brand color.
- `--hazard`, `--danger`, `--warn`, `--success` are **semantic only**. Never use them for decoration.
- Never use color alone to convey state. Pair with icon + text (see verdict stamp in `03-components.md`).
- No gradients anywhere. No glow. No translucent blur surfaces.
- Verify contrast: body text >= 4.5:1, large text and UI components >= 3:1. The outdoor theme should target >= 7:1.

## 2. Typography

### 2.1 Fonts

| Role | Font | Notes |
|------|------|-------|
| UI and body | **IBM Plex Sans** | Engineering feel, excellent legibility |
| Data (values, units, standard codes, IDs) | **IBM Plex Mono** | Always with tabular numbers |
| Optional display headings | **Newsreader** (or Source Serif 4) | Gives the "technical manual" tone. Use for page titles only |
| Optional condensed labels | **Barlow Condensed** | For section labels and stamps, if you want a signage feel |

Pick **either** the serif display option **or** the condensed label option, not both.

Self-host fonts (offline-friendly, no layout shift, no third-party request):

```bash
cd frontend
npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/newsreader
```

```ts
// frontend/src/main.tsx
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/newsreader/500.css";
```

### 2.2 Scale

Use fewer sizes, with stronger contrast between them.

| Token | Size / line height | Weight | Use |
|-------|--------------------|--------|-----|
| `--text-label` | 12 / 16, uppercase, letter-spacing 0.08em | 600 | Section labels (`SAFETY`, `LIMITS`) |
| `--text-small` | 14 / 20 | 400 | Captions, footnotes |
| `--text-body` | 17 / 26 (18 / 28 outdoor) | 400 | Body |
| `--text-lead` | 20 / 28 | 500 | Test name, key sentence |
| `--text-title` | 28 / 34 | 500 (serif) or 600 | Page title |
| `--text-value` | 32 / 36, mono | 500 | Limit values on the answer card |

### 2.3 Typography rules

- Body text never below 16 px on any device.
- All numbers in tables and values use `font-variant-numeric: tabular-nums;` and the mono font.
- Section labels are uppercase small caps-style labels with a top rule. Don't use bold sentence-case headings for every section.
- Line length for prose: 60 to 75 characters.
- Do not use more than **two** font families on a screen.

## 3. Spacing, radius, borders, elevation

| Token | Value |
|-------|-------|
| Spacing scale (4-pt) | 4, 8, 12, 16, 24, 32, 48, 64 |
| `--radius-sm` | 2px (inputs, table cells) |
| `--radius` | 4px (buttons, panels) |
| `--radius-full` | only for avatars and status dots |
| Border | 1px solid `--rule`. Strong rules are 2px `--rule-strong` |
| Shadow | **None** by default. Overlays (menus, dialogs) may use `0 2px 8px rgba(0,0,0,.18)` |

Rules:

- **Never** use `rounded-xl`, `rounded-2xl`, `rounded-3xl`, or pill radius on content containers.
- Separate sections with whitespace and rules, not boxes. Do not nest a bordered card inside a bordered card.
- Minimum touch target 48 px (56 px for safety-gate checkboxes and primary field actions).

## 4. Motion

- One animation only: text fade-in while streaming answers (150 ms).
- Hover and focus transitions at most 100 ms, color only.
- Everything wrapped in `@media (prefers-reduced-motion: no-preference)`.
- No shimmer skeletons. Use plain static placeholder bars in `--surface-sunken`.

## 5. CSS variables (drop-in)

```css
/* frontend/src/styles/tokens.css */
:root {
  --bg: #F3F0E8;
  --surface: #FBF9F4;
  --surface-sunken: #EBE7DC;
  --ink: #17201C;
  --muted: #5E6B63;
  --rule: #CFCABD;
  --rule-strong: #17201C;

  --primary: #1F5C45;
  --primary-ink: #FFFFFF;
  --hazard: #F2B800;
  --hazard-ink: #17201C;
  --danger: #B3261E;
  --warn: #A15C00;
  --success: #2F7A3E;
  --focus: #0B57D0;

  --radius-sm: 2px;
  --radius: 4px;

  --font-ui: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-data: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-display: "Newsreader", Georgia, serif;

  --text-body: 17px;
}

:root[data-theme="dark"] {
  --bg: #101512;
  --surface: #161D19;
  --surface-sunken: #0C100E;
  --ink: #E7EBE4;
  --muted: #93A097;
  --rule: #2B3630;
  --rule-strong: #E7EBE4;
  --primary: #7BC9A0;
  --primary-ink: #0C100E;
  --hazard: #FFC933;
  --hazard-ink: #101512;
  --danger: #FF7A70;
  --warn: #F0A63A;
  --success: #6FD08A;
  --focus: #8AB4F8;
}

:root[data-theme="outdoor"] {
  --bg: #FFFFFF;
  --surface: #FFFFFF;
  --surface-sunken: #F2F2F2;
  --ink: #000000;
  --muted: #2B2B2B;
  --rule: #000000;
  --rule-strong: #000000;
  --primary: #0B4A33;
  --hazard: #FFD400;
  --danger: #9B0000;
  --success: #0B5A1E;
  --text-body: 18px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* same values as [data-theme="dark"] */
    --bg: #101512; --surface: #161D19; --surface-sunken: #0C100E;
    --ink: #E7EBE4; --muted: #93A097; --rule: #2B3630; --rule-strong: #E7EBE4;
    --primary: #7BC9A0; --primary-ink: #0C100E;
    --hazard: #FFC933; --hazard-ink: #101512;
    --danger: #FF7A70; --warn: #F0A63A; --success: #6FD08A; --focus: #8AB4F8;
  }
}

html { background: var(--bg); color: var(--ink); font-family: var(--font-ui); font-size: var(--text-body); line-height: 1.55; }
.num, td.num, .value { font-family: var(--font-data); font-variant-numeric: tabular-nums; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

/* Hazard stripe, used for the safety block */
.hazard-stripe {
  background: repeating-linear-gradient(-45deg,
    var(--hazard) 0 12px, var(--ink) 12px 24px);
  height: 10px;
}
```

> The hazard stripe is the **one** permitted gradient. It is a hard-edged pattern and not a decorative blend.

## 6. Tailwind config (if you keep Tailwind)

```ts
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Replace, don't extend, so the default blue/gray palette can't leak in
    colors: {
      transparent: "transparent",
      current: "currentColor",
      bg: "var(--bg)",
      surface: "var(--surface)",
      sunken: "var(--surface-sunken)",
      ink: "var(--ink)",
      muted: "var(--muted)",
      rule: "var(--rule)",
      "rule-strong": "var(--rule-strong)",
      primary: "var(--primary)",
      "primary-ink": "var(--primary-ink)",
      hazard: "var(--hazard)",
      "hazard-ink": "var(--hazard-ink)",
      danger: "var(--danger)",
      warn: "var(--warn)",
      success: "var(--success)",
      focus: "var(--focus)",
    },
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius)",
      full: "9999px", // avatars / status dots only
    },
    boxShadow: { none: "none", overlay: "0 2px 8px rgba(0,0,0,.18)" },
    fontFamily: {
      sans: "var(--font-ui)",
      mono: "var(--font-data)",
      display: "var(--font-display)",
    },
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

Replacing the colors means leftover classes like `bg-blue-600`, `text-gray-500` or `rounded-2xl` will stop working. That is intentional, so the build exposes every spot to migrate. Fix them one at a time and don't add the old colors back.

## 7. Theme switching

- Three options: **Light**, **Dark**, **Outdoor**, plus "Match system" (which only chooses between Light and Dark).
- Persist in `localStorage` (`theme`), and set `document.documentElement.dataset.theme` **before first paint** (inline script in `index.html`) to avoid a flash.
- Add a visible theme control in the sidebar footer and in mobile "More".

## 8. Icons

- Use **Lucide** at one stroke width (1.5 px) and one size per context (16 or 20 px).
- Icons are optional. Prefer text labels for section headers.
- Never use emoji in the UI.
- Commission or draw **custom SVG glyphs for the five equipment types**: transformer (two coils), circuit breaker, CT/CVT, surge arrester, reactor. Draw them on a 24 px grid in a single stroke weight, and use them in the equipment filter, the catalog and empty states.
