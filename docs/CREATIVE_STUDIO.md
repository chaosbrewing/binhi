# BINHI creative studio — architecture and release gates

## Scope and seven-phase workflow

The request expands the existing BINHI app, not ORIGIN/TALA and not a
replacement app. No canonical Chaos Origins seven-phase specification was
found in this repository. The following is an explicit working mapping,
pending owner confirmation of the official names; it is not claimed as
an independently verified organisational standard.

1. **Discover / inventory:** inspect existing product, data, UX, security,
   deployment and regression contracts read-only before implementation.
2. **Define:** identify the audience, vertical slice, exclusions and outcomes.
3. **Architect:** bound document types, identity, storage, export and integration.
4. **Design:** plan accessible journeys, tool navigation and honest capability states.
5. **Build:** implement small additive modules, preserving website contracts.
6. **Verify:** regressions, real browser journeys, resource and privacy gates.
7. **Release / learn:** document evidence, limitations, costs and rollback;
   production schema changes and publishing remain approval-gated.

## 1. Read-only inventory

- Existing root standalone React 18/TypeScript/Vite app, Fastify API,
  PostgreSQL/Drizzle, Node 22, Replit hosting. Do not migrate the stack.
- Session-cookie identity, password hashing, custom-header CSRF checks,
  owner checks, rate limits, account lifecycle already exist.
- Website document/operation registry, debounce autosave, revisions,
  undo/redo, canvas iframe, templates and responsive rendering already exist.
- Site-scoped assets use validated raster uploads and an ObjectStorage
  interface; default PostgreSQL blobs. Their media URLs are **public**.
  Never silently upload private photo originals to that public asset service.
- Publishing already uses deploy → verify → activate, published snapshots,
  path-based `/s/<slug>/`, unpublish, rollback and submissions.
- Existing website forms are NOT a standalone Jotform-like form product.
- Production startup skips DDL; Replit Publish owns managed production schema.
- Audit-time read-only identities: dev `heliumdb` / OID 16384, production
  `neondb` / OID 16395; 11 public BINHI tables each. Public Autoscale app:
  `https://binhi.replit.app`. This work must not publish or write production.
- Existing tests require a clearly disposable test database and reject the
  workspace database; local browser journey truncates its test DB only.
- Main risks: regression to site routing/autosave, accidental public uploads,
  malicious/large image decodes, misleading conversion promises, new data
  being forced into site documents, cross-account browser-local drafts.

## 2. Milestone 1 definition

One studio home with Website Builder, Design & Templates, Photo Editor,
Image Compressor, File Converter and Form Builder. Existing website listing,
creation and editor stay available. Design/form/general conversion have
navigable, explicit coming-soon screens, not fake controls or output.

Photo Editor and Image Compressor share the same raster engine and local
photo document, not the website canvas. PNG/JPEG/static WebP input; crop,
resize, quarter-turn rotation, flip, brightness/contrast/saturation, preview,
original comparison, reset/undo/redo, private local drafts and real
PNG/JPEG/WebP exports. Show actual MIME, dimensions, bytes and savings;
negative savings are honestly reported. JPEG flattens transparency to white.
Explicitly saving an export to an owned site's media library reuses the
existing authenticated asset API and warns that the result becomes public.

Cloud photo sync, collaboration, AI, arbitrary uploads/executables,
animation, SVG, HEIC/AVIF, PDF/Office processing and paid external services
are excluded. Browser-local drafts are device/browser-specific, not backups.

## 3. Product and technical boundaries

| Entity / document | Authority now | Boundary / future extension |
| --- | --- | --- |
| Website site | Existing server tables, SiteDocument, operations/revisions | Unchanged SiteService + PublishingAdapter |
| Photo project | Owner-keyed browser IndexedDB; immutable source Blob + typed recipe, schema version and revision | LocalPhotoRepository; future authenticated ProjectRepository adapter |
| Graphic design | Planned separate typed DesignDocument (pages/artboards/layers) | Not SiteDocument or PhotoRecipe; future export renderer |
| Media asset | Local original or existing site-scoped server asset | Explicit AssetDestination upload; retain ObjectStorage adapter |
| Converted file/job | Planned source/output MIME pair, byte counts, expiry, status, owner | ConversionService allowlist; never implicit code execution |
| Standalone form | Planned versioned FormDocument/field schema and publication | FormService; separate publication namespace |
| Form submission | Existing site submissions unchanged; standalone submissions planned separately | Server-side validation, owner access, retention, audit |

Milestone 1 introduces no database schema changes. Local ownership is keyed
by authenticated user ID; one account's draft list never queries another's.
Local drafts are accessible to someone with browser profile access and are
not encrypted vault storage. Logout must clear active image state through
route unmount; no automatic remote upload. Source remains immutable;
recipe edits and draft revisions are separate from website revisions.

Rendering/export is behind a RasterEngine; draft persistence behind a
PhotoRepository; delivery through download or the existing owned-site API.
Use BINHI's existing theme variables, buttons, auth context and account
controls. Do not share document reducers between fundamentally different
media. Future cloud adapters must enforce server-side tenant membership,
optimistic concurrency, quotas and private original delivery.

### Integration seams

Preserve existing ORIGIN identity/membership and LIYAB publishing contracts.
TALA may propose typed, validated operations, never bypass permissions.
AGOS can receive versioned minimal-ID events through an outbox/event adapter.
LIPAD can consume approved export descriptors through a future delivery
adapter; no LIPAD API or identity contract is asserted to exist.
No changes to any external product, connector or credentials in this milestone.

## 4. UX journeys and states

- Signed-in `/` is Studio home. `/websites` retains the existing website
  dashboard; existing `/sites/new` and `/sites/:id/edit` remain unchanged.
- `/studio/photo` opens the photo editor; `/studio/compress` opens the same
  engine with compression-oriented copy/settings.
- `/studio/design`, `/studio/convert`, `/studio/forms` clearly distinguish
  planned capabilities from usable tools and link back to working tools.
- Photo journey: select local image → validation → editable live preview →
  reversible edits → save browser draft → reopen → export → verify exact output
  → download, or explicitly choose owned website and upload exported copy.
- Show original/output dimensions, original/output bytes, current draft
  status, error status, export MIME/quality, no false “compressed” badges.
- All numeric fields have labels/ranges; file validation errors use alerts;
  preview states use status text; keyboard buttons and visible focus remain.
- Crop coordinates refer to the original, orientation-normalised raster.
  Rotation/flip apply after crop; output size is independent and explicit.
- Reload recovery comes from a confirmed browser draft, not an implied cloud save.

## 5. Security, limits, costs

- Input maximum 8 MiB, 16 million pixels, 8192px per dimension, one active
  image. Validate magic bytes and header dimensions before browser decode,
  check decoded dimensions again, and reject animated PNG/WebP.
- Output maximum 4096px per dimension / 16 million pixels. Bounded working
  surfaces; latest preview wins, close ImageBitmaps/revoke object URLs.
- Re-encoding strips source EXIF/GPS metadata. No external photo URLs,
  arbitrary URL fetching, scripts, SVG, Office macros or executable uploads.
- Explicit server upload keeps existing 8 MiB and server-sniffing gates,
  identity, owner checks, CSRF, rate limits and audit. Warn about public URLs.
- PNG is lossless; quality sliders only affect JPEG/WebP. Encoding may
  increase size. The browser must support the requested MIME; fail rather
  than silently rename a PNG as WebP. Reinspect real output bytes/dimensions.
- No new paid API costs. Local decode/export uses user CPU/RAM and browser
  quota; website-media uploads consume existing Replit DB storage/bandwidth.
  Future cloud rendering/conversion requires quotas and separately approved
  compute, storage, retention and provider costs; do not invent prices.
- Avoid logs containing source bytes, passwords, session cookies or EXIF.

## 6. Release gates

1. Existing client/server typecheck, unit and database integration tests pass.
2. Existing website Chromium journey passes against a disposable test DB.
3. New studio browser journey validates navigation/coming-soon states,
   invalid/oversize input, edit/preview, reset/history, local save/reopen,
   reload persistence, output MIME/dimensions/bytes, compression and account
   isolation; check explicit asset destination/ownership where feasible.
4. Exercise portrait/landscape, mobile layout, transparency, malformed headers
   and animation rejection. No implicit uploads during local editing.
5. Development/test/production identities remain separated. No migrations
   against production, no remote destructive tests or live publication.
6. Record actual evidence and limitations; unverified gates are blockers,
   not claims of success. Only owner-approved publishing releases changes.

## 7. Next milestones and approval gates

**Design & templates:** separate artboard/layer document with text, shapes,
owned raster assets, constraints, font licensing and export contracts.
Start posts/flyers/business cards, then multi-page presentations; explicit
print dimensions, bleed and PDF font embedding need dedicated validation.
Template licensing, private/team access and versioning precede a marketplace.

**Safe conversion:** publish a tested pair matrix, not “convert anything”.
Milestone 1 image exports support PNG/JPEG/WebP only. Future image→PDF and
PDF→image need bounded page counts, sandboxed parsers and private expiry.
PDF text extraction is not editable DOCX; DOCX→PDF needs a licensed/isolated
renderer and fidelity tests. Reject macros, encrypted/malformed files,
archives, scripts and unsupported pairs. Never execute uploaded content.

**Forms:** begin text/textarea/email/number/select/radio/checkbox/date/consent,
then standalone publication and secure submission ingestion; conditional
logic later through a typed expression model, never arbitrary JS.
Server validates against the published schema, limits bodies/field counts,
enforces honeypot/rate limiting, private owner access and retention/deletion.
Consent, spam review, audit, export escaping and download authorisation gate
production. File-upload fields/payments/health-sensitive use need separate
threat modelling and policies. Existing website forms continue unchanged.

**Cloud projects:** approve additive development schema for generic project
metadata + separate per-document payloads, revisions, private assets and
export jobs; no destructive site-table changes. Prove older builds tolerate
new schema, then review Replit's schema diff and request owner publish.

## 8. Phase 1 implementation notes (2026-10-24)

What changed relative to the milestone 1 plan above:

- **Persistence moved from the browser to the account.** Browser-local
  IndexedDB drafts were replaced by server-side projects
  (`binhi_projects`) with per-kind validated documents, so photos and designs
  reopen on any device and appear in My Projects. The photo original is
  uploaded exactly once, privately, into the asset library when the owner
  saves; editing and exporting still upload nothing.
- **Private asset library** (`binhi_library_assets`): PNG/JPEG/static WebP
  only, header dimensions bounded before any decode, animated files refused,
  originals preserved byte-for-byte, bytes served only to the owner, usage
  tracked per project and deletion protected while a file is in use. Copying
  into a website's public media is explicit and goes through the existing
  media checks.
- **Design Studio**: `DesignDocument` (artboard + text/shape/image layers)
  with whole-document validated saves, optimistic concurrency, undo/redo,
  pointer drag/resize, keyboard nudging and verified PNG/JPEG export rendered
  in the browser. Fonts are the website font allowlist; canvas text uses the
  fonts the browser has loaded, which the UI states.
- **Templates and brand kits**: a design can be saved as an editable template
  (`design-template` kind) and templates start new designs; brand kits hold
  colours, fonts, logo and tagline, apply to design layers as swatches and
  push a website theme through the existing `updateTheme` operation as a new
  revision (never silently).
- **Still planned, still labelled planned:** File Converter and Form Builder.
- **No new paid services.** Processing stays in the browser; storage uses the
  existing Postgres blob adapter.

## 9. Icon library (added after Phase 1)

The Design Studio gained an `icon` layer, an **Icon** toolbar action, copy/paste of layers and **Export SVG**; see
[`ICON_LIBRARY.md`](ICON_LIBRARY.md). Two pre-existing defects were found and fixed on the way: *Duplicate* failed for
every layer type (`makeLayer` was handed `id: undefined`), and website elements edited before their first autosave
were rejected by the server (the inserted element's id was not sent). Both have regression tests.
