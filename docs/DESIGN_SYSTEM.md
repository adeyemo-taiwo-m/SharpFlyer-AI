# SharpFlyer AI Design System

**Version 1.0 · Status: Draft for approval · Font: Inter only · Components: shadcn/ui · Themes: Light and Dark**

This document is the single source of truth for how SharpFlyer AI looks, feels, and sounds. Designers, developers, and AI coding agents must use it. It works together with the `design-quality-enforcement` skill and `docs/PRD.md`.

---

## Contents

1. Design philosophy and rules of use
2. Brand
3. Color system
4. Typography
5. Spacing, sizing, radius, and layout
6. Elevation, shadows, borders, and focus
7. Iconography
8. Motion
9. shadcn/ui component specifications
10. SharpFlyer-specific components
11. Patterns: navigation, forms, states, copy
12. Accessibility
13. Implementation: tokens, font setup, Tailwind, shadcn config
14. Governance and QA checklist

---

## 1. Design philosophy and rules of use

### 1.1 The look in one sentence

**Quiet, precise, and premium: generous space, confident Inter typography, soft rounded shapes, a neutral palette with one blue accent, and almost no decoration, so the customer's flyer is always the most colorful thing on screen.**

### 1.2 Principles

1. **The flyer is the hero.** The interface is a calm gallery wall. Customers' flyers carry the color.
2. **Precision builds trust.** Prices, phone numbers, and credits are tabular, aligned, and never ambiguous.
3. **Soft shapes, sharp thinking.** Pill-shaped buttons and rounded surfaces on the outside; strict logic and exact copy on the inside.
4. **Restraint.** One accent color. One typeface. Elevation only where something floats. If an element has no job, remove it.
5. **Phone first.** Designed at 360px, enhanced for larger screens. Touch targets are at least 44px.
6. **Fast on slow networks.** Small assets, no heavy effects, immediate feedback.
7. **Plain language.** Short, direct, sentence case, and specific.

### 1.3 Rule precedence for this document

The user explicitly requested this design system, including shadows. Therefore:

- **Shadows are allowed, but only as an elevation system for floating layers** (Section 6). They are never used as default decoration on static surfaces, buttons, or inputs.
- All other prohibitions in `design-quality-enforcement` still apply: **no gradients, no glassmorphism or background blur, no glow effects, no bento layouts, no unsolicited card grids, no unapproved colors, no more than one font family.**
- **No CSS Grid** for layouts. Use Flexbox and normal flow. If a shadcn component uses Grid internally (for example, Calendar), either replace it with a Flexbox implementation or ask for explicit approval before shipping it.

### 1.4 What "high taste" means here

| Do | Do not |
|---|---|
| Large, tightly tracked Inter headlines with generous white space | Many font sizes and weights competing on one screen |
| One ink primary button per view | Several colorful buttons side by side |
| Filled, borderless inputs and soft surface shades | Outlined boxes around everything |
| Elevation on popovers, dialogs, toasts, and the flyer preview only | Shadows on every surface |
| Real flyers and real product photos | Stock photos, 3D blobs, abstract decoration |
| Sentence-case, plain labels | ALL-CAPS eyebrow labels above every heading |
| One memorable moment per page | Fade-and-slide animations on every section |

---

## 2. Brand

### 2.1 Name and positioning

- **Product name:** SharpFlyer AI. Short form in running text: **SharpFlyer**.
- **Category:** AI-assisted promotional flyer creation for businesses.
- **Promise:** Professional flyers in minutes, with your price and phone number always correct.
- **Tagline (marketing):** *Sharp flyers, sharp sharp.* ("Sharp sharp" is Nigerian slang for quickly and well.) Use on the landing page, social profiles, and campaigns. Do not use in error messages, billing, legal text, or settings.
- **Supporting line (product-led):** *Pick a design. Add your details. Export a flyer you can post today.*

### 2.2 Brand personality

| Is | Is not |
|---|---|
| Confident, precise, calm | Loud, hyped, gimmicky |
| Warm and local without being cartoonish | Generic global SaaS or slangy for its own sake |
| Premium and approachable | Luxury-exclusive or intimidating |
| Practical and honest | Overpromising, vague, or buzzword-heavy |

### 2.3 Logo system

**Wordmark:** "SharpFlyer" set in Inter Bold (700), letter-spacing −0.04em, followed by "AI" in Inter Medium (500) in the muted text color. Wordmark and "AI" share one baseline and one font size. Sentence-case words are joined with no space: **SharpFlyer**.

**Symbol (mark):** A rounded square containing a bold **S** in Inter Bold. Three corners are rounded; **the top-right corner is cut square**, a quiet nod to "sharp." Use the same construction everywhere.

| Property | Value |
|---|---|
| Construction grid | 1024 x 1024 units |
| Corner radius (three corners) | 288 units (about 28%) |
| Top-right corner | 0 radius (square) |
| Letter | Inter Bold "S", optically centered, cap height about 52% of the square |
| Light theme | Ink (`#1D1D1F`) square, white "S" |
| Dark theme | Off-white (`#F5F5F7`) square, ink "S" |
| Accent variant | Blue (`#0071E3`) square, white "S" (marketing and app icon only) |

**Clear space:** keep a margin equal to the height of the "S" around the logo.

**Minimum sizes:** symbol 16px; wordmark 96px wide; symbol with wordmark 120px wide.

**Do not:** add gradients, shadows, outlines, or effects; stretch or rotate; recolor outside the variants above; place on busy imagery without a solid backing; change the square top-right corner; swap the typeface; animate the logo (except a simple fade on page load).

**Deliverables to commission or build from this spec:** SVG symbol (light, dark, accent), SVG wordmark (light, dark), favicon (32x32 and SVG), Apple touch icon (180x180), PWA icons (192 and 512, maskable), Open Graph image (1200x630), and social avatars (symbol on ink).

> The logo must be produced as a professionally drawn vector from this specification, not improvised in code. Replace the temporary text wordmark with the final asset when ready.

### 2.4 Imagery

- Lead with **real flyers produced by the product**. The landing page shows a live template being filled in, not abstract art.
- Use authentic product photography (inverters, batteries, panels, storefronts). No generic stock photos, 3D blobs, or decorative illustrations.
- Template thumbnails are shown at their true aspect ratio with a 20px corner radius.
- Customer logos and testimonials appear only when real and approved.

### 2.5 Voice and tone

| Principle | Example |
|---|---|
| Plain and direct | "Add your phone number" (not "Provide contact information") |
| Name the action | "Export flyer" (not "Submit") |
| Same word through the flow | The button says "Export flyer"; the toast says "Flyer exported" |
| Specific errors, no apologies | "Your price is too long to fit. Shorten it or choose another design." |
| Sentence case | "Choose a design" (not "Choose A Design") |
| Warmth with restraint | One light local touch at most, never in critical moments |

Avoid: exclamation marks in system messages, emoji in product UI, filler ("Oops!"), jargon ("render job," "payload"), and invented claims.

---

## 3. Color system

### 3.1 Palette philosophy

A **neutral base** (white, soft grays, ink) with **one accent blue**. Semantic colors (success, warning, danger) are used only to communicate state. Everything is a named token; raw hex values never appear in components. Any new color requires approval (Section 14).

### 3.2 Primitive palette

**Neutrals**

| Token | Hex | Role |
|---|---|---|
| `neutral-0` | `#FFFFFF` | White |
| `neutral-50` | `#F5F5F7` | Light surface |
| `neutral-100` | `#E8E8ED` | Light surface 2 (pressed, tracks) |
| `neutral-400` | `#A1A1A6` | Disabled text (light), muted text (dark) |
| `neutral-500` | `#6E6E73` | Muted text (light) |
| `neutral-900` | `#1D1D1F` | Ink (light text, primary button) |
| `neutral-850` | `#2C2C2E` | Dark surface 2 |
| `neutral-800` | `#1C1C1E` | Dark surface |
| `neutral-1000` | `#000000` | Dark background |

**Accent (blue)**

| Token | Hex | Role |
|---|---|---|
| `blue-600` | `#0071E3` | Brand button, focus ring (light), selected controls |
| `blue-700` | `#0066CC` | Accent text and links on light backgrounds |
| `blue-400` | `#2997FF` | Accent text, links, and focus ring on dark backgrounds |
| `blue-50` | `#E8F1FD` | Info tint (light) |
| `blue-950` | `#0A2036` | Info tint (dark) |

**Status**

| Token | Light | Dark | Role |
|---|---|---|---|
| `success` | `#1F7A35` | `#30D158` | Exported, paid, saved |
| `success-tint` | `#E9F6EC` | `#0F2A17` | Success surface |
| `warning` | `#B25000` | `#FF9F0A` | Low credits, layout warnings |
| `warning-tint` | `#FFF3E5` | `#2B1D05` | Warning surface |
| `danger` (fill) | `#D70015` | `#D70015` | Destructive button fill |
| `danger-text` | `#C0001A` | `#FF453A` | Error text and icons |
| `danger-tint` | `#FDEBEC` | `#2E0F0D` | Error surface |

> **Change from the earlier proposal:** success was adjusted from `#248A3D` to `#1F7A35` and warning to `#B25000` so that text meets WCAG AA contrast on white (see 3.5).

### 3.3 Semantic tokens (light and dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFFFFF` | `#000000` | Page |
| `foreground` | `#1D1D1F` | `#F5F5F7` | Primary text |
| `surface` | `#F5F5F7` | `#1C1C1E` | Inputs, subtle panels, segmented tracks |
| `surface-2` | `#E8E8ED` | `#2C2C2E` | Pressed and hover states, progress tracks, skeletons |
| `muted-foreground` | `#6E6E73` | `#A1A1A6` | Secondary text |
| `primary` | `#1D1D1F` | `#F5F5F7` | Main action fill |
| `primary-foreground` | `#FFFFFF` | `#1D1D1F` | Text on main action |
| `brand` | `#0071E3` | `#0071E3` | Accent button fill |
| `brand-foreground` | `#FFFFFF` | `#FFFFFF` | Text on accent fill |
| `brand-text` | `#0066CC` | `#2997FF` | Links and accent text |
| `ring` | `#0071E3` | `#2997FF` | Focus ring |
| `hairline` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.12)` | Dividers and rare separators |
| `inverse` | `#1D1D1F` | `#F5F5F7` | Toasts and tooltips background |
| `inverse-foreground` | `#F5F5F7` | `#1D1D1F` | Toasts and tooltips text |
| `overlay` | `rgba(0,0,0,0.40)` | `rgba(0,0,0,0.60)` | Behind dialogs and sheets |

### 3.4 Mapping to shadcn/ui variables

shadcn's `accent` means a subtle hover surface, not a brand color. SharpFlyer's brand blue is the separate `brand` token.

| shadcn variable | SharpFlyer token |
|---|---|
| `--background` / `--foreground` | `background` / `foreground` |
| `--card` / `--card-foreground` | `background` (light) or `surface` (dark) / `foreground` |
| `--popover` / `--popover-foreground` | `background` (light) or `surface` (dark) / `foreground` |
| `--primary` / `--primary-foreground` | `primary` / `primary-foreground` |
| `--secondary` / `--secondary-foreground` | `surface` / `foreground` |
| `--muted` / `--muted-foreground` | `surface` / `muted-foreground` |
| `--accent` / `--accent-foreground` | `surface` (light) or `surface-2` (dark) / `foreground` |
| `--destructive` | `danger` (fill) |
| `--border` | `hairline` |
| `--input` | `surface` |
| `--ring` | `ring` |

### 3.5 Contrast reference (measured)

WCAG ratios computed for the exact values above. Body text needs 4.5:1; large text (24px, or 19px bold) and UI components need 3:1.

| Combination | Ratio | Verdict |
|---|---|---|
| Ink `#1D1D1F` on white | 16.83 | Passes |
| Ink on surface `#F5F5F7` | 15.46 | Passes |
| Muted `#6E6E73` on white | 5.07 | Passes |
| Muted on surface `#F5F5F7` | 4.66 | Passes (do not go lighter) |
| Muted on surface-2 `#E8E8ED` | 4.15 | **Fails for body text. Do not place muted text on surface-2.** |
| White on brand `#0071E3` | 4.70 | Passes |
| Brand text `#0066CC` on white | 5.57 | Passes |
| Brand text on surface | 5.11 | Passes |
| Success `#1F7A35` on white | 5.39 | Passes |
| Warning `#B25000` on white | 5.20 | Passes |
| Danger text `#C0001A` on danger-tint | 5.61 | Passes |
| Success on success-tint | 4.84 | Passes |
| Warning on warning-tint | 4.75 | Passes |
| Brand text on info-tint | 4.89 | Passes |
| Off-white `#F5F5F7` on black | 19.29 | Passes |
| Dark muted `#A1A1A6` on black | 8.16 | Passes |
| Dark muted on dark surface `#1C1C1E` | 6.61 | Passes |
| Dark muted on dark surface-2 `#2C2C2E` | 5.42 | Passes |
| Dark brand text `#2997FF` on black | 6.96 | Passes |
| Dark brand text on dark surface | 5.64 | Passes |
| Dark danger text `#FF453A` on black | 6.16 | Passes |
| Disabled text `#A1A1A6` on white | 2.4 (approx.) | Intentionally low; disabled controls are exempt, but never put essential text in a disabled style |

**Rules**
- Light gray `#86868B` fails on white (3.62). Do not use it for text.
- Brand blue `#0071E3` is used as a **fill with white text** or as large UI. For small blue text on light backgrounds use `brand-text` (`#0066CC`).
- Re-test every color change with a contrast checker and on a real mid-range phone in sunlight-like brightness.

### 3.6 Color usage rules

1. **One primary action per view**, filled with `primary` (ink). The blue `brand` button is reserved for the most important conversion moments (for example, "Get started" on the landing page and "Export flyer"). Never place an ink and a blue filled button side by side with equal weight; pair a filled button with a secondary or ghost button.
2. **Blue means interactive or selected**: links, focus rings, selected segments, switches, progress.
3. **Status colors only for status.** Never decorate with green, orange, or red.
4. **No gradients, no tints used as decoration.** Tinted surfaces appear only in alerts, badges, and selected states.
5. **No opacity tricks to create new colors.** Use tokens. Allowed alpha: `hairline`, `overlay`, and the shadow definitions.
6. **Do not color the interface with the customer's brand colors.** Customer colors appear only inside the flyer preview and color swatches.
7. **The preview stage** is `surface` so flyers with white backgrounds remain visible.

### 3.7 Data visualization colors

Use sparingly (analytics, usage dashboards). Maximum five series; always label directly and do not rely on color alone.

`chart-1 #0071E3` · `chart-2 #1D1D1F` · `chart-3 #6E6E73` · `chart-4 #1F7A35` · `chart-5 #B25000` (use lighter dark-mode equivalents from the status table).

---

## 4. Typography

### 4.1 Typeface

**Inter only.** No second family. Hierarchy comes from size, weight, tracking, and color.

- Weights in use: **400 Regular, 500 Medium, 600 Semibold, 700 Bold**. Do not load others.
- Load as a **variable font** through `next/font` (Section 13). Include **`latin` and `latin-ext`** subsets so the Naira sign (₦, U+20A6) renders in Inter instead of falling back to another font. Verify ₦850,000 in the built app.
- If OpenType features are missing from the hosted subset, self-host the official Inter files with `next/font/local`.

### 4.2 OpenType features

| Feature | Setting | Use |
|---|---|---|
| Tabular numbers | `font-variant-numeric: tabular-nums` | Prices, credits, tables, counters, timestamps |
| Contextual alternates and kerning | default on | Always |
| Single-storey "a" (`cv11`) | optional, off by default | Do not enable unless brand approves; keeps the Apple-like default shapes |
| Case-sensitive forms (`case`) | on for text with currency symbols or all-caps acronyms | Ensures ₦ and symbols align with capitals |

Body default: `font-feature-settings: "kern", "liga", "calt";` with `-webkit-font-smoothing: antialiased`.

### 4.3 Type scale

Sentence case everywhere. Tracking tightens as size grows (Apple-style). Sizes shown as mobile / desktop.

| Style | Mobile | Desktop | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| `display-xl` | 44 | 72 | 700 | 1.04 | −0.035em | Landing hero only |
| `display` | 36 | 56 | 700 | 1.06 | −0.03em | Marketing section headlines |
| `h1` | 30 | 40 | 700 | 1.1 | −0.028em | Page titles |
| `h2` | 24 | 30 | 650 → 600 | 1.2 | −0.022em | Section titles |
| `h3` | 20 | 22 | 600 | 1.25 | −0.018em | Subsections, sheet titles |
| `h4` | 17 | 18 | 600 | 1.3 | −0.012em | Group titles |
| `body-lg` | 17 | 19 | 400 | 1.5 | −0.011em | Marketing paragraphs |
| `body` | 16 | 16 | 400 | 1.5 | −0.006em | Default text, inputs |
| `body-strong` | 16 | 16 | 600 | 1.5 | −0.006em | Emphasis, labels |
| `callout` | 15 | 15 | 500 | 1.4 | −0.006em | Button labels (md), list titles |
| `small` | 14 | 14 | 400 | 1.45 | 0 | Helper text, table cells |
| `caption` | 13 | 13 | 400 | 1.4 | 0 | Metadata, captions |
| `micro` | 12 | 12 | 500 | 1.3 | 0.005em | Badges, tab bar labels (11px minimum on the tab bar) |
| `price-xl` | 40 | 56 | 700 | 1.0 | −0.03em | Pricing page amounts (tabular) |
| `price` | 20 | 24 | 600 | 1.2 | −0.015em | Inline prices, credits (tabular) |

Notes:
- **Input text is always 16px or larger** to prevent iOS Safari from zooming on focus.
- Never go below **12px**, and keep text under 13px for non-essential metadata only.
- Use `clamp()` for fluid hero sizing: `display-xl` = `clamp(2.75rem, 1.5rem + 5vw, 4.5rem)`.
- Headline weight 600 or 700 only. Avoid 800+ and anything below 400.

### 4.4 Text color roles

| Role | Token |
|---|---|
| Headings and primary text | `foreground` |
| Secondary text and helper text | `muted-foreground` |
| Links and inline actions | `brand-text` |
| Errors | `danger-text` |
| Success confirmations | `success` |
| Text on filled buttons | `primary-foreground` or `brand-foreground` |

### 4.5 Readability rules

- Body line length: **45 to 75 characters** (`max-width: 66ch` for long text; `40ch` for narrow helper text).
- Left-align text. Center-align only short hero headlines, empty states, and confirmation messages.
- Do not use ALL CAPS for labels or eyebrows. Use sentence case and, if needed, `micro` weight 500.
- Do not accent a single word in a headline with a different color or weight.
- Do not underline except for links in running text.
- Truncate only where unavoidable, with the full value available on tap or in a tooltip.
- Text must remain usable at 200% zoom and with larger system font settings.

### 4.6 Numerals, currency, and phone numbers

- Prices: `₦850,000` with tabular figures; no space between symbol and number; thousands separated by commas. In dense tables, right-align numbers.
- Credits: `12 credits` (singular `1 credit`). Always tabular.
- Phone numbers: display as `0803 123 4567`; never wrap across lines (`white-space: nowrap`).
- Dates: `9 Nov 2026` in the Africa/Lagos time zone. Times in 12-hour format with am/pm unless the product later offers a setting.

---

## 5. Spacing, sizing, radius, and layout

### 5.1 Spacing scale (4px base)

`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`

Tokens map to Tailwind's default spacing steps (`1 = 4px`). Use only these values.

| Context | Spacing |
|---|---|
| Icon and label gap | 8 |
| Form label to field | 8 |
| Field to field | 20 |
| Group to group | 32 |
| Between page sections (app) | 40 to 48 |
| Between page sections (marketing) | 80 to 128 |
| Mobile page edge padding | 20 |
| Tablet page edge padding | 32 |
| Desktop page edge padding | 40 |

Spacing is applied by **parent layout structures** (gap, stack spacing), not by padding on every element. Avoid nested padding.

### 5.2 Corner radius scale

Rounded and soft, with a clear hierarchy so not everything has the same radius.

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 6px | Checkboxes, small tags, tooltips (with 8) |
| `radius-sm` | 8px | Tooltips, small menu items |
| `radius-md` | 12px | Inputs, textareas, selects, alerts |
| `radius-lg` | 16px | Menus, popovers, list rows, banners |
| `radius-xl` | 20px | Template thumbnails, upload dropzone, content surfaces |
| `radius-2xl` | 28px | Dialogs, sheets, large surfaces |
| `radius-full` | 9999px | **Buttons, badges, segmented controls, switches, avatars, chips** |

**Buttons are always fully rounded (pill).** Concentric rule: an inner element's radius equals the outer radius minus the padding between them (for example, a 28px dialog with 8px padding contains 20px surfaces).

### 5.3 Sizing

| Element | Size |
|---|---|
| Touch target (minimum) | 44 x 44px |
| Button height | sm 36, **md 44 (default)**, lg 52, xl 56 |
| Input height | 48 (mobile) / 44 (dense desktop forms) |
| Icon button | 36, 44 |
| Menu item height | 40 |
| Table row | 56 |
| Bottom tab bar | 64 + safe-area inset |
| Top app bar | 56 (mobile) / 64 (desktop) |
| Sidebar (desktop) | 248 |
| Avatar | 24, 32, 40 |

### 5.4 Breakpoints and containers

Design starts at **360px**.

| Name | Min width | Notes |
|---|---|---|
| base | 0 | Single column, bottom tab bar |
| `sm` | 640 | Larger phones, small tablets |
| `md` | 768 | Tablets |
| `lg` | 1024 | Sidebar navigation, editor with side-by-side form and preview |
| `xl` | 1280 | Wide desktop |
| `2xl` | 1536 | Content stays centered; do not stretch text |

| Container | Max width |
|---|---|
| Reading text | 680px |
| Form column | 560px |
| App content | 1200px |
| Marketing content | 1200px (hero may go edge-to-edge) |

### 5.5 Layout rules

- **Flexbox and normal flow only.** No CSS Grid.
- Parents control spacing and alignment; children do not add their own horizontal gutters.
- Use full-width bands, left alignment, and asymmetry where it improves hierarchy; do not force every page into one centered column.
- Respect safe areas: `padding-bottom: env(safe-area-inset-bottom)` on bottom bars and sheets.
- Use `min-height: 100dvh` (not `100vh`) for full-screen layouts.
- Prevent layout shift: reserve image space with aspect ratio.

### 5.6 Z-index scale

`base 0` · `sticky 10` · `dropdown 40` · `overlay 50` · `dialog 60` · `toast 70` · `tooltip 80`

---

## 6. Elevation, shadows, borders, and focus

### 6.1 Elevation philosophy

Apple-like depth comes from **soft, diffuse, low-opacity shadows used sparingly**, and from layering surface colors. In SharpFlyer, **elevation means the element floats above the page**. Static content sits flat.

### 6.2 Elevation levels

**Light theme**

| Level | Token | Value | Use |
|---|---|---|---|
| 0 | `shadow-none` | none | Everything static: buttons, inputs, surfaces, list rows |
| 1 | `shadow-1` | `0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)` | Segmented-control thumb, sticky app bar after scroll, bottom tab bar |
| 2 | `shadow-2` | `0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)` | Menus, popovers, select lists, flyer preview on its stage |
| 3 | `shadow-3` | `0 12px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)` | Dialogs, bottom sheets, toasts |
| 4 | `shadow-4` | `0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.06)` | Dragged or lifted elements (rare) |

**Dark theme.** Shadows are barely visible on near-black, so elevation uses **lighter surfaces plus a hairline ring**:

| Level | Value |
|---|---|
| 1 | `0 0 0 1px rgba(255,255,255,0.06)` |
| 2 | `0 8px 24px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.08)` |
| 3 | `0 20px 48px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.10)` |
| 4 | `0 32px 72px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.12)` |

Surface mapping in dark mode: page `#000000`, floating layers `#1C1C1E`, nested surfaces inside floating layers `#2C2C2E`.

### 6.3 Shadow rules

1. Only floating layers get shadows (levels 1 to 4 per the table).
2. Never stack a shadow on top of a hairline border on the same element in light mode.
3. Shadow color is neutral black with low alpha. **No colored or glow shadows.**
4. Do not animate shadow blur or spread; animate opacity and transform instead (performance).
5. One shadow per element; never nest shadowed elements inside shadowed elements.
6. **No background blur or translucent glass.** Overlays are flat `overlay` color.

### 6.4 Borders and dividers

- Default surfaces have **no border**. Separation comes from spacing and surface color.
- `hairline` (1px) is allowed for: list and table dividers, the top edge of the bottom tab bar, and the dark-mode ring on floating layers.
- Inputs are **filled and borderless**; the focus state supplies the ring.
- Never draw a box border around a group just to "organize" it.

### 6.5 Focus ring

A visible, high-contrast ring on every interactive element for keyboard users:

- Style: `outline: 2px solid var(--ring); outline-offset: 2px;`
- Use `:focus-visible` only (no ring on mouse click for buttons).
- On filled inputs the ring replaces the surface edge: `box-shadow: 0 0 0 2px var(--ring)` with background switching to `background`.
- Ring color must have at least 3:1 contrast with the adjacent color (met by the `ring` token in both themes).

### 6.6 State layers

| State | Treatment |
|---|---|
| Hover (desktop only) | Surface elements shift one step (`surface` to `surface-2`); filled buttons darken ~8% |
| Pressed | `scale(0.98)` plus one more step of darkening; 120ms |
| Focus-visible | Focus ring |
| Selected | Fill with `foreground`/`primary` (segmented) or `brand` (switch, checkbox) plus a check or other non-color cue |
| Disabled | 40% opacity, `cursor: not-allowed`, no hover or press effect |
| Loading | Spinner replaces the label or icon, width preserved, control disabled |

---

## 7. Iconography

- **Library: Lucide** (the default with shadcn/ui). No other icon families, no hand-drawn icons, no emoji as icons.
- **Stroke:** 1.75px (set `strokeWidth={1.75}`), rounded caps and joins, to match Inter's weight.
- **Sizes:** 16 (inline with small text), 20 (default in buttons and menus), 24 (navigation, empty states), 32 (feature moments).
- **Color:** inherits text color. Accent-colored icons only when indicating a selected or interactive state.
- Icon-only buttons need an accessible name and, on desktop, a tooltip.
- Pair icons with text labels when the meaning is not universal.
- Avoid sparkle icons for "AI." Name AI features by what they do ("Suggest headlines") and use ordinary icons such as `Wand`, `Type`, or `Image`.

Recommended icon assignments:

| Concept | Lucide icon |
|---|---|
| Templates / gallery | `LayoutTemplate` |
| Create | `Plus` |
| My flyers | `Files` |
| Brand | `Palette` |
| Billing and credits | `Coins` |
| Export / download | `Download` |
| Share | `Share` |
| Upload | `Upload` |
| Edit | `Pencil` |
| Duplicate | `Copy` |
| Delete | `Trash2` |
| Settings | `Settings` |
| Success | `CircleCheck` |
| Warning | `TriangleAlert` |
| Error | `CircleAlert` |
| Info | `Info` |
| Search | `Search` |
| Close | `X` |

---

## 8. Motion

Motion explains what changed. It is quick, quiet, and never decorative.

### 8.1 Timing and easing

| Token | Value | Use |
|---|---|---|
| `duration-instant` | 80ms | Press feedback |
| `duration-fast` | 150ms | Hover, color changes, toggles |
| `duration-base` | 240ms | Menus, popovers, tab changes |
| `duration-slow` | 360ms | Dialogs, sheets, page-level transitions |
| `ease-standard` | `cubic-bezier(0.32, 0.72, 0, 1)` | Default (smooth deceleration, Apple-like) |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving |

### 8.2 Patterns

| Pattern | Behavior |
|---|---|
| Button press | `scale(0.98)` over 80ms; release over 150ms |
| Menu / popover open | Fade in plus `scale(0.96 → 1)` from the trigger origin, 150 to 200ms |
| Dialog open | Fade overlay; dialog scales `0.97 → 1` and fades, 240ms |
| Bottom sheet | Slides up from the bottom, 360ms with `ease-standard`; drag to dismiss |
| Segmented control | Thumb slides to the new segment, 200ms |
| Switch | Thumb slides 200ms |
| Toast | Slides up 16px and fades in; exits by fading, 200ms |
| Flyer preview update | Cross-fade 150ms between renders; keep the previous image until the next one loads |
| Skeleton | Soft opacity pulse (`0.5 ↔ 1`), 1.4s; **no shimmer gradients** |
| Progress | Width transitions linearly with a minimum visible step |

### 8.3 Rules

- Animate **opacity and transform** only; avoid animating layout properties.
- Respect `prefers-reduced-motion: reduce` by replacing movement with simple fades or no animation.
- No scroll-triggered fade-ups on sections, no parallax, no looping decorative animation.
- A single orchestrated moment is allowed on the landing page (for example, the hero flyer assembling itself once on load). It must be skippable and must not delay content.

---

## 9. shadcn/ui component specifications

Install shadcn/ui and generate components with the CLI, then restyle them to the tokens below. Keep components in `src/components/ui`. Do not modify behavior or accessibility logic; change only styling.

**Components to install:** `button`, `input`, `textarea`, `label`, `form`, `select`, `checkbox`, `radio-group`, `switch`, `slider`, `tabs`, `dialog`, `sheet`, `drawer`, `popover`, `dropdown-menu`, `tooltip`, `sonner`, `badge`, `avatar`, `skeleton`, `progress`, `alert`, `table`, `pagination`, `breadcrumb`, `command`, `separator`, `scroll-area`, `toggle-group`, `accordion`.

### 9.1 Button

| Variant | Fill | Text | Use |
|---|---|---|---|
| `default` (ink) | `primary` | `primary-foreground` | Main action in most views |
| `brand` | `brand` | `brand-foreground` | Top conversion moments (landing "Get started", "Export flyer") |
| `secondary` | `surface` | `foreground` | Secondary actions |
| `ghost` | transparent | `foreground` | Tertiary actions, toolbar buttons |
| `link` | transparent | `brand-text` | Inline navigation; underline on hover |
| `destructive` | `danger` | white | Delete, remove (always behind confirmation) |
| `outline` | transparent plus `hairline` ring | `foreground` | Rare; avoid unless a view needs a distinct neutral option |

| Size | Height | Horizontal padding | Text | Icon |
|---|---|---|---|---|
| `sm` | 36 | 16 | 14 / 500 | 16 |
| `md` (default) | 44 | 22 | 15 / 500 | 20 |
| `lg` | 52 | 28 | 16 / 600 | 20 |
| `xl` | 56 | 32 | 17 / 600 | 20 |
| `icon` | 44 x 44 | none | n/a | 20 |
| `icon-sm` | 36 x 36 | none | n/a | 16 |

Specs: `rounded-full`, no shadow, no border, labels in sentence case, `gap-2` between icon and label, `white-space: nowrap`. Full-width on mobile for primary actions inside forms and sheets.

```tsx
// src/components/ui/button.tsx (variants)
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "font-medium tracking-[-0.006em] select-none",
    "transition-[background-color,transform,opacity] duration-150 ease-standard",
    "active:scale-[0.98] active:duration-75",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:size-5 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        secondary: "bg-secondary text-foreground hover:bg-surface-2",
        ghost: "text-foreground hover:bg-secondary",
        link: "text-brand-text underline-offset-4 hover:underline rounded-none px-0",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "text-foreground ring-1 ring-inset ring-border hover:bg-secondary",
      },
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        md: "h-11 px-[22px] text-[15px]",
        lg: "h-[52px] px-7 text-base font-semibold",
        xl: "h-14 px-8 text-[17px] font-semibold",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);
```

Loading state: show a 16px spinner (Lucide `Loader2`, `animate-spin`) in place of the leading icon; keep the label and the width; add `aria-busy="true"`.

### 9.2 Input, Textarea, Label

- **Filled, borderless:** `bg-surface`, `rounded-xl` (12px), height 48, horizontal padding 16, text `body` (16px), placeholder `muted-foreground`.
- **Focus:** background becomes `background`; `box-shadow: 0 0 0 2px var(--ring)`.
- **Error:** `box-shadow: 0 0 0 2px var(--danger-text)`; error message below in `small` with `danger-text` and an icon. Do not rely on color alone.
- **Disabled:** 50% opacity, no ring.
- **Label:** above the field, `callout` (15/500), 8px gap. Optional fields are marked "(optional)" in `muted-foreground`; required fields are the default.
- **Helper text:** `small` in `muted-foreground`, 6px below the field.
- Textarea: min height 96, same styling, auto-grow to a maximum.
- Counters for limited fields appear at the bottom right as `caption`, tabular.

### 9.3 Select, Combobox, Command

- Trigger styled exactly like Input with a trailing `ChevronDown` (16px, muted).
- Content: `bg-popover`, `rounded-2xl` (16px), `shadow-2`, padding 6, max height 320 with scrolling, min width equal to the trigger.
- Items: height 40, `rounded-[10px]`, padding 0 12px, `body`. Hover/active: `surface`. Selected: trailing `Check` icon (no color-only cue).
- On mobile, prefer a **bottom sheet** for lists of more than 6 options.
- Searchable lists use `Command` with a filled search input at the top.

### 9.4 Checkbox, Radio, Switch, Slider, Toggle group

| Control | Spec |
|---|---|
| Checkbox | 20 x 20, `rounded-md` (6px), unchecked: `surface-2` fill; checked: `brand` fill with white check; label gap 12; 44px touch area |
| Radio | 20 x 20 circle, same colors, inner dot 8px |
| Switch | 52 x 32, pill; off: `surface-2` track; on: `brand` track; thumb 28px white with `shadow-1`; 200ms slide |
| Slider | Track 4px pill `surface-2`, filled part `brand`; thumb 24px white with `shadow-2`; large invisible hit area (44px) |
| Toggle group / segmented | See 9.6 |

### 9.5 Badge

Pill, height 24, padding 0 10px, `micro` (12/500), sentence case.

| Variant | Background | Text |
|---|---|---|
| neutral | `surface` | `foreground` |
| brand | info-tint | `brand-text` |
| success | success-tint | `success` |
| warning | warning-tint | `warning` |
| danger | danger-tint | `danger-text` |

Badges are for status, not decoration. Do not add badges "for flavor."

### 9.6 Tabs and segmented control

- **Segmented control (default tabs):** track `surface`, `rounded-full`, padding 4, height 44 (inner thumb 36). Selected segment: white thumb (`background` in light; `surface-2` in dark), `shadow-1`, text `foreground` weight 600. Unselected: `muted-foreground` weight 500. Labels `callout`.
- **Underline tabs** (for pages with many sections): 2px `foreground` indicator under the active label, `hairline` baseline, labels `callout`. Use only when the number of tabs exceeds five or labels are long.
- Scrollable horizontally on mobile, with the active tab scrolled into view; no wrapping.

### 9.7 Dialog, Sheet, Drawer

| Property | Dialog (desktop) | Bottom sheet (mobile) |
|---|---|---|
| Width | 480 (max 560 for forms) | Full width |
| Radius | `radius-2xl` (28) | 28 on top corners only |
| Background | `popover` | `popover` |
| Elevation | `shadow-3` | `shadow-3` |
| Padding | 28 | 24, plus safe-area bottom |
| Overlay | `overlay` (flat, no blur) | `overlay` |
| Handle | none | 36 x 5 pill in `surface-2`, centered, 8px from top |
| Dismiss | Escape, close button (`icon-sm` ghost), overlay click (only if safe) | Drag down, overlay tap |

Header: title in `h3`; optional description in `small` muted. Footer actions right-aligned on desktop (secondary then primary); stacked full-width on mobile (primary on top). Use dialogs only when a decision or focused task is needed. Destructive confirmations name the object and the consequence: "Delete 'Weekend sale'? This removes the flyer and its exports."

### 9.8 Dropdown menu and Popover

- Same surface as Select content (`rounded-2xl`, `shadow-2`, padding 6).
- Items 40px tall with leading 20px icons and optional trailing shortcut in `caption` muted.
- Destructive items use `danger-text` and sit last, separated by a `hairline` separator.
- Nested menus open to the side on desktop and as a pushed sheet on mobile; limit to two levels.

### 9.9 Tooltip

`bg-inverse`, `text-inverse-foreground`, `caption` (13/500), `rounded-lg` (8px), padding 6px 10px, `shadow-2`, delay 400ms, desktop only (never the sole source of meaning).

### 9.10 Toast (Sonner)

- Position: bottom center on mobile (above the tab bar), bottom right on desktop.
- Surface: `bg-inverse` with `text-inverse-foreground`, `rounded-2xl`, `shadow-3`, padding 14px 16px, max width 380.
- Content: a 20px status icon, one line of text (two maximum), optional single action button (ghost, `brand-text` variant adjusted for the dark surface: use `#2997FF` in light theme toasts).
- Duration: 4s; errors persist until dismissed. Use the same verb as the triggering action ("Flyer exported").

### 9.11 Alert and inline banners

- Surface: matching tint (`success-tint`, `warning-tint`, `danger-tint`, info-tint), `rounded-2xl` (16px), padding 16, no border, no shadow.
- Layout: 20px icon, title in `body-strong`, description in `small`, optional action as a `sm` secondary button.
- Use for validation warnings that block or advise on export (contrast, overflow, low image quality).

### 9.12 Table and Pagination

- No zebra stripes, no cell borders. Row height 56, `hairline` bottom dividers, header row in `caption` weight 500 `muted-foreground` (sentence case), sticky on long tables.
- Numeric columns right-aligned with tabular figures.
- On mobile, tables become stacked lists with the primary value on the first line and metadata below. Do not convert rows into bordered cards.
- Pagination: pill buttons (`secondary`, `icon-sm`), page indicator `small` muted ("Page 2 of 8").

### 9.13 Avatar, Skeleton, Progress, Separator

- Avatar: circle, sizes 24/32/40, fallback initials in `micro` on `surface-2`.
- Skeleton: `surface-2` fill, `rounded-xl`, opacity pulse (no gradient shimmer), match final content dimensions.
- Progress: 6px pill; track `surface-2`; fill `brand`; show a text percentage or stage label alongside for long operations.
- Separator: `hairline`, used sparingly.

### 9.14 Form

Use `react-hook-form` with `zod` and shadcn `Form`. Validate on blur, then on change after the first error. Show the first error summary above long forms with focus moved to the first invalid field. Preserve entered data on error.

---

## 10. SharpFlyer-specific components

### 10.1 Template tile

- Layout: flyer image on top, title and category below. **Not a boxed card.** No border, background panel, or shadow at rest.
- Image: native aspect ratio of the preview format, `radius-xl` (20px), `surface` placeholder while loading, object-fit cover, max 80 KB thumbnails.
- Text: title `callout` 15/500 `foreground`; category and format `caption` `muted-foreground`.
- Interaction: the whole tile is one focusable link. Desktop hover: add `shadow-2` to the image (opacity-only transition). Selected (in "Change design" mode): 3px `brand` ring offset by 2px plus a check badge.
- Gallery layout: flex-wrap with consistent gaps (16 on mobile, 24 on desktop); two columns on mobile (each about 50% minus the gap), three at `md`, four at `lg`.

### 10.2 Flyer preview stage

- Stage surface: `surface`, `radius-2xl` (28px), padding 24 (16 on mobile), centered flyer.
- The flyer image sits at its true proportions with `shadow-2` and no border; it never exceeds the stage.
- Floating zoom controls: a pill group of `icon-sm` ghost buttons on `background` with `shadow-2`, bottom center of the stage.
- Updating: keep the previous render visible, show a small "Updating" pill with a spinner, and cross-fade when the new render arrives.
- Transparent-image editing uses a neutral checkerboard built from `surface` and `surface-2`.

### 10.3 Format switcher

A segmented control with icon + label items: **Status**, **Post**, **Story**, **Facebook**, **A4**. Scrolls horizontally on mobile. Shows the pixel size in a `caption` under the selected item (for example, `1080 × 1920`). Switching formats keeps all content and cross-fades the preview.

### 10.4 Credit badge

- Pill in the app bar: `Coins` icon (16px) + tabular count ("12"), `callout`, `surface` background, height 36.
- Low state (3 or fewer): `warning-tint` background and `warning` text; tapping opens the plan sheet.
- Empty state (0): `danger-tint` and `danger-text`.
- Tapping always opens a bottom sheet with the balance, what each action costs, and "Buy credits."

### 10.5 Price field

- Input with a fixed `₦` prefix inside the field (muted until the field has a value), tabular figures, numeric keyboard (`inputmode="numeric"`).
- Formats with thousands separators as the user types; the formatted result is also shown as helper text ("Shows as ₦850,000").
- Old price field is optional; if it is lower than the price, show the error "Old price must be higher than the new price."

### 10.6 Phone field

- `+234` country prefix shown as a non-editable pill inside the field (changeable through a select for international numbers); numeric keyboard (`inputmode="tel"`).
- Accepts `0803…`, `+234…`, and `234…`; normalizes silently and displays as `0803 123 4567`.
- Helper: "This number appears on your flyer exactly as shown here."

### 10.7 Upload dropzone

- Surface: `surface`, `radius-xl` (20px), minimum height 120, centered `Upload` icon (24px, muted), label "Add your logo" (`callout`), helper "PNG, JPG, SVG or WebP. Up to 5 MB." (`caption`).
- States: drag-over uses info-tint with a `brand` ring; uploading shows a progress bar and a cancel button; uploaded shows a thumbnail, file name, size, and "Replace" and "Remove" ghost buttons; error uses `danger-tint` with a specific message and "Try again."
- On mobile, the tap target opens the system file or camera chooser.

### 10.8 Color theme swatches

Row of 36px circles (44px touch area) showing each palette's primary color. Selected: 2px `foreground` ring with 2px gap. Each swatch has an accessible name ("Navy and gold"). A contrast warning icon appears on a swatch when the combination fails the template's minimum.

### 10.9 Copy suggestion list

When the user taps "Suggest headlines," show three options as full-width list rows (`surface`, `radius-lg`, padding 14 16) with the text, character count in `caption`, and the whole row tappable to insert. Include "Try again" (ghost) and "Write my own" (ghost). Rows contain no AI-sparkle decoration.

### 10.10 Generation progress

Used while rendering: a single compact surface showing three stages with check, spinner, or dot, and a progress bar: "Preparing your design," "Placing your details," "Checking your flyer." Stage text reflects real job states, not a fake timer. On failure: danger-tint alert with the reason and "Try again" (no credit used).

### 10.11 Validation banner

Inline Alert with an action: "Your headline is too long for this design. **Shorten it**" or "Text is hard to read on this background. **Use a recommended color**." Blocking errors appear above the Export button and disable it with an explanatory message.

### 10.12 Export sheet

Bottom sheet (mobile) or dialog (desktop): format summary row, file type segmented control (PNG, JPG), resolution toggle (Standard, High for print), a row "This export uses 1 credit" with the balance after, and one `brand` button "Export flyer" (full width on mobile). After success: "Flyer exported" confirmation with **Share** (primary) and **Save to device** (secondary).

### 10.13 Plan selector

Flex row (stacked on mobile) of plan options as selectable surfaces (`surface`, `radius-xl`, padding 20): plan name `h4`, price `price-xl` tabular with "per month" `caption`, three short feature lines. Selected plan has a 2px `foreground` ring and a check. One plan may carry a "Most popular" badge only if it is true and supported by data. The page never fakes scarcity or countdowns.

---

## 11. Patterns: navigation, forms, states, copy

### 11.1 Navigation

**Mobile:** top app bar (56px: logo or back button, title, credit badge) and a bottom tab bar (64px + safe area) with five destinations: **Home, Templates, Create, My flyers, Account**. Tab icons 24px with labels (`micro`, 11px minimum). Selected tab: `foreground` icon and label (filled icon style if available), unselected: `muted-foreground`. The bar is a flat `background` surface with a top `hairline` and `shadow-1`; no blur.

**Desktop (`lg` and up):** left sidebar 248px with the logo, nav items (40px, `rounded-[10px]`, selected `surface`), credit summary and "Buy credits" at the bottom. Top bar only for page-level actions.

**Marketing site:** simple top bar (logo, Templates, Pricing, Log in, and a `brand` "Get started" pill). Collapses to a sheet menu on mobile. No mega menus.

### 11.2 Page patterns

**Landing page.** Order of content (each section must earn its place): hero with the headline, one-line value statement, "Get started" (`brand`, `xl`) and a live before-and-after of a real template; how it works in three honest steps (it is a real sequence); template preview strip; the accuracy promise ("Your price and phone number are always correct") with a real example; pricing summary; FAQ; final call to action; footer with legal links. Use `display-xl` once. Do not add fake logos, testimonials, or statistics.

**Template gallery.** Page title, search field, horizontally scrollable category chips (segmented style, only if filters genuinely help), then template tiles. Sticky filter bar with `shadow-1` on scroll.

**Editor.** Desktop: preview stage fills the flexible area; a 420px form panel sits on the right. Mobile: preview on top (collapsible), form sections below, a sticky bottom bar with the primary action. Sections of the form: Content, Images, Style, Format. Auto-save indicator in the app bar: "Saved" or "Saving…".

**Billing.** Current plan and credits at the top, plan options, billing history as a simple table, and cancel option clearly accessible.

**Legal pages.** Document layout only: 680px reading column, numbered headings, table of contents for long documents, no decorative components.

### 11.3 States

| State | Pattern |
|---|---|
| Empty (no flyers) | Centered short message: "No flyers yet" + "Choose a design" button. No illustration. |
| Empty (no search results) | "No designs match 'xyz'" + "Clear search" ghost button |
| Loading (lists) | Skeleton matching final layout |
| Loading (render) | Generation progress (10.10) |
| Error (network) | Banner "You're offline. Your draft is saved on this phone." with automatic retry |
| Error (render) | Alert with reason and "Try again"; states that no credit was used |
| Error (payment) | "Payment didn't go through" + reason if known + "Try again" |
| Success | Inline confirmation or toast using the same verb as the action |

### 11.4 Copy guide

| Context | Use | Avoid |
|---|---|---|
| Primary CTAs | Get started · Use this design · Generate flyer · Export flyer · Buy credits | Submit · Continue · Proceed |
| Destructive | Delete flyer · Remove logo | Are you sure? (without naming the thing) |
| Low credits | "You have 2 credits left." | "Running low on credits!!" |
| Validation | "Enter a valid phone number, like 0803 123 4567." | "Invalid input" |
| Render failure | "We couldn't create your flyer. No credit was used. Try again." | "Something went wrong" |
| Success | "Flyer exported" | "Success!" |

Microcopy always names the object and the action, uses sentence case, and avoids exclamation marks in system messages.

---

## 12. Accessibility

- Target **WCAG 2.1 AA** for the application interface (contrast values verified in Section 3.5).
- Visible focus ring on every interactive element; logical tab order; Escape closes overlays; focus is trapped in dialogs and returned on close.
- Touch targets at least 44 x 44px, with at least 8px between adjacent targets.
- Never use color as the only signal (add icons, text, or shape).
- Semantic HTML and native controls first; Radix primitives (via shadcn) for complex widgets, preserving their ARIA behavior.
- Every form control has a visible label; errors are announced (`aria-live="polite"`) and associated with fields (`aria-describedby`).
- Icon-only buttons have `aria-label`; template previews have descriptive `alt` text; decorative images use `alt=""`.
- Respect `prefers-reduced-motion` and `prefers-color-scheme` (with a user override saved to the account).
- Support 200% zoom and larger text settings without clipping or horizontal scrolling.
- Test with keyboard only, a screen reader (TalkBack and VoiceOver), and real devices.

---

## 13. Implementation

### 13.1 File structure

```
src/
├── app/
│   ├── globals.css            # tokens (this section)
│   └── layout.tsx             # font + theme provider
├── components/
│   ├── ui/                    # shadcn components, restyled
│   └── sharpflyer/            # template-tile, preview-stage, credit-badge, etc.
├── lib/
│   └── utils.ts               # cn()
└── design/
    └── tokens.md              # link to this document
```

### 13.2 Font setup (`layout.tsx`)

```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext includes the Naira sign (₦)
  variable: "--font-inter",
  display: "swap",
  weight: "variable",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

Verify in the browser that `₦850,000` renders in Inter. If features such as tabular numbers are not available from the hosted subset, switch to `next/font/local` with the official Inter variable file.

### 13.3 Tokens (`globals.css`, Tailwind v4 + shadcn)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Radius base (12px). Scale is defined in @theme below. */
  --radius: 0.75rem;

  /* shadcn semantic tokens (light) */
  --background: #FFFFFF;
  --foreground: #1D1D1F;
  --card: #FFFFFF;
  --card-foreground: #1D1D1F;
  --popover: #FFFFFF;
  --popover-foreground: #1D1D1F;
  --primary: #1D1D1F;
  --primary-foreground: #FFFFFF;
  --secondary: #F5F5F7;
  --secondary-foreground: #1D1D1F;
  --muted: #F5F5F7;
  --muted-foreground: #6E6E73;
  --accent: #F5F5F7;            /* shadcn "accent" = hover surface */
  --accent-foreground: #1D1D1F;
  --destructive: #D70015;
  --border: rgba(0, 0, 0, 0.08);
  --input: #F5F5F7;
  --ring: #0071E3;

  /* SharpFlyer tokens */
  --surface: #F5F5F7;
  --surface-2: #E8E8ED;
  --brand: #0071E3;
  --brand-foreground: #FFFFFF;
  --brand-text: #0066CC;
  --success: #1F7A35;
  --success-tint: #E9F6EC;
  --warning: #B25000;
  --warning-tint: #FFF3E5;
  --danger-text: #C0001A;
  --danger-tint: #FDEBEC;
  --info-tint: #E8F1FD;
  --inverse: #1D1D1F;
  --inverse-foreground: #F5F5F7;
  --overlay: rgba(0, 0, 0, 0.40);

  /* Charts */
  --chart-1: #0071E3;
  --chart-2: #1D1D1F;
  --chart-3: #6E6E73;
  --chart-4: #1F7A35;
  --chart-5: #B25000;

  /* Elevation (light) */
  --shadow-1: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03);
  --shadow-2: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-3: 0 12px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05);
  --shadow-4: 0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.06);

  /* Motion */
  --ease-standard: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}

.dark {
  --background: #000000;
  --foreground: #F5F5F7;
  --card: #1C1C1E;
  --card-foreground: #F5F5F7;
  --popover: #1C1C1E;
  --popover-foreground: #F5F5F7;
  --primary: #F5F5F7;
  --primary-foreground: #1D1D1F;
  --secondary: #1C1C1E;
  --secondary-foreground: #F5F5F7;
  --muted: #1C1C1E;
  --muted-foreground: #A1A1A6;
  --accent: #2C2C2E;
  --accent-foreground: #F5F5F7;
  --destructive: #D70015;
  --border: rgba(255, 255, 255, 0.12);
  --input: #1C1C1E;
  --ring: #2997FF;

  --surface: #1C1C1E;
  --surface-2: #2C2C2E;
  --brand: #0071E3;
  --brand-foreground: #FFFFFF;
  --brand-text: #2997FF;
  --success: #30D158;
  --success-tint: #0F2A17;
  --warning: #FF9F0A;
  --warning-tint: #2B1D05;
  --danger-text: #FF453A;
  --danger-tint: #2E0F0D;
  --info-tint: #0A2036;
  --inverse: #F5F5F7;
  --inverse-foreground: #1D1D1F;
  --overlay: rgba(0, 0, 0, 0.60);

  --chart-1: #2997FF;
  --chart-2: #F5F5F7;
  --chart-3: #A1A1A6;
  --chart-4: #30D158;
  --chart-5: #FF9F0A;

  --shadow-1: 0 0 0 1px rgba(255,255,255,0.06);
  --shadow-2: 0 8px 24px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.08);
  --shadow-3: 0 20px 48px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.10);
  --shadow-4: 0 32px 72px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.12);
}

@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-text: var(--brand-text);
  --color-success: var(--success);
  --color-success-tint: var(--success-tint);
  --color-warning: var(--warning);
  --color-warning-tint: var(--warning-tint);
  --color-danger-text: var(--danger-text);
  --color-danger-tint: var(--danger-tint);
  --color-info-tint: var(--info-tint);
  --color-inverse: var(--inverse);
  --color-inverse-foreground: var(--inverse-foreground);

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 28px;

  --shadow-1: var(--shadow-1);
  --shadow-2: var(--shadow-2);
  --shadow-3: var(--shadow-3);
  --shadow-4: var(--shadow-4);

  --ease-standard: var(--ease-standard);
  --ease-exit: var(--ease-exit);
}

@layer base {
  * { @apply border-border; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    font-feature-settings: "kern", "liga", "calt";
    letter-spacing: -0.006em;
  }
  .tabular { font-variant-numeric: tabular-nums; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

If the project uses **Tailwind v3**, define the same tokens as CSS variables and reference them in `tailwind.config.ts` under `theme.extend.colors`, `borderRadius`, `boxShadow`, and `fontFamily`, keeping identical names.

### 13.4 Text style utilities

Define reusable text styles (as Tailwind `@utility` classes or component variants) so sizes are never improvised:

```css
@utility text-display-xl { font-size: clamp(2.75rem, 1.5rem + 5vw, 4.5rem); line-height: 1.04; letter-spacing: -0.035em; font-weight: 700; }
@utility text-display    { font-size: clamp(2.25rem, 1.4rem + 3.5vw, 3.5rem); line-height: 1.06; letter-spacing: -0.03em; font-weight: 700; }
@utility text-h1 { font-size: clamp(1.875rem, 1.5rem + 1.5vw, 2.5rem); line-height: 1.1; letter-spacing: -0.028em; font-weight: 700; }
@utility text-h2 { font-size: clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem); line-height: 1.2; letter-spacing: -0.022em; font-weight: 600; }
@utility text-h3 { font-size: 1.25rem; line-height: 1.25; letter-spacing: -0.018em; font-weight: 600; }
@utility text-h4 { font-size: 1.0625rem; line-height: 1.3; letter-spacing: -0.012em; font-weight: 600; }
@utility text-body-lg { font-size: 1.0625rem; line-height: 1.5; letter-spacing: -0.011em; }
@utility text-callout { font-size: 0.9375rem; line-height: 1.4; letter-spacing: -0.006em; font-weight: 500; }
@utility text-small { font-size: 0.875rem; line-height: 1.45; }
@utility text-caption { font-size: 0.8125rem; line-height: 1.4; }
@utility text-micro { font-size: 0.75rem; line-height: 1.3; font-weight: 500; letter-spacing: 0.005em; }
@utility text-price { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -0.015em; }
```

### 13.5 `components.json` (shadcn)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 13.6 Theming behavior

- Support **Light, Dark, and System**. Default to System; save the user's choice to their account and to local storage for instant first paint.
- Apply the `dark` class on `<html>` before paint to avoid a flash.
- Flyer previews and exports are **never** affected by the app theme.

---

## 14. Governance and QA checklist

### 14.1 Changing the system

- **Colors:** any new color needs a stated use case, a check that no existing token fits, contrast results, and approval. No one-off hex values.
- **Components:** build from shadcn primitives; if a new component is needed, document its spec here first.
- **Typography:** no new families or weights. New styles require adding a row to the type scale.
- **Shadows and radius:** only the defined levels and tokens.
- Update this document and the token file in the same change as the code.

### 14.2 Design QA checklist (run before shipping any UI)

**System compliance**
- [ ] Only Inter is used; only weights 400, 500, 600, 700.
- [ ] Every color is a token; no raw hex values in components.
- [ ] No gradients, glass or blur, glow, or colored shadows.
- [ ] Shadows appear only on floating layers and the preview stage.
- [ ] Buttons are pill-shaped with the correct height and variant.
- [ ] Radii follow the scale; nested radii are concentric.
- [ ] No CSS Grid; spacing comes from parents; no stacked padding.
- [ ] No bento layouts or unnecessary card collections; no decorative UI.

**Content and copy**
- [ ] Sentence case; plain, specific labels; same verb across the flow.
- [ ] Prices use ₦ with tabular figures; phone numbers never wrap.
- [ ] No invented stats, testimonials, or logos.

**States and behavior**
- [ ] Hover (desktop), focus-visible, pressed, selected, disabled, loading, error, empty, success all designed.
- [ ] Destructive actions confirmed with specific wording.
- [ ] Credit cost shown before consuming actions.

**Responsive and accessibility**
- [ ] Checked at 360, 390, 768, 1024, 1440 widths; portrait and landscape.
- [ ] No horizontal overflow; safe areas respected; inputs 16px or larger.
- [ ] Touch targets 44px or larger; keyboard path verified; focus order logical.
- [ ] Contrast verified for every new combination; reduced motion respected.
- [ ] Light and dark themes both checked.

**Performance**
- [ ] Thumbnails optimized; images have reserved space; no heavy libraries added for styling.
- [ ] Tested on a throttled connection and a mid-range Android phone.

### 14.3 Open items for approval

1. Final logo artwork based on Section 2.3.
2. Whether the landing page uses the `brand` (blue) or `default` (ink) button for the hero call to action (recommended: blue).
3. Confirmation that Inter's hosted subset supports the required OpenType features, or a switch to self-hosted files.
4. A decision on replacing or approving any shadcn component that uses CSS Grid internally.
5. Dark mode default: System (recommended) or Light only for launch.
