# Testing BINHI

| Layer | Command | Needs | Covers |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | — | client (`tsconfig.json`) and server/core (`tsconfig.server.json`) |
| Unit | `npm run test:unit` | — | document schema invariants, every template, registry defaults, all operation groups (insert/validate/lock/free layout/group/align/distribute/layers/duplicate/paste/delete/move/pages/theme/reusable/atomic batches/replaceDocument), renderer (escaping, link and media sanitisation, responsive CSS, freeform placement, editor vs publish mode, forms, embeds sandboxing, animations runtime, rich text, columns stacking), and destructive-test database safety |
| Integration | `npm test` | Disposable Postgres (`BINHI_TEST_DATABASE_URL`; defaults to local `binhi_test`) | auth (signup/login/logout/duplicate/short password/wrong credentials/CSRF guard/rate limit/account deletion), sites (templates, create, ops batches, revision bump, stale 409 with server doc, idempotent replay, 422/400, atomic batch, restore, preview, cross-account 404s, slug validation, delete), media (upload real PNG, reject SVG/mislabelled/oversized, filename sanitising, ownership, alt update, delete), publishing (publish → live + public fetch + CSP + redirects + 404, supersede/unpublish/rollback, validation gate with duplicate anchors, honest failure when verification fails, live-slug lock, stranger 404s, form submissions with validation/honeypot/owner access, delete takes site offline) |
| Creative unit | `npm run test:unit` | — | design/brand-kit/photo-project document validation (`tests/unit/creative.test.ts`), raster header inspection and recipe bounds (`photo.test.ts`), API client CSRF transport, host config and migration guards |
| Creative integration | `npm test` | Disposable Postgres | private library (owner-only bytes, 401/404 for others, SVG/GIF/animated/decompression-bomb/oversize rejection, copy-to-site), projects (create/list/update with 409 on stale revision, kind-mismatch and foreign-asset rejection, usage tracking and delete protection, photo project validation, template round-trip), brand kits (CRUD, logo ownership, unsafe colours), account deletion cleanup (`tests/integration/creative.test.ts`) |
| Studio e2e | `npm run test:e2e:studio` | Disposable Postgres, built client, Chromium | dashboard with ten honestly labelled destinations → planned tools stay planned → photo editor rejects unsafe input → edits/undo/redo with no upload → save to projects (private original uploaded once) → reload and reopen from the server → verified PNG/JPEG/WebP exports → explicit copy to website media → pixel checks → compressor → library usage/metadata/copy-to-site → design editor (text, shape, library image, autosave, drag, undo) → verified 1080×1080 PNG/JPEG export → save as template → use template → brand kit with logo applied to a website theme (new revision) and to a design layer → My Projects merge and delete → account isolation → cleanup |
| Template library e2e | `npm run test:e2e:templates` | Disposable Postgres, built client, Chromium, axe-core | discovery (search, nine format filters, honest unavailable formats, URL-persisted filters, local favorites, keyboard, phone width) → axe-core on the page and both preview dialogs (serious/critical fail) → Brand Kit preview with real pixels and apply → website kit as revision 1 and restore → personal templates (save, thumbnail, rename, duplicate, delete, use) → **the full journey for every catalog template, each on its own account**: thumbnail, enlarged preview from the real content, create, correct editor, edit, autosave, undo/redo, reload, export a native-size PNG or publish and read the live site, original unchanged, other account sees nothing. Writes `docs/TEMPLATE_INVENTORY.json`. `-- --quick` skips the per-template part and writes nothing. |
| Browser e2e | `npm run test:e2e` | Disposable Postgres, built client, Chromium (Playwright) | keyboard-only signup → template via Tab/Shift+Tab and radio keys → insert/edit using keyboard → confirm Ctrl+A stays in a text input → undo shortcut → history modal focus wrapping, keyboard restore and focus return → keyboard publish; then mouse-driven editor journey including two isolated sessions editing the same site, visible stale-save conflict and safe load-latest recovery → anonymous live visit (desktop + mobile, no horizontal overflow, second page) → unpublish 410 → verify temporary account cleanup |

CI (`.github/workflows/ci.yml`) runs all of these with a dedicated Postgres 16
service. Configure `BINHI_TEST_DATABASE_URL` to a disposable database only;
both integration tests and the local browser journey truncate their target,
and the test helpers reject the configured app/workspace database. Browser
screenshots and Playwright output are ignored by Git.

## What is not automated yet

- Pixel comparisons of canvas vs published output (parity is structural: the
  same renderer; the e2e checks content and overflow, not pixels).
- Full keyboard-only traversal of every editor panel and control (the e2e now
  covers signup, site creation, core editing, history/shortcuts dialogs, and
  publishing; a full axe pass and exhaustive panel traversal remain release
  checks).
- Disk storage adapter against a real volume (unit-level only).
