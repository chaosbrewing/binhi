# Creative studio — milestone 1 release evidence

## Delivery status

Implemented in the existing BINHI source tree, not a replacement app.
**Workspace-only; not published to production.** No database schema,
production data, deployment settings, secrets or external products changed.

Architecture, read-only inventory, UX, seven working phases, release gates,
data boundaries, security/cost notes and later milestone plans:
[CREATIVE_STUDIO.md](CREATIVE_STUDIO.md).
The organisational names of the seven phases still need owner confirmation.

### Working now

- Signed-in Studio home exposes all six requested modules.
- Website Builder listing at `/websites`; original site create/edit/auth,
  server autosave/revisions, publishing, public URLs and submissions remain.
- Photo Editor and Image Compressor: PNG/JPEG/static WebP signature and
  dimension validation, local preview, original-coordinate crop, bounded
  resize, 0/90/180/270 rotation, horizontal/vertical flip,
  brightness/contrast/saturation, original comparison, reset, 30-step
  in-tab undo/redo and immutable original.
- Named local drafts persist original + typed recipe + schema/revision
  in IndexedDB, scoped to authenticated account. Drafts can reopen/delete;
  stale saves are rejected using the existing local revision.
- PNG/JPEG/WebP encode and download with actual bytes, MIME/dimension
  verification and honest size comparison, including when output is larger.
  JPEG flattens transparency to white; PNG preserves alpha.
- Explicit confirmed upload of an exported copy to an owned website reuses
  its existing public media service and server permission checks.
- Account deletion through the Account screen clears that account's local
  drafts in the current browser; storage errors tell the user to clear site
  data. Other devices require their own browser-data cleanup.
- Fixed a pre-existing shared client upload transport bug: custom metadata
  headers no longer replace the required CSRF header.
- New browser journey is included in CI after the existing website journey.

### Planned, not available

Design/template artboards (posts, flyers, business cards, presentations),
standalone forms with private submissions, and general PDF/Office conversion
are clearly marked coming soon with navigable roadmap screens. Raster
format exports already work through Photo Editor. There is no claim that
arbitrary formats can be converted.

Cloud-synced creative projects, private server-side original storage,
durable photo revision history, collaboration, animation, SVG/HEIC/AVIF,
AI assistance, background exports and paid providers are not implemented.
Local draft revision numbers are not a browsable cloud revision archive;
undo history lasts only while the editor is open.

## Actual verification

Local validation completed 2026-10-24 in this workspace:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Client and server passed |
| `npm test` | **97 passed, 14 files**, including all 28 existing DB integration tests |
| `npm run build` | Client and server passed |
| `npm run test:e2e` | **13/13** existing website journey steps passed |
| `npm run test:e2e:studio` | **13/13** studio checks passed |
| Browser coverage | Chromium desktop and 390px mobile; no horizontal overflow |
| Production changes | None; production metadata/identity SELECTs only |

Studio browser evidence covers module navigation and coming-soon states,
unsafe/oversize rejection, crop/resize/rotate/flip/adjustment controls,
undo/redo, save/reload/reopen of full recipes, PNG/JPEG/WebP output byte
inspection, an actual downloaded file's byte count, zero implicit media
uploads, explicit existing-site asset upload, reset, direct rendered pixel
assertions for both flips/rotation/brightness/PNG alpha/JPEG white fill,
real compression, all three input formats, responsive layout and another
signed-in account's inability to list drafts/access the first account's assets.

Measured fixture examples:
- Original static PNG: **382,754 bytes**.
- JPEG compressed at original 640 × 480: **79,059 bytes** (about 79.3% smaller).
- Cropped/transformed output 150 × 100: PNG **12,742**, JPEG **1,030**,
  WebP **662 bytes**. These are fixture results, not universal guarantees.

Ignored local evidence: `e2e/screenshots/studio/evidence.json`, home/photo
screenshots, and a verified PNG download. These generated files are not
source-controlled or necessary to deploy. `.replitignore` also excludes
browser caches and test output from future published bundles.

### Database separation

- Development: managed `heliumdb`, OID **16384**, 11 public BINHI tables.
- Production: managed `neondb`, OID **16395**, 11 public BINHI tables.
- Test: separate disposable local `binhi_test` on **127.0.0.1:55432**.
  The test guard rejects app DB identities and production runtime targets.
- Browser journeys ran against separate local test servers, not
  `binhi.replit.app`. Destructive suites must run **sequentially** when
  they share the disposable database; the existing website runner truncates it.

## Security, privacy and cost boundaries

Inputs: 8 MiB, 16 MP, 8192px edge; outputs: 4096px edge / 16 MP.
Only one decoded original and bounded preview/output canvases are active;
image handles and object URLs are disposed. Animated PNG/WebP and unsupported
types are rejected. No arbitrary remote file URLs or executable uploads.
Re-encoding does not copy original EXIF/GPS metadata to the export.

Originals/drafts remain local, are not encrypted vaults, are not cloud backups
and are subject to browser eviction and profile access. Maximum local drafts:
12 / 64 MiB per account. There is no implicit source upload. The explicit
website destination is **public media**, never private storage.

No new runtime dependency, paid API, storage provider or cloud render worker.
Local work consumes user CPU/RAM/browser quota; optional website uploads use
existing Replit PostgreSQL storage and bandwidth. No invented price estimates.

## Remaining release gates / blockers

- Owner approval is still required to publish. The live production app
  remains the previously published release; do not describe the new studio
  as live until approved and published.
- Confirm the canonical seven-phase workflow labels when available.
- Firefox/Safari have not been browser-tested; unsupported canvas encoding
  or adjustment features fail explicitly. No promise of universal support.
- Existing Fastify deprecation and a Vite >500kB chunk advisory remain
  non-blocking; the build passes. Route-level lazy loading is a future
  performance improvement, not a reason to replace the stack.
- Private cloud draft sync and new document schemas need their own additive
  development migration, permission tests and owner-reviewed publish diff.

Rollback for this milestone is an application-code rollback only, since
no schema changed. Reverting studio code does not rewrite website documents.
Browser-local drafts remain browser data until cleared; exports remain
ordinary user downloads.
