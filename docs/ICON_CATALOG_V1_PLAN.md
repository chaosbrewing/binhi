# Icon Catalog v1.0 (ICN-001–250) — coverage analysis and migration plan

**Status: plan only.** Decision recorded 2026-10-25: the "Engineering Specification & Catalog v1.0" is analysed and
planned; **no code in PR #2 changed** and nothing here is merged or published. This document, the analysis scripts and
the mapping data live on branch `claude/binhi-icon-catalog-v1-plan` (no PR).

## 1. Headline

Two different 250-icon inventories now exist: the **Essential 250** built in PR #2 (names and categories from the
earlier directive) and this **v1.0 catalog** (different categories, names, ids `ICN-001…250`, 1.5 px stroke, 20×20
live area). Only about a third of concepts overlap. They cannot both be "the 250"; the founder must say which is
canonical (§7, question 1). The engineering platform in PR #2 (registry, renderer, browser, website/design
integration, compatibility tooling, tests) is inventory-agnostic, so switching inventories is mostly **art and data**,
not a rewrite.

| Class | Meaning | Count | Share |
| --- | --- | --- | --- |
| **S** shipped | same concept already exists in Essential 250 (reuse; restyle to the new grid) | 75 | 30 % |
| **L** Lucide | a suitable Lucide glyph exists but is not in the set yet (ISC; no drawing needed) | 70 | 28 % |
| **C** compose | needs a new glyph built from Lucide parts or modified Lucide glyphs plus original strokes | 80 | 32 % |
| **O** original | no usable source; must be drawn from scratch | 25 | 10 % |

So **145 icons (58 %) need no new drawing**; **105 (42 %) need new or modified artwork** (80 composed + 25 original),
the long pole. Classes are my judgement of concept equivalence, not byte-identical geometry; every Lucide and shipped
reference is machine-checked to exist (`node scripts/icons/v1-catalog/analyze.mjs <lucide-static dir>`), but each
choice needs a visual review on a contact sheet before it is final. Per category numbers are in the appendix; the
art-heavy categories are C05 Vector & Path (5 original), C07 Retouching (4 original), C23 Filters & Effects
(7 original) and C11 Masks (3 original, 4 compose); the cheapest are C10 Layers (all 10 covered), C12 Transform
(8 shipped) and C21 Code/CMS (8 Lucide).

## 2. What conflicts with what is already built

| Topic | Spec v1.0 | PR #2 today | Consequence |
| --- | --- | --- | --- |
| Inventory | 25 categories (C01 Selection & Pointer Tools … C25 System, Settings & Publishing), 250 names | 25 categories from the earlier directive (Navigation, Editing, Selection, …) | different names, order and numbers; 75 concepts overlap |
| Ids | `ICN-001…250` + slugs like `cursor-default` | `binhi.icon.<slug>`, numbers 1–250 | keep canonical `binhi.icon.<slug>` and add `ICN-NNN` as a permanent alias (see §5); nothing is published yet, so ids are still cheap to change **before** the first publish |
| Default stroke | 1.5 px, 2.0 px "bold/active" | 2 px default, adjustable 0.5–4 | a renderer/profile default change; already-saved icons store their own stroke and keep it |
| Live area | geometry + stroke inside 20×20 (2 px margin) | Lucide geometry as shipped | **measured:** with a 2 px stroke 172 of the 250 shipped icons extend past the 2 px margin (170 at 1.5 px). They need a uniform ~0.91 scale profile (or redraw), not individual fixes |
| Corner radii | outer 2, inner 1 | whatever each glyph has (Lucide mostly 2) | audit by eye; not mechanically enforceable |
| Rendering | `<use href="/assets/binhi-icons.svg#ICN-001">` sprite | inline SVG built from allowlisted geometry | see §5: the sprite approach breaks three existing guarantees |
| Single colour | `stroke: currentColor`, `fill: none` | same, plus duotone/filled variants for some icons | ~12 spec entries need fills or colours (§4) |

## 3. Problems inside the spec text itself (to be fixed before it becomes the source of truth)

1. The detail list has two sections headed "Category 09" (Color, Palette & Swatches and Layer Operations & Hierarchy);
   the second is C10 by the index table. IDs are right, the heading is wrong.
2. ICN-097 "Layer Visibility (Show/Hide)" describes two states (open eye, slashed eye) under one id. A catalog id is one
   glyph; either add a second id or define the slash as a state of the same icon (as `ICN-183` toggle and `ICN-184`
   checkbox "checked" already imply states).
3. Entries that need **colour semantics** a one-colour stroke icon cannot carry: ICN-236 (green stamp), ICN-237
   (green added / red removed), ICN-230 (RGB split), ICN-219 (thermal gradations), ICN-083/084/085 (gradients), ICN-239
   (teammate avatar, dynamic), ICN-090 (droplet + warning). Proposed: single-colour glyph + optional duotone, with
   colour left to the product (not baked into the asset).
4. Entries that need **solid fills** although the base rule is `fill: none`: ICN-048/049/050 (boolean union/subtract/
   intersect "solid"), ICN-088 (reset chips), ICN-105/108/109 (mask black/white fields), ICN-078 (half-dark disc). The
   renderer already supports a closed-shape fill treatment; the spec needs an explicit fill exception rule.
5. Entries that contain **literal text or numerals** which will not read at 16 px: ICN-014 ("1:1"), ICN-039 (@1x/@2x/@3x),
   ICN-089 ("1"), ICN-140 ("16:9"), ICN-167 (1 2 3), ICN-203 ("js"), ICN-211 ("H" + "1"), ICN-231 (names), plus glyph
   letters (ICN-122/123/124/126/128/129/130). Letters as shapes are fine; digits and words need pictographic
   alternatives or a larger minimum size.
6. Several entries are near-duplicates at 16 px (ICN-143/144/145 justify variants, ICN-153/154/155/156 devices,
   ICN-141/142, ICN-132/133, ICN-048/049/050). The 16 px legibility requirement should be tested with a contact sheet
   at 16/20/24/32 before sign-off.
7. Ten of the Lucide glyphs that would satisfy v1.0 entries are **already used in PR #2 for a different meaning**
   (`square-dashed`, `circle-dashed`, `align-horizontal-space-between`, `audio-lines`, `file-search`, `code-xml`,
   `network`, `gauge`, `at-sign`, `diff`). The generator rejects two ids with the same glyph, so either the second
   meaning gets a distinct glyph or the pair is declared a deliberate alias.

## 4. Technical deltas (what changes in the engineering)

**Inventory-specific (regenerated or rewritten):** `scripts/icons/catalog.mjs`, `original.mjs`, `variants.mjs`, the
generated catalog/keywords/shape files, `docs/ICON_INVENTORY.md`, and the inventory assertions in
`tests/unit/icons.test.ts` (category names, #1/#12/#250 names, the five originals), `icon-licensing.test.ts` (204/41/5
counts), the legacy fallback map (`LEGACY_FALLBACK_NAMES`) and the search synonyms/keywords.

**Inventory-agnostic (stays):** registry builder and integrity checks, safe renderer and allowlist, lazy chunks and
bundle budget, icon browser, website element, design layer, SVG export, kill switch, rollback preflight, compat docs,
deterministic ids, axe/keyboard e2e, licence notice mechanism.

**New engineering the spec implies:**
1. *Grid profile.* Add a per-library `grid` profile (`v1`: 20×20 live area, default stroke 1.5, bold 2.0). Lucide
   geometry is placed with `translate(12 12) scale(0.909) translate(-12 -12)` and the stroke divided by the scale so
   the visible stroke stays 1.5; originals are drawn natively on the 20×20 area. The renderer already takes
   `strokeWidth`; the profile is data. 1.5 px is the right call for crispness: at 16 px a 24-unit icon scales ×0.667
   so 1.5 → 1.0 px (pixel-aligned) while 2.0 → 1.33 px (blurry).
2. *Alias ids.* Add `aliases: ["ICN-001"]` to the registry and emit `data-binhi-id` / `data-icon-alias` for tooling.
   Aliases are permanent and unique; the registry integrity test enforces it.
3. *Fill exception* for the ~8 solid entries (closed-shape `filled` treatment, already supported).
4. *Active/bold state* = the same icon at stroke 2.0 (no new asset).
5. *Sprite (optional, UI chrome only).* If a sprite is wanted for BINHI's own interface, generate a same-document
   `<symbol>` sprite at build time. Do **not** adopt the external `<use href="/assets/binhi-icons.svg#…">` component
   for user content: (a) the geometry allowlist deliberately rejects `use`/`href`, (b) an `<img>`-rasterised SVG
   cannot resolve an external sprite, so PNG/JPEG export of designs would render blank icons, (c) published sites
   would gain a network dependency and a CSP surface, and (d) it defeats "publish only the icons the page uses".
   `BinhiIcon` should be a thin wrapper over the existing `IconGlyph` instead.

## 5. Art and licensing workload

- **L (70):** Lucide, ISC: no drawing; add attribution as today; run the Feather-by-geometry check.
- **C (80):** modified/composed from Lucide parts: ISC permits modification; record parentage in the catalog;
  needs a drawer for the joins and a contact-sheet review. Batch ~25 per pass.
- **O (25):** original art. Needs the same provenance record as the five existing originals, plus a written
  decision on AI-assisted authorship (open question for the founder/legal) or a commissioned designer with an
  assignment.
- **S (75):** reuse, then re-profile to the 20×20/1.5 grid and re-review.
No asset is scraped or traced from Canva, Wix, Adobe or any commercial pack; "reference" screenshots of those tools
must not be used as tracing sources.

## 6. Recommended path (if v1.0 becomes canonical)

Because PR #2 is unmerged and unpublished, ids are not yet a permanent contract; this is the cheapest moment to
choose. Recommended sequence, each step with an exit gate:

| # | Step | Exit gate |
| --- | --- | --- |
| P0 | Founder decisions (§7) | written answers |
| P1 | Fix the spec text (§3) and freeze the v1.0 inventory (names, slugs, ICN numbers, states) | signed-off catalog file |
| P2 | Land PR #2 as the engineering platform with Essential 250 data, **unpublished**, or hold publication until P5 | merge approved; not published |
| P3 | Generator + registry changes: `aliases`, grid profile, fill-exception rule, new catalog source; regenerate with S + L entries only (145) | registry integrity, no duplicate glyph, contact sheets at 16/20/24/32 |
| P4 | Draw/compose C (80) in batches of ~25, then O (25); provenance record for each | per-batch contact-sheet review + licence audit |
| P5 | Re-run the full regression and the audits (unit/integration, website, studio, icon journeys, axe, bundle budget); update docs, inventory, licence counts | all green; release checklist re-issued with new evidence |
| P6 | Publish staged behind `BINHI_ICON_LIBRARY` as already planned | founder approval |

If instead v1.0 is a *later* library (Pro/Web-Tools set), ids should live in their own namespace so Essential 250
ids stay permanent; the 145 overlap/Lucide entries could ship as a "v1 extension" immediately and the 105 art items
follow with Elements 300.

## 7. Questions only the founder can answer

1. Is v1.0 the canonical Essential 250 (replacing the inventory built in PR #2), a second library, or reference only?
2. Should ids be `binhi.icon.<slug>` with `ICN-NNN` aliases (recommended), or `ICN-NNN` as the canonical id?
3. Who produces the 105 non-Lucide icons (in-house AI-assisted, commissioned designer, mix), and is AI-assisted
   authorship acceptable for original assets?
4. Is the 20×20 live-area/1.5 px rule mandatory for all icons, or only for icons authored natively (i.e. may Lucide
   glyphs be scaled by the profile in §4)?
5. How should state-bearing entries (ICN-097 show/hide, ICN-183/184/185 toggle/checkbox/radio states) be modelled?

## Appendix A — files

- `scripts/icons/v1-catalog/catalog-v1.tsv` — the 250 entries as received (id, slug, name, category)
- `scripts/icons/v1-catalog/v1-mapping.tsv` — class and basis per entry
- `scripts/icons/v1-catalog/analyze.mjs` — validates the mapping against shipped slugs and Lucide, prints counts
- `scripts/icons/v1-catalog/measure-grid.ts` — measures the live-area rule on the shipped icons (Chromium `getBBox`)

## Appendix B — per-entry coverage

**C01 Selection & Pointer Tools** — shipped 2 · Lucide 4 · compose 3 · original 1

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 001 | Pointer Cursor | shipped | `binhi.icon.selection-cursor` |
| 002 | Direct Selection Cursor | Lucide | Lucide `mouse-pointer` |
| 003 | Rectangular Marquee | Lucide | Lucide `square-dashed` |
| 004 | Elliptical Marquee | Lucide | Lucide `circle-dashed` |
| 005 | Freehand Lasso | Lucide | Lucide `lasso` |
| 006 | Polygonal Lasso | compose | lasso + straight segments |
| 007 | Magnetic Lasso | original | lasso with edge-snap anchors |
| 008 | Magic Wand | shipped | `binhi.icon.magic-wand` |
| 009 | Quick Selection Brush | compose | brush + dashed circle |
| 010 | Object / Subject Finder | compose | scan + silhouette |

**C02 Viewport & Navigation** — shipped 4 · Lucide 4 · compose 2 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 011 | Hand / Pan Tool | Lucide | Lucide `hand` |
| 012 | Zoom In | shipped | `binhi.icon.zoom-in` |
| 013 | Zoom Out | shipped | `binhi.icon.zoom-out` |
| 014 | Zoom to 100% / Actual Pixels | compose | zoom + "1:1" |
| 015 | Fit Artboard to Window | shipped | `binhi.icon.fit-to-screen` |
| 016 | Artboard Tool | Lucide | Lucide `frame` |
| 017 | Horizontal & Vertical Rulers | Lucide | Lucide `ruler-dimension-line` |
| 018 | Canvas Guides | compose | crossed dashed lines |
| 019 | Snap to Grid Toggle | shipped | `binhi.icon.snap-to-grid` |
| 020 | Split Dual View | Lucide | Lucide `square-split-horizontal` |

**C03 History & Core File Operations** — shipped 4 · Lucide 4 · compose 2 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 021 | Undo | shipped | `binhi.icon.undo` |
| 022 | Redo | shipped | `binhi.icon.redo` |
| 023 | History Timeline / State | shipped | `binhi.icon.version-history` |
| 024 | Snapshot / Checkpoint | compose | aperture badge + stack |
| 025 | Revert to Original | Lucide | Lucide `rotate-ccw` |
| 026 | Save Document | shipped | `binhi.icon.save` |
| 027 | Save As / Duplicate Project | Lucide | Lucide `save-all` |
| 028 | Auto-Save Indicator | Lucide | Lucide `cloud-check` |
| 029 | Version Branching | Lucide | Lucide `git-branch` |
| 030 | Document Audit Trail | compose | shield-check + ledger |

**C04 Document, Project & Export** — shipped 0 · Lucide 4 · compose 6 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 031 | New Project | Lucide | Lucide `file-plus` |
| 032 | Open Existing Asset | Lucide | Lucide `folder-open` |
| 033 | Import File | Lucide | Lucide `import` |
| 034 | Quick Export | Lucide | Lucide `hard-drive-upload` |
| 035 | Vector SVG Export | compose | file + pen node |
| 036 | Raster PNG Export | compose | file + checkerboard |
| 037 | JPEG Compression Export | compose | file + landscape |
| 038 | WebP / Modern Web Image | compose | file + bolt |
| 039 | Multi-Scale Asset Slices | compose | knife over @1x/@2x/@3x |
| 040 | Print PDF / CMYK Export | compose | file + trim marks |

**C05 Vector & Path Editing** — shipped 2 · Lucide 0 · compose 3 · original 5

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 041 | Pen Tool | shipped | `binhi.icon.pen-tool` |
| 042 | Add Anchor Point | compose | pen + plus |
| 043 | Delete Anchor Point | compose | pen + minus |
| 044 | Convert Point / Smooth-Sharp | original | vertex to arc with handle |
| 045 | Curvature Tool | original | curve with tangent balls |
| 046 | Knife / Path Cutter | compose | blade + path |
| 047 | Scissors / Point Splitter | shipped | `binhi.icon.cut` |
| 048 | Boolean Union | original | boolean union |
| 049 | Boolean Subtract | original | boolean subtract |
| 050 | Boolean Intersect | original | boolean intersect |

**C06 Raster & Painting Tools** — shipped 5 · Lucide 2 · compose 3 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 051 | Round Paintbrush | shipped | `binhi.icon.paintbrush` |
| 052 | Airbrush | Lucide | Lucide `spray-can` |
| 053 | Pencil Tool | shipped | `binhi.icon.edit` |
| 054 | Paint Bucket | shipped | `binhi.icon.paint-bucket` |
| 055 | Eraser Tool | shipped | `binhi.icon.eraser` |
| 056 | Smudge / Finger Blend | compose | finger + blur wake |
| 057 | Soft Blur Brush | shipped | `binhi.icon.blur` |
| 058 | Sharpen Brush | Lucide | Lucide `gem` |
| 059 | Spray / Scatter Brush | compose | stipple cluster |
| 060 | Pressure Sensitivity Mode | compose | stylus + variable-width line |

**C07 Photo Retouching & Healing** — shipped 3 · Lucide 0 · compose 3 · original 4

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 061 | Spot Healing Brush | shipped | `binhi.icon.healing-brush` |
| 062 | Patch Tool | compose | patch + stitches |
| 063 | Clone Stamp | shipped | `binhi.icon.clone-stamp` |
| 064 | Pattern Stamp | compose | stamp + grid |
| 065 | Content-Aware Fill | compose | lasso + sparkles |
| 066 | Dodge Tool (Lighten) | original | dodge wand |
| 067 | Burn Tool (Darken) | original | burn hand |
| 068 | Sponge Tool (Saturation) | original | sponge |
| 069 | Red-Eye Removal | shipped | `binhi.icon.red-eye-correction` |
| 070 | Teeth / Object Whiten | original | tooth + glints |

**C08 Photo Adjustment & Grading** — shipped 3 · Lucide 2 · compose 4 · original 1

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 071 | Curves Adjustment | Lucide | Lucide `spline` |
| 072 | Levels Adjustment | compose | histogram + triangles |
| 073 | Brightness / Contrast | shipped | `binhi.icon.contrast` |
| 074 | Exposure Value | shipped | `binhi.icon.exposure` |
| 075 | Vibrance & Saturation | shipped | `binhi.icon.saturation` |
| 076 | Hue Wheel / HSL | compose | three overlapping circles |
| 077 | Color Balance | Lucide | Lucide `scale` |
| 078 | Black & White Conversion | original | half-split disc |
| 079 | Invert Tones | compose | two inverting arrows |
| 080 | Color Lookup Table (LUT) | compose | cube + gradient points |

**C09 Color, Palette & Swatches** — shipped 3 · Lucide 1 · compose 5 · original 1

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 081 | Eye Dropper / Pipette | shipped | `binhi.icon.eyedropper` |
| 082 | Color Swatch Palette | shipped | `binhi.icon.artist-palette` |
| 083 | Linear Gradient | shipped | `binhi.icon.gradient` |
| 084 | Radial Gradient | Lucide | Lucide `target` |
| 085 | Angular / Conic Gradient | compose | conic sweep disc |
| 086 | Hexadecimal Code Picker | compose | hash + lens |
| 087 | Foreground / Background Swap | compose | two chips + swap arrows |
| 088 | Default Pure Colors (B/W) | original | reset chips |
| 089 | Color Sampler Point | compose | crosshair + 1 |
| 090 | Gamut Warning | compose | triangle-alert + drop |

**C10 Layer Operations & Hierarchy** — shipped 7 · Lucide 3 · compose 0 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 091 | Add New Layer | Lucide | Lucide `layers-plus` |
| 092 | Delete Layer | Lucide | Lucide `layers-minus` |
| 093 | Duplicate Layer | shipped | `binhi.icon.duplicate` |
| 094 | Group Layers into Folder | shipped | `binhi.icon.group` |
| 095 | Ungroup Layers | shipped | `binhi.icon.ungroup` |
| 096 | Lock Layer | shipped | `binhi.icon.lock` |
| 097 | Layer Visibility (Show/Hide) | shipped | `binhi.icon.visibility` |
| 098 | Bring to Front | shipped | `binhi.icon.bring-to-front` |
| 099 | Send to Back | shipped | `binhi.icon.send-to-back` |
| 100 | Merge Down / Flatten | Lucide | Lucide `merge` |

**C11 Masks, Clipping & Alpha** — shipped 0 · Lucide 3 · compose 4 · original 3

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 101 | Add Layer Mask | compose | rectangle + dashed circle |
| 102 | Vector Path Mask | compose | rectangle + circle nodes |
| 103 | Create Clipping Mask | Lucide | Lucide `corner-right-down` |
| 104 | Release Clipping Mask | Lucide | Lucide `corner-right-up` |
| 105 | Invert Mask | original | inverted mask |
| 106 | Feather Mask Edge | original | feathered circle |
| 107 | Lock Transparent Pixels | compose | checkerboard + lock |
| 108 | Reveal All Mask | Lucide | Lucide `square` |
| 109 | Hide All Mask | original | solid square |
| 110 | Quick Mask Mode | compose | dashed circle + hatch |

**C12 Transform & Alignment** — shipped 8 · Lucide 0 · compose 0 · original 2

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 111 | Free Transform Box | shipped | `binhi.icon.free-transform` |
| 112 | Rotate 90° Clockwise | shipped | `binhi.icon.rotate` |
| 113 | Flip Horizontally | shipped | `binhi.icon.horizontal-flip` |
| 114 | Flip Vertically | shipped | `binhi.icon.vertical-flip` |
| 115 | Skew / Shear | original | skewed parallelogram |
| 116 | Perspective Distortion | original | receding grid |
| 117 | Align Left Edges | shipped | `binhi.icon.align-left` |
| 118 | Align Horizontal Centers | shipped | `binhi.icon.align-center-horizontally` |
| 119 | Align Right Edges | shipped | `binhi.icon.align-right` |
| 120 | Distribute Spacing Evenly | shipped | `binhi.icon.distribute-horizontally` |

**C13 Typography & Text Styling** — shipped 3 · Lucide 3 · compose 4 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 121 | Horizontal Type Tool | shipped | `binhi.icon.text-tool` |
| 122 | Vertical Type Tool | compose | T + down arrow |
| 123 | Type on Curved Path | compose | T on wave |
| 124 | Font Family Picker | Lucide | Lucide `a-large-small` |
| 125 | Font Weight Selector | shipped | `binhi.icon.bold` |
| 126 | Tracking / Letter Spacing | shipped | `binhi.icon.letter-spacing` |
| 127 | Leading / Line Height | Lucide | Lucide `between-horizontal-start` |
| 128 | Kerning Adjustment | compose | A | T with blade |
| 129 | Text Case (All Caps) | Lucide | Lucide `case-upper` |
| 130 | Convert Text to Outlines | compose | A + anchor nodes |

**C14 Web Layout & Box Model** — shipped 2 · Lucide 2 · compose 6 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 131 | Box Model Diagram | compose | nested rectangles |
| 132 | Margin Inset | compose | margin arrows |
| 133 | Padding Offset | compose | padding arrows |
| 134 | Border Thickness | compose | border frame |
| 135 | Corner Radius | Lucide | Lucide `square-round-corner` |
| 136 | Z-Index / Stacking Order | shipped | `binhi.icon.layers` |
| 137 | CSS Overflow Hidden | compose | box clipping circle |
| 138 | Sticky Positioning | Lucide | Lucide `pin` |
| 139 | Fixed Viewport Pin | compose | anchor in corner |
| 140 | Aspect Ratio Lock | shipped | `binhi.icon.aspect-ratio-lock` |

**C15 Flexbox & Grid Controls** — shipped 0 · Lucide 5 · compose 5 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 141 | Flex Direction Row | compose | row of blocks + arrow |
| 142 | Flex Direction Column | compose | column of blocks + arrow |
| 143 | Justify Content: Flex Start | Lucide | Lucide `align-horizontal-justify-start` |
| 144 | Justify Content: Center | Lucide | Lucide `align-horizontal-justify-center` |
| 145 | Justify Content: Space Between | Lucide | Lucide `align-horizontal-space-between` |
| 146 | Align Items: Stretch | Lucide | Lucide `stretch-vertical` |
| 147 | CSS Grid Template | Lucide | Lucide `grid-3x3` |
| 148 | Grid Column Span | compose | wide cell in grid |
| 149 | Grid Row Span | compose | tall cell in grid |
| 150 | Gap / Gutters | compose | grid + gap callouts |

**C16 Responsive Breakpoints & Screens** — shipped 3 · Lucide 1 · compose 5 · original 1

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 151 | Desktop Screen (>1200px) | shipped | `binhi.icon.desktop-monitor` |
| 152 | Laptop Screen (~1024px) | shipped | `binhi.icon.laptop` |
| 153 | Tablet Portrait (~768px) | compose | tablet portrait |
| 154 | Tablet Landscape (~1024px) | compose | tablet landscape |
| 155 | Mobile Device Portrait (~375px) | shipped | `binhi.icon.smartphone` |
| 156 | Mobile Device Landscape | compose | phone landscape |
| 157 | Ultra-Wide / 4K Display | original | curved ultrawide |
| 158 | Smartwatch / Wearable Screen | Lucide | Lucide `watch` |
| 159 | Container Query Breakpoint | compose | dotted box + caliper |
| 160 | Orientation Flip Toggle | compose | phone + rotate arrow |

**C17 Web Navigation & Menus** — shipped 5 · Lucide 2 · compose 3 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 161 | Hamburger Menu | shipped | `binhi.icon.menu` |
| 162 | Kebab Menu (Vertical Dots) | Lucide | Lucide `ellipsis-vertical` |
| 163 | Meatballs Menu (Horizontal Dots) | shipped | `binhi.icon.more-options` |
| 164 | Dropdown Caret Down | shipped | `binhi.icon.chevron-down` |
| 165 | Mega Menu Structure | compose | navbar + column grid |
| 166 | Breadcrumb Trail | compose | linked steps |
| 167 | Pagination Controls | compose | chevrons + 1 2 3 |
| 168 | Sidebar Drawer | shipped | `binhi.icon.sidebar` |
| 169 | Anchor Link / Jump Target | Lucide | Lucide `anchor` |
| 170 | External Link | shipped | `binhi.icon.external-link` |

**C18 Interactive Web Components** — shipped 4 · Lucide 2 · compose 4 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 171 | Modal Dialog / Lightbox | shipped | `binhi.icon.popup` |
| 172 | Slide-out Drawer | Lucide | Lucide `panel-right-open` |
| 173 | Accordion Collapse/Expand | shipped | `binhi.icon.accordion` |
| 174 | Tab Bar Switcher | shipped | `binhi.icon.tabs` |
| 175 | Tooltip Popover | compose | bubble + info |
| 176 | Carousel / Slider | shipped | `binhi.icon.carousel` |
| 177 | Toast Notification | compose | floating pill |
| 178 | Floating Action Button (FAB) | Lucide | Lucide `circle-plus` |
| 179 | Progress Bar / Meter | compose | progress track |
| 180 | Skeleton Loading State | compose | skeleton blocks |

**C19 Forms & User Inputs** — shipped 4 · Lucide 2 · compose 4 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 181 | Single-Line Text Input | shipped | `binhi.icon.text-input` |
| 182 | Multi-Line Textarea | compose | box + lines + grip |
| 183 | Toggle / Switch | Lucide | Lucide `toggle-right` |
| 184 | Checkbox Checked | shipped | `binhi.icon.checkbox` |
| 185 | Radio Button Selected | shipped | `binhi.icon.radio-button` |
| 186 | Dropdown Select Menu | shipped | `binhi.icon.dropdown` |
| 187 | File Upload / Dropzone | compose | dashed box + arrow |
| 188 | Password Eye (Show/Mask) | Lucide | Lucide `eye-off` |
| 189 | Numeric Stepper | compose | field + plus/minus |
| 190 | Form Validation Error | compose | field + alert |

**C20 Media & Embeds** — shipped 4 · Lucide 4 · compose 2 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 191 | Image Placeholder | shipped | `binhi.icon.image-element` |
| 192 | Video Player | shipped | `binhi.icon.video-element` |
| 193 | Audio / Podcast Track | Lucide | Lucide `audio-lines` |
| 194 | Interactive Map Pin | shipped | `binhi.icon.map` |
| 195 | Iframe Embed | shipped | `binhi.icon.embed` |
| 196 | 3D Model / Canvas Viewer | Lucide | Lucide `rotate-3d` |
| 197 | Lottie / Vector Animation | compose | timeline + diamonds |
| 198 | Social Feed Embed | compose | post card |
| 199 | PDF Viewer Embed | Lucide | Lucide `file-search` |
| 200 | Code Snippet Embed | Lucide | Lucide `terminal` |

**C21 Code, CMS & Data Binding** — shipped 1 · Lucide 8 · compose 1 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 201 | Custom HTML Injection | Lucide | Lucide `code-xml` |
| 202 | Custom CSS Stylesheet | Lucide | Lucide `braces` |
| 203 | Custom JavaScript / Logic | compose | scroll + js |
| 204 | CMS Database Collection | Lucide | Lucide `database` |
| 205 | Dynamic Field Variable | Lucide | Lucide `variable` |
| 206 | REST API Connector | Lucide | Lucide `cable` |
| 207 | Webhook Trigger | Lucide | Lucide `webhook` |
| 208 | JSON Data Tree | Lucide | Lucide `file-json` |
| 209 | User Authentication / Membership | Lucide | Lucide `user-lock` |
| 210 | eCommerce Product Cart | shipped | `binhi.icon.shopping-cart` |

**C22 SEO, Semantics & Analytics** — shipped 3 · Lucide 5 · compose 2 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 211 | Heading Tag Level (H1-H6) | shipped | `binhi.icon.heading` |
| 212 | Meta Description / Snippet | compose | result card |
| 213 | Open Graph / Social Share Card | compose | share nodes + card |
| 214 | XML Sitemap | Lucide | Lucide `network` |
| 215 | Robots.txt / Crawler | Lucide | Lucide `bot` |
| 216 | Canonical Link Tag | Lucide | Lucide `bookmark` |
| 217 | Page Speed / Lighthouse | Lucide | Lucide `gauge` |
| 218 | Analytics Traffic Chart | shipped | `binhi.icon.analytics` |
| 219 | Heatmap Interaction Tracking | Lucide | Lucide `fingerprint-pattern` |
| 220 | Accessibility / WCAG | shipped | `binhi.icon.accessibility` |

**C23 Filters, Effects & Shaders** — shipped 1 · Lucide 0 · compose 2 · original 7

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 221 | Drop Shadow | compose | card + offset shadow |
| 222 | Inner Glow | original | inner glow |
| 223 | Gaussian Blur Filter | original | misty circles |
| 224 | Film Grain / Film Noise | original | grain |
| 225 | Vignette Darkening | shipped | `binhi.icon.vignette` |
| 226 | Halftone Print Effect | original | halftone |
| 227 | Bloom / Light Leak | compose | sun + streak |
| 228 | Tilt-Shift Miniature | original | tilt-shift bars |
| 229 | Glassmorphism / Frosted Glass | original | frosted pane |
| 230 | Glitch / Chromatic Aberration | original | chromatic split |

**C24 Collaboration & Feedback** — shipped 1 · Lucide 4 · compose 5 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 231 | Multi-User Live Cursors | compose | two cursors + tags |
| 232 | Pin Comment | compose | pin + bubble |
| 233 | Unread Mention | Lucide | Lucide `at-sign` |
| 234 | Share / Invite Team | compose | user + plane |
| 235 | User Permission Role | compose | user + shield + key |
| 236 | Design Review / Approval | shipped | `binhi.icon.task` |
| 237 | Version Comparison / Diff | Lucide | Lucide `diff` |
| 238 | Follow User / Screen View | Lucide | Lucide `binoculars` |
| 239 | Lock for Editing | compose | lock + avatar |
| 240 | Voice Chat / Huddle | Lucide | Lucide `headset` |

**C25 System, Settings & Publishing** — shipped 3 · Lucide 5 · compose 2 · original 0

| ICN | Name | Class | Basis |
| --- | --- | --- | --- |
| 241 | Global Workspace Settings | shipped | `binhi.icon.site-settings` |
| 242 | Dark / Light Theme Mode | Lucide | Lucide `sun-moon` |
| 243 | Keyboard Shortcut Reference | Lucide | Lucide `command` |
| 244 | Plugin / Add-on Marketplace | Lucide | Lucide `puzzle` |
| 245 | Custom Domain Connection | compose | globe + chain |
| 246 | SSL Security Certificate | shipped | `binhi.icon.password-lock` |
| 247 | CDN Cache Clear | compose | server + refresh |
| 248 | Site Staging Preview | Lucide | Lucide `flask-conical` |
| 249 | One-Click Publish / Go Live | shipped | `binhi.icon.publish` |
| 250 | Live Production Status | Lucide | Lucide `activity` |
