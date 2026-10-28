# BINHI Template Library

What it is, how it works and what it deliberately does not do. Written against
the code on branch `claude/binhi-template-library`. Statements here describe
behaviour that exists and is tested; planned work is labelled **planned**.

## 1. What a template is

A template is a **real, editable project** waiting to be created, never an
image. Using one creates a new project that the user owns, in the editor that
can open it. The library does not add a second project model: websites are
created through `SiteService` (table `binhi_sites`, with a first
revision), designs through `ProjectService` (table `binhi_projects`).

| Layer | Where | Role |
|---|---|---|
| Taxonomy | `src/core/templates/library/taxonomy.ts` | 30 categories, 300 subcategories, 8 formats, 12 styles |
| Editors | `.../editors.ts` | which editors can open templates today, and why not |
| Manifest | `.../schema.ts` | the versioned, strict record used for discovery and governance |
| Lifecycle | `.../lifecycle.ts` | states, transitions, the single availability rule |
| Validator | `.../validate.ts` | every catalog problem, reported together |
| Search | `.../search.ts` | keyword search, aliases, facets; no AI, no usage data |
| Brand | `.../brand.ts` | applying a Brand Kit to a design (pure, shared by browser and server) |
| Adapters | `.../adapters.ts` | one versioned content contract per editor |
| Catalog | `.../catalog/` | the shipped templates, their content, lock and inventory |
| Service/API | `src/server/templates/` | read-only catalog API and "use template" |
| UI | `src/client/templates/` | Templates page, preview dialog, personal templates |

## 2. Taxonomy

Exactly 30 top-level categories with stable slug ids (`social-media`,
`websites-landing-pages`, … `blank-custom-creations`), each with 10
subcategories whose ids are namespaced (`business-essentials/certificates`,
`education-learning/certificates`) so repeated names never collide. The ids
are frozen by a test: renaming one would silently break saved references.

A template has one **primary** category and optional **secondary** categories.
A wedding invitation can be found under Events, Print and Seasonal while
remaining one record with one id. Categories without public templates stay in
the taxonomy (the UI shows a count of 0); no placeholder records exist to fill
them.

Formats (the first filter users see): Social Media, Websites, Print, Documents,
Presentations, Forms, Video, Custom. A format is only *available* when an
editor that can produce it opens templates (`FORMAT_EDITORS`). "Print" means a
fixed-size graphic made for printing, exported as PNG or JPEG: **there is no PDF
export yet**, so "Documents" (which implies a document editor and PDF) is
unavailable.

## 3. The manifest

`TemplateManifest` (manifest version 1) is strict: unknown keys are rejected, so
an imported or edited record cannot carry behaviour nobody reviewed. It holds
identity (stable id `tpl.<kind>.<slug>`, name, version, creator, provenance),
classification, document compatibility (editor, document kind, schema version,
required features, output formats, size, orientation), dependencies (fonts,
icons, elements, bundled assets, brand tokens, components), discovery data
(keywords, aliases, styles, palette, preview), and governance (visibility,
licence, moderation, deprecation, lifecycle).

Rules enforced by the validator and its tests:

* **A template cannot be public if its editor is unavailable**, or if it needs a
  feature BINHI does not have (`design.icons`, `design.image-slots`,
  `elements300`, `commerce`, …).
* A format must be producible by the template's editor; an editor must be one the
  category allows.
* Every dependency must resolve; none is assumed. Icons and Elements 300 are
  empty until those collections are on `main`.
* Shipped templates are BINHI-authored, public, published and never reference a
  user's private library asset.
* The only price is "free": no entitlement exists, so no premium tier is
  representable. There are no popularity or trending fields.
* `preview.thumbnail` can only be a generated file under `/template-previews/`.

### Lifecycle and versioning

`draft → ready-for-review → approved → published → deprecated / archived`.
A published `(id, version)` is **immutable**: a content fingerprint
(`catalog/lock.ts`, SHA-256 of normalised content) is checked by a unit test,
and `npm run templates:assets:check` runs in CI. Changing a template means a new
version (`version + 1`), a regenerated preview and a new lock entry. Old
versions stay `archived`; only one version of an id may be live. Existing user
projects never change: a project keeps its own copy, and provenance records
which template and version it came from (see §7).

**Deprecation strategy:** set `lifecycle: "deprecated"` with a date, a reason
and optionally `replacedBy`. A deprecated template stops appearing for new
projects (the availability rule), existing projects are untouched, and no
document is ever migrated automatically: that needs separately validated
migration logic.

## 4. Editors and compatibility

| Editor | Available | Opens templates | Contract |
|---|---|---|---|
| Website Builder | yes | **yes** | active (`SiteDocument`) |
| Design Studio | yes | **yes** | active (Design document + brand bindings) |
| Photo Editor | yes | no | contract-only: adjustments on the user's own photo; masks, frames and overlays rejected |
| Form Creator | no | no | contract-only: validated fields, owner-only `store-only` submissions |
| Document / PDF | no | no | contract-only |
| Slides | no | no | contract-only |
| Video | no | no | contract-only |
| Email | no | no | contract-only: layout only, no sending or hosting |

The contract-only schemas in `adapters.ts` are real validators with tests, so a
future editor can adopt them. A test asserts the adapter registry always agrees
with the editor registry, and the catalog validator refuses to publish anything
that needs an unavailable editor, so none can be advertised.

### What a design template can express

Design Studio documents (schema v1) have text, rectangles, ellipses and images;
solid colours; nine named fonts; no gradients, lines, icons or image slots.
Templates are built within that. Consequences, stated plainly:

* **Photo areas are labelled frames.** There are no image slots; the user adds a
  photo on top of the frame.
* **Fonts.** The Design Studio does not load web fonts, so text uses fonts
  installed on the viewer's device and falls back to the system stack
  (published websites do load Google Fonts). Templates avoid `Inter`, which is
  not installed on most devices, keep slack in every text box for wider fallback
  fonts, and the build fails if any text overflows its box (§6).
* No design template uses an icon or an Elements 300 asset.

## 5. Discovery

`GET /api/template-library/taxonomy` and `/templates` run search, format,
category, style and orientation filters **on the server**, return a page of
cards (never documents) plus facet counts, and report unavailable formats with
the reason. Search is a weighted keyword match over name, keywords, aliases,
tags, category and description, with a small alias table ("ig" → instagram,
"cv" → resume, "leaflet" → flyer) and plural/prefix folding. It uses no model
and no user activity. Filters live in the URL, so they survive reload and back.

Favorites and recently used are stored **only in the browser**, keyed by account
id, and removed on sign-out and account deletion. Nothing about browsing is sent
to the server. Server-side favorites would need a database table and are
**planned** (decision D2).

## 6. Previews and generated assets

* **Cards**: JPEG thumbnails under `public/template-previews/`, generated by
  `scripts/templates/build-assets.ts` from the real content: websites through the
  real renderer in Chromium (with web fonts, as published sites show), designs
  through the Design Studio's own `renderDesign`. A stale preview fails a test.
* **Enlarged preview, designs**: drawn in the browser from the template's real
  document by the same renderer that exports it, at full size.
* **Enlarged preview, websites**: the real renderer's HTML in an `<iframe
  sandbox="">` served with `script-src 'none'` and a CSP `sandbox` directive.
* The build **fails** if any design text overflows its box or leaves the canvas
  (measured with the real wrapping code), so shipped templates cannot ship broken
  layouts.

## 7. Creating a project from a template

`POST /api/template-library/templates/:id/use` (and `/mine/:projectId/use` for
personal templates):

1. loads the template (404 if unknown, unpublished, invalid or unusable);
2. optionally loads a Brand Kit (404 unless it belongs to the caller);
3. creates a **new project** via `SiteService`/`ProjectService` with a deep copy,
   so the shared template is never referenced or modified;
4. writes an audit record `template.used` with template id, version and kind
   (and the kit id). This is the provenance record until a project column exists
   (decision D2).

Rate limit: 30 template uses per account per 10 minutes.

## 8. Brand Kits

A design template declares which layers follow a kit (`brand` bindings) and
where a logo goes (`logoSlot`). `applyBrandKitToDesign` is pure and shared, so
the browser previews exactly what the server will create:

* only bound layers change; unbound layers and properties are untouched;
* the shared template is never mutated;
* the kit logo is added only where a slot exists and the kit has a logo;
* a recolour that would drop text below 3:1 contrast (and by more than 10 %)
  switches that text to black or white and says so.

Websites take the kit as a theme patch applied as **revision 1**, so revision 0
(the template) stays in history and can be restored. Designs have no revision
history (only an optimistic revision counter), so for designs "undo" means
creating the project again without the kit.

## 9. Personal templates

A personal template is a private project of kind `design-template`. Users can
save one from the Design Studio, see a thumbnail drawn from its document, use it,
rename it, duplicate it and delete it; the owner check is server-side for every
action. **Not available yet** (needs a database column, decision D2): a
description, category, tags, an archive state, brand bindings on personal
templates, and public sharing.

## 10. Security and privacy

* Every API route requires a signed-in user; ownership is enforced server-side.
* Records are strict and size-limited; thumbnails can only be generated files
  under one path.
* Shipped design text is plain text (tests reject markup, scripts and links);
  shipped website content renders with no script and no inline handlers, and
  links only to expected `https` hosts.
* Website previews are sandboxed and script-free; a kit preview is applied in
  memory only and needs a kit the caller owns.
* A template can never reference another account's assets: shipped designs hold
  no library image, and a kit logo is the caller's own, checked at project save.
* There is no template import or community submission yet. When there is, it must
  be treated as untrusted content and go through the same strict contracts
  (`creator.kind = "community"` cannot be published today).
* Browsing, favorites and recents are not sent to the server.

## 11. Performance

* List responses contain cards only (no documents); pagination is server-side
  (24 per page, max 48).
* Thumbnails are lazy-loaded JPEGs with fixed aspect ratios; personal thumbnails
  are drawn only when scrolled into view.
* The page is a lazy route chunk; the catalog is validated once at start-up.
* Measurements are in `docs/TEMPLATE_LIBRARY_RELEASE.md`.

## 12. Boundaries with ORIGIN

BINHI owns template content, editing, asset reuse, rendering and creative
exports. Identity, organisations, shared ownership, billing and permissions
remain ORIGIN's; recommendations, brief-to-template discovery and layout
assistance are TALA's and would arrive through versioned contracts; workflow
automation is AGOS's; deployment is LIYAB's. This feature adds **no** connection
to ORIGIN's database, **no** authentication and **no** workflow system.

## 13. Working on the catalog

```bash
npm run templates:assets         # regenerate thumbnails + lock after editing content
npm run templates:assets:check   # CI: content, lock and previews agree
npm run test:e2e:templates       # full journey for every template; rewrites docs/TEMPLATE_INVENTORY.json
npm run test:e2e:templates -- --quick   # discovery + accessibility only (never writes the inventory)
```

Adding a template: write a spec in `catalog/designs/*.ts` (or a site builder),
run `templates:assets`, review the generated preview, run the journey. The
inventory file is written **only** by a passing journey and is bound to the
content fingerprint, so a template cannot be counted until its whole user
journey has passed. `approved` is the founder's release approval and is never
written by tooling.
