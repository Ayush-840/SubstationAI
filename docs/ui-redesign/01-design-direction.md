# 01. Design Direction

## 1. Diagnosis: why the current UI reads as AI-generated

These patterns appear in the current `DESIGN.md` and are the usual signature of generated UIs.

| Tell | Where it shows up | Why it reads as "AI" |
|------|-------------------|----------------------|
| Emoji as section icons (🦺🧪📝📏📚🛠️⚡) | Answer card, README, logo | Real products use a deliberate icon set or none |
| Inter + saturated blue (#0B5FFF) + teal accent | Whole app | The default SaaS template palette |
| Everything is a rounded pill/chip | Equipment, intent, confidence, citations, standards, status | One component used for every job, so no hierarchy |
| White rounded card on light gray, everywhere | Every screen | No variation in rhythm or density |
| Large radius (12px+), soft shadows | Cards, buttons | Friendly-startup look that doesn't suit an industrial tool |
| Perfectly symmetric, always-complete structure | Eight fixed sections on every answer | Feels templated rather than designed |
| Generic microcopy | "Understanding question…", "Searching catalog and manuals…" | Reads like a loading-state generator |
| No point of view | Entire product | Nothing says "built for substation work" |

## 2. Who the real user is

A maintenance engineer or technician who is:

- standing outdoors in a switchyard, often in glare, sometimes in rain
- wearing gloves, holding an instrument, using a phone or a rugged tablet
- time-pressured and safety-conscious
- looking for **one number, one step, or one warning**, not a conversation
- trained to trust **datasheets, test sheets, job cards, permits and standards**

The interface should feel like **those documents, made interactive**.

## 3. Design concept: "The Test Sheet"

SubstationIQ should look like a well-made engineering test sheet, or the panel of a good instrument.

Characteristics:

- **Document-like.** Ruled sections, labeled fields, tables that look like tables, footnote citations.
- **Quiet and dense in the right places.** Calm background, strong typographic hierarchy, large numbers where numbers matter.
- **Industrial honesty.** Hazard-stripe safety blocks, stamp-style verdicts, monospace values. Decoration is functional.
- **Warm paper, not cool glass.** Off-white backgrounds, near-black ink, one confident accent.

Keywords: *datasheet, job card, permit-to-work, nameplate, control room, hazard signage.*
Anti-keywords: *glassmorphism, gradient hero, floating cards, neon glow, pill soup.*

## 4. Design principles

1. **Hierarchy through type, not boxes.** Use size, weight, case and rules before adding another card.
2. **One accent color.** Plus semantic colors (hazard, danger, success) used only for meaning.
3. **Safety is signage.** It looks like real safety signage and never looks like a decorative alert.
4. **Numbers are the hero.** Limits, values, units are big, monospaced and aligned.
5. **Sources are footnotes.** Citations look like references in a technical paper.
6. **Show uncertainty only when it matters.** Confidence appears when it is low, not as a badge on everything.
7. **Field-ready by default.** Big text, big targets, high contrast, works one-handed, works in sun.
8. **Be specific.** Domain language, domain illustrations, domain examples.
9. **Subtract.** After each screen, remove 20% of the decoration and check nothing was lost.

## 5. The five changes with the biggest effect

If time is short, do only these, in order:

1. Remove every emoji from UI and replace with typography or a small icon set.
2. Replace palette and fonts (see `02-design-tokens.md`).
3. Redesign the answer card as a datasheet with footnote citations (see `03-components.md`).
4. Cut border radius to 2 to 6 px and remove nested cards.
5. Rewrite microcopy in plain domain language (see `05-copy-and-microcopy.md`).

## 6. Reference gathering (do this before coding)

Collect 6 to 10 references into a folder or board. Look at:

- Engineering documentation from switchgear and transformer makers
- Instrument vendor software (insulation testers, tan-delta kits, breaker analyzers)
- Aviation checklists and quick-reference handbooks
- Printed test sheets and commissioning forms
- Industrial control-room dashboards and HMI style guides (ISA-101 for the philosophy of calm, gray-based HMI with color reserved for abnormal states)
- Technical standards documents (layout of tables, notes, footnotes)

Extract from each: how they handle **tables, section labels, warnings, numbers, spacing**. Do not extract from design-inspiration galleries, because that is how templates get copied.

## 7. What must stay the same

- Information architecture in `DESIGN.md` section 2
- All key flows (Ask, Guided Procedure, Result Checker, DGA, Learn, Catalog authoring, Admin upload)
- Role-based navigation
- Dark and light theme support, with an added outdoor theme
- Disclaimer in the footer

## 8. Definition of done (design level)

- A new viewer cannot tell which tool or template generated the UI
- The safety block is recognizable from across a room
- The limits table can be read in direct sunlight on a phone
- No emojis in the product UI
- Screens differ from each other in rhythm. They don't all look like one card repeated
- Every piece of text sounds like it was written by someone who works in a substation
