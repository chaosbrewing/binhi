# BINHI Universal Icon Library

250 production-ready vector icons (25 categories × 10, numbers 001–250) that people can insert into websites and
graphic designs, restyle, save, reopen and export. Status: implemented on branch `claude/binhi-icon-library`,
**not merged and not published** (see [`RELEASE_CHECKLIST_ICONS.md`](RELEASE_CHECKLIST_ICONS.md)).

Two roles are kept apart on purpose:

| Role | Where | Source of truth |
| --- | --- | --- |
| BINHI interface icons (buttons, rail, toolbar) | `src/client/components/Icons.tsx` | unchanged; not part of the library |
| User-insertable creative icons | this library | `src/core/icons` (registry) |

## What a person can do

- **Find** any of the 250 icons: search by name, synonym or intent ("photo" → Camera, "remove" → Delete, "gear" →
  Site Settings), browse 25 categories, All / Favorites / Recent, filter by style.
- **Insert** into a website (left rail → **Icons**, or Elements → Icon) or into a design (**Icon** in the toolbar).
- **Customise**: size (12/16/20/24/32/48/64/96/128 px presets or any custom size), colour (auto, theme/brand-kit
  colour, any colour), stroke weight 0.5–4, style (outline, duotone, filled, inverted badge, brand colour),
  validated gradient, rotation, flip, opacity, link (website), decorative vs meaningful with an accessible label.
- **Save and reopen** — icons are stored by canonical id and settings, never as markup.
- **Output**: websites render the SVG inline (editor, preview, published page); designs export PNG/JPEG (pixels from
  the vector, no icon fonts) and SVG (icons stay vector paths).

## Registry contract (`src/core/icons`)

One authoritative, versioned registry. `buildRegistry()` refuses to start on a wrong total, numbering gap, duplicate
id/slug, or unknown category (it runs at module load, and tests mutate the catalog to prove it rejects).

| Field | Meaning |
| --- | --- |
| `id` | canonical, stable, stored in documents: `binhi.icon.<slug>` (e.g. `binhi.icon.camera`) |
| `number`, `name`, `category`, `categoryName` | fixed 001–250 inventory; names/categories are exactly the product list |
| `source` / `licence` | `lucide` (ISC) or `original` (BINHI) with holder and note — see [`ICON_LICENSES.md`](ICON_LICENSES.md) |
| `keywords` / `tags` | curated BINHI synonyms and intents / Lucide's own tags (ranked lower in search) |
| `variants` | only variants that are actually valid for that icon (below) |
| `viewBox`, `a11y`, `version`, `deprecated` | `0 0 24 24`, default label + decorative-by-default, `1`, optional `{since, replacedBy}` |

Files: `scripts/icons/catalog.mjs` (authoritative mapping), `scripts/icons/generate.mjs` (writes
`src/core/icons/generated/**` and `docs/ICON_INVENTORY.md`), `src/core/icons/{registry,render,safe,search,shapes,
shapes-all,spec}.ts`. Per-icon list: [`ICON_INVENTORY.md`](ICON_INVENTORY.md).

### Variants — only where they are honest

| Variant | Available for | How it is decided |
| --- | --- | --- |
| Outline | all 250 | default |
| Inverted badge | all 250 | glyph on a rounded colour tile |
| Brand colour | all 250 | uses the theme/brand-kit colour (a colour preset, not different geometry) |
| Duotone | 175 | the icon has at least one fully closed shape (computed by the generator; a unit test keeps it in step with `isClosedNode`) |
| Filled | 17 | curated list in `scripts/icons/variants.mjs`, each checked on the contact sheet (single closed silhouettes: star, heart, circle, shield, …) |

Requesting an unsupported variant is rejected by the schema (`iconUsageProblem`), not silently downgraded.

### Rendering — one engine

`renderIconSvg(nodes, options)` builds the SVG string for the website renderer, the editor canvas, the browser
previews and the Design Studio export. There is no second renderer and no icon font. Geometry only ever comes from
registry data that passed `iconProblem()`.

## Where each icon lives (performance)

- **Metadata** (names, keywords, flags; ~44 KB) is part of the core bundle because validation needs it.
- **Geometry** is split into 25 category chunks (~1–3 KB each, 47 KB total raw). The browser downloads a category only
  when an icon from it is shown or used; the e2e asserts that opening the Icons tab fetches fewer than 25 chunks.
- **Published sites** inline only the icons the page uses (the all-categories resolver is server-only and never in
  the browser bundle). A page with one icon stays ~21 KB including the theme CSS.
- Measured main client bundle (Vite): 597.2 KB → 678.5 KB raw, 169.3 KB → 194.3 KB gzip. The increase covers the
  metadata, the icon browser, the website icon editor and the Design Studio icon layer. Route-level code splitting
  of the editor (not done in Phase 1) would recover most of it; it was left out of scope.

## Website Builder

The existing `icon` component keeps its 20 built-in names exactly as they rendered before (verified by a render test
and the e2e). New props: `icon` (canonical id, takes precedence), `variant`, `strokeWidth`, `rotation`, `flipX`,
`flipY`, `gradient`. Size, colour (`style.color`), opacity, margin/padding/border/background, link, responsive
visibility, hover and entrance animation reuse the shared style/interaction system; the accessible label and the
decorative flag use the shared `a11y` fields. A linked icon always gets an accessible name (its label, else the
icon's name); an explicitly decorative, unlinked icon never does.

Publishing refuses a document that holds an unresolvable icon id (`UNKNOWN_ICON`) and refuses to render a library
icon without geometry in publish mode. Templates keep legacy names; both forms are validated for every template.

## Design Studio

`icon` is a fifth layer type (`type: "icon"`, `icon`, `variant`, `strokeWidth`, `color`, `gradient`, `flipX/flipY`,
`label` plus the shared position/size/rotation/opacity/lock/hide). The registry check runs in
`DesignDocument.superRefine`, so the server, the editor and templates all enforce it. Duplicate, copy/paste,
lock/hide, layers order and undo/redo work as for other layers; brand-kit colours apply with one click.

Export: PNG/JPEG rasterise the SVG at on-canvas size (verified by pixel checks in the e2e); **Export SVG** keeps
shapes, text and icons as vectors and embeds library images as data URIs (fonts are not embedded).

## Security

Icon content is data, never markup. Defences, each with tests:

| Threat | Control |
| --- | --- |
| Script / `foreignObject` / `use` / event handlers / external refs in geometry | tag + attribute allowlist (`safe.ts`); `fill` may only be `currentColor`; path data and numbers pattern-checked; failing nodes are dropped at render and rejected at load |
| Markup smuggled through props | documents store only the canonical id and typed settings; unknown keys are stripped; ids must match `^binhi\.icon\.[a-z0-9-]+$` and resolve |
| Unsafe colours / gradient stops | the shared `Color` validator (no `url()`, `javascript:`, `expression()`); the renderer re-validates and falls back to `currentColor` |
| Oversized or malformed values | size 8–400 (websites), stroke 0.5–4, rotation ±360, ≤ 24 nodes per icon |
| Cross-account access | icon layers/elements live inside the owner's project/site, so existing owner checks apply (404 for others; covered by integration and e2e tests) |
| Published pages | inline SVG under the existing `default-src 'none'` CSP; no scripts added |

## Accessibility (WCAG 2.2 AA)

Search field and every control have programmatic labels; the grid is a list of real buttons with the icon name as
accessible name and arrow/Home/End navigation; results announce through a polite live region; favourites are
toggle buttons (24 px minimum target; always visible on touch devices); focus is trapped in dialogs and restored;
colour is never the only state indicator (selection also uses `aria-pressed`); animations respect
`prefers-reduced-motion`; icons are decorative unless labelled; the dialog was checked at 390 px and 820 px. A full
axe/screen-reader pass is still a release task (not automated here).

## Visual consistency

All 250 icons share a 24×24 grid, 2 px round strokes and no fills in the outline style. Every icon was reviewed on
contact sheets (`node --import tsx scripts/icons/contact-sheet.ts <dir>` renders outline/duotone/filled/inverted for
all categories). The review changed: Horizontal/Vertical Flip (axes were swapped), Bring Forward/Send Backward (layer
arrows), eight duplicate glyphs resolved with distinct icons, and five BINHI originals drawn (Opacity, Color Swatches,
Portrait, Landscape, Tabs).

## Adding or changing an icon

1. Edit `scripts/icons/catalog.mjs` (mapping/keywords) or `original.mjs` (BINHI geometry) and, for filled, `variants.mjs`.
2. `node scripts/icons/generate.mjs <extracted lucide-static@1.61.0>` (see `ICON_LICENSES.md`).
3. Run the contact sheet and look at it; run `npm run test:unit` (registry integrity, duplicate-glyph and safety tests).
4. IDs are permanent: never reuse or renumber; deprecate with `{since, replacedBy}` instead.

## Known limitations

- **Photo Editor**: it is a non-destructive recipe editor with no layers, so icons are not inserted there; build a
  graphic in the Design Studio (a photo can be an image layer) and export it.
- **Grouping** of design layers is not implemented (the Phase 1 editor has single selection); icons can be
  duplicated, copied, locked, hidden, ordered and aligned numerically.
- Chromium only was executed here (Firefox/WebKit are not installed in this environment); the features used (inline SVG,
  `Image.decode`, canvas, `<input type=color>`) are standard.
- Fonts in design text are not embedded in SVG/PNG exports (unchanged from Phase 1).
- Rollback note: a previous build cannot open a design that contains icon layers (its strict layer union rejects the
  new type), and it renders a library icon on a website as the default star; saving that element from the older
  build would drop the icon id. No database migration is involved.
- Per-browser favourites/recents (`localStorage`) are conveniences and do not follow the account.
- Icon registry integration with ORIGIN/TALA/AGOS/LIYAB/LIPAD is by contract only: ids are plain strings in BINHI
  documents; BINHI imports nothing from them and they import nothing from BINHI.
