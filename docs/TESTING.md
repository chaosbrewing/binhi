# Testing BINHI

| Layer | Command | Needs | Covers |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck --workspace apps/binhi` | — | client (`tsconfig.json`) and server/core (`tsconfig.server.json`) |
| Unit | `npx vitest run tests/unit` (in `apps/binhi`) | — | document schema invariants, every template, registry defaults, all operation groups (insert/validate/lock/free layout/group/align/distribute/layers/duplicate/paste/delete/move/pages/theme/reusable/atomic batches/replaceDocument), renderer (escaping, link and media sanitisation, responsive CSS, freeform placement, editor vs publish mode, forms, embeds sandboxing, animations runtime, rich text, columns stacking) |
| Integration | `npm test --workspace apps/binhi` | Postgres (`BINHI_TEST_DATABASE_URL`, default `binhi_test` on localhost) | auth (signup/login/logout/duplicate/short password/wrong credentials/CSRF guard/rate limit/account deletion), sites (templates, create, ops batches, revision bump, stale 409 with server doc, idempotent replay, 422/400, atomic batch, restore, preview, cross-account 404s, slug validation, delete), media (upload real PNG, reject SVG/mislabelled/oversized, filename sanitising, ownership, alt update, delete), publishing (publish → live + public fetch + CSP + redirects + 404, supersede/unpublish/rollback, validation gate with duplicate anchors, honest failure when verification fails, live-slug lock, stranger 404s, form submissions with validation/honeypot/owner access, delete takes site offline) |
| Browser e2e | `npm run test:e2e --workspace apps/binhi` | Postgres, built client, Chromium (Playwright) | sign up → template → canvas render → select + edit via properties → inline text edit → insert element → autosave persisted → undo → mobile breakpoint → publish → anonymous live visit (desktop + mobile, no horizontal overflow, second page) → unpublish 410 |

CI (`.github/workflows/binhi-ci.yml`) runs all of these with a Postgres 16
service and uploads e2e screenshots.

## What is not automated yet

- Pixel comparisons of canvas vs published output (parity is structural: the
  same renderer; the e2e checks content and overflow, not pixels).
- Keyboard-only traversal of the whole editor (modal focus traps and
  shortcuts are implemented; a full axe pass is a release task).
- Concurrency under two simultaneous editors (the 409 path is tested; a live
  two-browser test is not).
- Disk storage adapter against a real volume (unit-level only).
