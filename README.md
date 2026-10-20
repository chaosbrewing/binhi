# BINHI — visual website editor

**BINHI** (Filipino for *seed*) is CHAOS ORIGINS' standalone website builder:
create pages, design them on a visual canvas, preview them on desktop,
tablet and mobile, keep a revision history, and publish to a real URL.

It is built to run on its own today and to become the website sector of
ORIGIN tomorrow, integrating through contracts rather than shared tables
(see [`docs/ORIGIN_INTEGRATION.md`](docs/ORIGIN_INTEGRATION.md)).

> Status: **v0.1 — functional standalone editor.** Standalone accounts,
> real persistence, canvas editing with structured and freeform layouts,
> media library, templates, revisions, and verified path-based publishing
> under `/s/<site>/`. Custom domains, TALA assistance and ORIGIN identity
> are deliberately not part of v0.1.

## What it does

- **Accounts** — email + password, HttpOnly session cookies, account deletion.
- **Websites** — up to 50 per account; each has pages, a theme, media and history.
- **Editor** — Canva-like canvas (select, drag, resize, rotate, align, snap,
  group, lock, hide, layers, copy/paste, undo/redo, inline text editing) with
  Wix-like structure (sections, containers, columns, pages, menu, header and
  footer, responsive overrides, SEO settings).
- **Canonical document** — every edit is a validated operation against a
  versioned JSON document; HTML/CSS is always derived from it.
- **Publishing** — snapshot → render → deploy → verify → live. Unpublish,
  rollback, form submissions, and honest failure states.

## Run it locally

Requirements: Node 22, PostgreSQL 14+.

```bash
# from the repository root
npm install
createdb binhi_dev            # or any Postgres you control
cp apps/binhi/.env.example apps/binhi/.env   # set BINHI_DATABASE_URL + BINHI_SESSION_SECRET

npm run dev --workspace apps/binhi            # API + published sites on :4100 (runs migrations first)
npm run dev:client --workspace apps/binhi     # editor UI on :4173 (proxies /api, /s, /media to :4100)
```

Open http://localhost:4173, create an account, start a website.

Production: `npm run build --workspace apps/binhi` then
`NODE_ENV=production npm start --workspace apps/binhi` serves the editor,
the API, media and published sites from one process on `BINHI_PORT`.
See [`docs/RELEASE.md`](docs/RELEASE.md) for Replit.

## Tests

```bash
npm run typecheck --workspace apps/binhi   # client + server
npm test --workspace apps/binhi            # unit (no DB) + integration (needs BINHI_TEST_DATABASE_URL or binhi_test on localhost)
npm run build --workspace apps/binhi
npm run test:e2e --workspace apps/binhi    # real Chromium: sign up → edit → publish → visit live site
BINHI_E2E_BASE=https://<deployed-host> npm run test:e2e:remote --workspace apps/binhi   # same journey against a deployment
node apps/binhi/scripts/smoke.mjs https://<deployed-host>                              # browser-less smoke test
```

CI runs all four on every change under `apps/binhi/`
(`.github/workflows/binhi-ci.yml`).

## Layout

```
apps/binhi/
  src/core/        canonical model, registry, operations, renderer, templates, validation (isomorphic)
  src/server/      Fastify API: auth, sites, revisions, media, publishing, public site serving
  src/client/      React editor: dashboard, canvas, panels, properties, dialogs
  migrations/      Drizzle SQL migrations (tables prefixed binhi_)
  tests/           vitest unit + Postgres integration tests
  e2e/             Playwright journey
  docs/            product charter, architecture, data model, operations, layout, publishing, ORIGIN integration, testing, release
```

## Documentation

- [Product charter and MVP gate](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Editor operations contract](docs/EDITOR_OPERATIONS.md)
- [Layout and positioning model](docs/LAYOUT_MODEL.md)
- [Publishing contract](docs/PUBLISHING.md)
- [ORIGIN integration plan](docs/ORIGIN_INTEGRATION.md)
- [Testing](docs/TESTING.md)
- [Release, hosting and rollback](docs/RELEASE.md)
- [Relocating to its own repository](docs/RELOCATION.md)
- [Release readiness report](docs/RELEASE_READINESS.md)
