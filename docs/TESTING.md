# Testing BINHI

| Layer | Command | Needs | Covers |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | — | client (`tsconfig.json`) and server/core (`tsconfig.server.json`) |
| Unit | `npm run test:unit` | — | document schema invariants, every template, registry defaults, all operation groups (insert/validate/lock/free layout/group/align/distribute/layers/duplicate/paste/delete/move/pages/theme/reusable/atomic batches/replaceDocument), renderer (escaping, link and media sanitisation, responsive CSS, freeform placement, editor vs publish mode, forms, embeds sandboxing, animations runtime, rich text, columns stacking), and destructive-test database safety |
| Integration | `npm test` | Disposable Postgres (`BINHI_TEST_DATABASE_URL`; defaults to local `binhi_test`) | auth (signup/login/logout/duplicate/short password/wrong credentials/CSRF guard/rate limit/account deletion), sites (templates, create, ops batches, revision bump, stale 409 with server doc, idempotent replay, 422/400, atomic batch, restore, preview, cross-account 404s, slug validation, delete), media (upload real PNG, reject SVG/mislabelled/oversized, filename sanitising, ownership, alt update, delete), publishing (publish → live + public fetch + CSP + redirects + 404, supersede/unpublish/rollback, validation gate with duplicate anchors, honest failure when verification fails, live-slug lock, stranger 404s, form submissions with validation/honeypot/owner access, delete takes site offline) |
| Creative unit | `npm run test:unit` | — | design/brand-kit/photo-project document validation (`tests/unit/creative.test.ts`), raster header inspection and recipe bounds (`photo.test.ts`), API client CSRF transport, host config and migration guards |
| Creative integration | `npm test` | Disposable Postgres | private library (owner-only bytes, 401/404 for others, SVG/GIF/animated/decompression-bomb/oversize rejection, copy-to-site), projects (create/list/update with 409 on stale revision, kind-mismatch and foreign-asset rejection, usage tracking and delete protection, photo project validation, template round-trip), brand kits (CRUD, logo ownership, unsafe colours), account deletion cleanup (`tests/integration/creative.test.ts`) |
| Studio e2e | `npm run test:e2e:studio` | Disposable Postgres, built client, Chromium | dashboard with ten honestly labelled destinations → planned tools stay planned → photo editor rejects unsafe input → edits/undo/redo with no upload → save to projects (private original uploaded once) → reload and reopen from the server → verified PNG/JPEG/WebP exports → explicit copy to website media → pixel checks → compressor → library usage/metadata/copy-to-site → design editor (text, shape, library image, autosave, drag, undo) → verified 1080×1080 PNG/JPEG export → save as template → use template → brand kit with logo applied to a website theme (new revision) and to a design layer → My Projects merge and delete → account isolation → cleanup |
| Browser e2e | `npm run test:e2e` | Disposable Postgres, built client, Chromium (Playwright) | keyboard-only signup → template via Tab/Shift+Tab and radio keys → insert/edit using keyboard → confirm Ctrl+A stays in a text input → undo shortcut → history modal focus wrapping, keyboard restore and focus return → keyboard publish; then mouse-driven editor journey including two isolated sessions editing the same site, visible stale-save conflict and safe load-latest recovery → anonymous live visit (desktop + mobile, no horizontal overflow, second page) → unpublish 410 → verify temporary account cleanup |

| Icon unit | `npm run test:unit` | — | registry integrity (250 / 25×10 / numbering / duplicate-id rejection), geometry allowlist and security cases, no duplicate glyphs, well-formed SVG for every icon × variant, renderer options and escaping, search ranking (names, synonyms, intents, filters, hostile input), website icon component (legacy rendering unchanged, validation, a11y, publish-only-used-icons, round trip, templates), design icon layer and SVG export (`tests/unit/icons*.test.ts`) |
| Icon integration | `npm test` | Disposable Postgres | icon ops through the validated API, preview and publish with only the used icon embedded, ownership 404s, design projects with icon layers (store, reload, template round trip, rejection of unknown/unsafe values) (`tests/integration/icons.test.ts`) |
| Icon e2e | `npm run test:e2e:icons` | Disposable Postgres, built client, Chromium | lazy category loading, keyboard navigation, intent search, favourites/recents, website insert → customise → autosave → reopen → undo/redo → legacy icon → preview → publish → anonymous visit (size/colour/overflow), design insert → customise → duplicate/copy/paste/lock/hide/undo → reopen → pixel-verified PNG and JPEG → SVG export → template copy → phone/tablet dialog → isolation |

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
