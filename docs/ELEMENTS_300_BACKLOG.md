# BINHI Elements 300 — architecture and implementation backlog

**Status: planned. Nothing in this document is implemented.** There are **0 of the 300** graphic elements today: no
vector assets exist, no element picker exists, and no editor behaviour for them exists. They must not be shown in
the product, described as available, or counted in release notes until their actual vector assets and editor
behaviour have passed the gates in §8. Essential 250 (the icon library, `docs/ICON_LIBRARY.md`) is a separate,
implemented system and is **not** a substitute for any of this.

## 1. What Elements 300 is (and is not)

| | Essential 250 icons | Elements 300 (planned) |
| --- | --- | --- |
| Purpose | small single-colour symbols for UI and content | decorative and structural graphics: frames, dividers, shapes, badges, ribbons, speech bubbles, arrows, patterns, stickers, simple illustrations |
| Colour model | one colour (plus duotone/inverted treatments) | several **colour slots** (primary / secondary / accent / neutral) that map to theme and brand-kit colours, plus optional gradients |
| Geometry | strokes on a 24×24 grid | arbitrary viewBox; fills, strokes, gradients, clip paths; some elements stretch (frames, dividers) |
| Ids | `binhi.icon.<slug>` | `binhi.element.<slug>` (proposed; same rules: canonical, permanent, deprecate-don't-delete) |
| Where used | website `icon` element, design `icon` layer | website `graphic` element, design `element` layer (both new) |

Not in scope: user-uploaded SVG (a separate, much larger security problem), AI-generated art, animated elements,
photo stock. Those would each need their own directive.

## 2. Prerequisites that must land first

1. **Forward-compatible design layers** (from `ICON_COMPATIBILITY.md`, "Not done here"). Elements add a layer type;
   today an unknown layer type makes a whole design unreadable in an older build. Needed: an envelope that keeps
   unknown layers verbatim, shows them as locked placeholders, and writes them back unchanged — client and server,
   with the older-build harness extended to prove it. Without this, rollback of Elements repeats the icon caveat for
   every design.
2. **Licensing gate for assets** (§5). No asset enters the repository without recorded provenance.
3. **Decision on the 300 list.** The category structure below is a proposal; the founder approves the final list of
   300 names before any art is commissioned or sourced. No inventory is invented here.

Already in place and reusable: the validated operation pipeline with deterministic ids (`idSeeds`), the kill-switch
pattern (`BINHI_ICON_LIBRARY`), the shared SVG builder and geometry allowlist, lazy per-category chunks and the CI
bundle budget, the axe + keyboard e2e pattern, the rollback preflight pattern, the licence-notice mechanism.

## 3. Proposed architecture

**Registry** (`src/core/elements`, mirror of `src/core/icons`): `ElementDefinition { id, number, name, category,
source, licence, keywords, viewBox, colourSlots[], stretch: "none" | "uniform" | "nine-slice" | "line", minSize,
a11y, version, deprecated? }`, built by a generator from a committed catalog; the registry refuses duplicate ids,
gaps, unknown categories and unresolved assets. Geometry in lazy category chunks; metadata small in the main bundle;
search vocabulary lazy with the browser.

**Asset format** (not arbitrary SVG): a constrained node list like icons, extended with `linearGradient`/`radialGradient`
defs, `clipPath`, `g` and per-node `fill` referencing a **slot** (`slot:primary`) instead of a colour. The allowlist
(`safe.ts` analogue) rejects script, `foreignObject`, `use`/`image`/external references, event handlers, `style`,
filters/masks until each is individually reviewed. Slot colours are applied by the renderer from validated colour
values, never from asset text.

**Stored references**: documents hold the canonical id plus typed settings (`slots: {primary?: Color, …}`,
`flipX/flipY`, `rotation`, `opacity`, stretch size). No markup is ever stored.

**Rendering**: one builder (`renderElementSvg`) used by the website renderer, the canvas, previews and exports —
the same "one engine" rule as icons. Published pages inline only the elements they use; fixed set of IDs is
namespaced to avoid gradient-id collisions.

**Editor**: website `graphic` element (size, slots, opacity, link, responsive visibility, decorative vs meaningful,
alt text); Design Studio `element` layer (slots, flips, rotation, opacity, stretch handles for nine-slice and line
endpoints, lock/hide, duplicate, copy/paste, layer order, brand-kit colours, undo/redo); a shared browser (reuse the
icon browser shell: search, categories, favourites, recents, keyboard grid, a11y audit).

**Export**: PNG/JPEG via the shared rasteriser; SVG keeps elements vector (slots resolved to colours at export).

**ORIGIN/TALA/AGOS/LIYAB/LIPAD**: by contract only. Element ids are opaque strings in BINHI documents; TALA may
propose `Operation[]` batches that reference them through the existing validated endpoint; no ORIGIN tables, no dual
writes, no shared runtime dependency (`ORIGIN_INTEGRATION.md`).

## 4. Proposed categories (for approval, counts are targets, not inventory)

Frames and borders · Dividers and lines · Basic shapes and blobs · Arrows and pointers · Speech bubbles and callouts ·
Badges, stamps and ribbons · Buttons and tags (decorative) · Backgrounds and patterns · Stickers and marks · Nature and
organic accents · Business and infographic parts · Social and celebration. About 25 per category; the final names and
numbers are a founder decision (§2.3).

## 5. Asset sourcing and licensing gate

Every asset needs a provenance record before merge: source (original BINHI/commissioned/CC0/permissive licence),
author, licence text and URL, date, whether modified, and the pinned version if from a package. Allowed: original work
for BINHI (with a written assignment if commissioned), CC0/public-domain, permissive licences whose notice
obligations are met (as done for Lucide in `ICON_LICENSES.md`). Not allowed: scraping or tracing Canva, Wix, Adobe or
any commercial pack; unclear-licence downloads; assets whose licence forbids redistribution inside a product.
AI-assisted drawings need the same founder/legal confirmation noted for the five icon originals. The pipeline fails a
build when an asset lacks a provenance record (as the generator does for icons).

## 6. Implementation backlog (ordered, each with an acceptance gate)

| # | Item | Gate |
| --- | --- | --- |
| E0 | Founder approves the 300 list, categories and sourcing plan | written approval |
| E1 | Forward-compatible design layer envelope (§2.1) + extended older-build harness | harness shows older build preserves and ignores unknown layers; no data loss |
| E2 | Element asset format, sanitiser allowlist, generator, registry + integrity tests (empty/small seed set only) | security tests (script, foreignObject, external refs, gradients/clip abuse) pass; registry rejects duplicates/unresolved |
| E3 | Renderer + slot colouring + export (PNG/JPEG/SVG) for a seed set of ~10 real assets | pixel-verified exports; one-engine test |
| E4 | Browser, website `graphic` element, design `element` layer, stretch behaviours | e2e journey (insert → customise → save → reopen → undo/redo → publish/export), axe + keyboard audit |
| E5 | Asset production in batches of ~25 per category, each through the licence gate and a contact-sheet review | provenance complete, visual consistency review, inventory generated (not hand-written) |
| E6 | Performance and bundle budgets for 300 elements (lazy chunks, no embedding of unused assets in published sites) | `check:bundle` extended; published page size test |
| E7 | Kill switch (`BINHI_ELEMENTS`), rollback preflight for element content, compatibility doc | integration + e2e with switch off |
| E8 | Release gate: full regression, licence audit, accessibility audit, founder approval | release checklist YES with evidence |

Counting rule: the product may say "N elements" only when N is the number of assets that passed E5 and are
resolvable in the registry (a test generates the number from the registry; it is never typed by hand).

## 7. Risks

- Rendering gradients, clip paths and masks multiplies the security and cross-browser surface; keep the first release
  to solid slot fills + simple linear gradients.
- Nine-slice and line-end stretching are editor behaviours, not just art; they need design and testing time.
- Art production is the long pole and cannot be generated by code; the schedule is driven by E5.
- Older builds and rollback: until E1 is done, every new layer type repeats the icon rollback hazard.

## 8. Definition of "implemented"

An element counts as implemented only when: its vector asset exists in the registry with a provenance record; it
renders identically in the website editor, preview, published page and Design Studio export; it can be inserted,
recoloured through slots, saved, reopened, undone/redone and exported; the automated accessibility and keyboard audit
passes; and it appears in the generated inventory. Until then it is backlog.
