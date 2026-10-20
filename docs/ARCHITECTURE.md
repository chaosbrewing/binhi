# BINHI architecture

BINHI is a **modular monolith**: one Node process serves the editor, the
API and the published websites. Code is split by responsibility, not by
deployable, so the future ORIGIN integration can swap adapters without
moving files.

```
┌──────────────────────── apps/binhi ────────────────────────┐
│  src/client  (React, Vite)        src/server (Fastify)     │
│  ┌───────────┐  ops batches  ┌──────────┐  ┌────────────┐  │
│  │  Editor   │ ───────────▶  │  Sites   │  │ Publishing │  │
│  │  store    │ ◀───────────  │  service │  │  service   │  │
│  └─────┬─────┘  revision     └────┬─────┘  └─────┬──────┘  │
│        │                          │              │         │
│        ▼           src/core       ▼              ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ schema · registry · operations · renderer · templates│  │
│  └──────────────────────────────────────────────────────┘  │
│        canvas iframe ◀── renderPage(mode: editor)          │
│        /api/sites/:id/preview ◀── renderPage(mode: preview)│
│        /s/<slug>/ ◀── stored HTML from renderPage(publish) │
└────────────────────────────────────────────────────────────┘
                 PostgreSQL (binhi_* tables) · object storage
```

## The three layers

### `src/core` — isomorphic, dependency-light
- **`schema/document.ts`** — the canonical website model (Zod). Strict
  objects, whitelisted CSS values, bounded sizes, `schemaVersion`.
- **`registry/components.ts`** — the only components that can exist, with
  their prop schemas, defaults, child rules, layout modes and property groups.
- **`ops/operations.ts` + `ops/apply.ts`** — every edit as a typed operation
  and the pure reducer that applies it. The **editor and the server run the
  same reducer**, so a change that fails locally never reaches the network
  and a change the server rejects is a genuine conflict or bug, never a
  mismatch.
- **`render/`** — one renderer for three modes: `editor` (adds `data-b-*`
  hooks, shows hidden nodes), `preview` (authenticated, draft) and `publish`
  (static HTML with a publication marker). Responsive behaviour is real CSS
  media queries, so the canvas iframe at 390px and a phone agree.
- **`templates/`** — five starter sites built with `makeNode`, validated on
  construction.
- **`validate.ts`** — pre-publish errors and accessibility warnings.

### `src/server` — Fastify, Drizzle, Postgres
- **Auth**: scrypt passwords, HMAC-hashed session tokens, HttpOnly
  `SameSite=Lax` cookie, CSRF header guard (`x-binhi-request: editor`) on
  every mutating API call, rate limits on auth, uploads, publishing and forms.
- **Sites**: ownership-checked CRUD; `POST /ops` applies a batch inside a
  transaction with `SELECT … FOR UPDATE`, revision check (409 with the server
  document), idempotent `batchId`, revision snapshot and retention.
- **Assets**: raw-body uploads, magic-byte sniffing (PNG/JPEG/WebP/GIF only),
  size/dimension/quota limits, `ObjectStorage` interface with Postgres-blob and
  disk adapters.
- **Publishing**: `PublishingAdapter` contract; local adapter stores rendered
  pages and serves them at `/s/<slug>/`. Verification fetches the page through
  the public route *before* it becomes live.
- **Public**: published pages with a strict CSP, form endpoint, 404/410 pages.

### `src/client` — React 18, no state library
- **`editor/store.ts`** — `EditorStore`: document, selection, breakpoint,
  zoom, history (snapshots), autosave queue, conflict state. `dispatch(ops)`
  applies locally via `applyOperations`, records undo, queues the ops; a
  debounced `flush()` sends one batch against the last confirmed revision.
- **Canvas** — an `<iframe>` whose body is replaced from `renderPage` on each
  change (no full reload), plus an overlay that hit-tests through
  `elementFromPoint`, draws selection/hover boxes, handles, guides, drop
  indicators, marquee, and commits transient drags as operations.
- **Panels** — pages, elements, sections (presets + saved sections), layers,
  media, brand styles, menu. **Properties** — contextual groups driven by the
  registry's `groups`. Dialogs — history, publish, settings, submissions.

## Key decisions

| Decision | Why |
| --- | --- |
| Document is JSON in Postgres, not rows per node | Atomic saves, trivial snapshots, no join explosion; the schema is enforced by Zod on every write. |
| Snapshot per revision (not op log) | Restore and publish need a complete document; retention keeps 200 autosaves plus anything published. |
| Undo/redo as `replaceDocument` ops | Keeps "every change is a validated op" true without inverse-op bookkeeping. |
| iframe canvas with DOM patching | True renderer parity and true media queries; no second React renderer to keep in sync. |
| Percent-based freeform placement | Freeform layouts scale with the viewport without JavaScript; `stackOnMobile` for small screens. |
| CSP on published pages | Visitor safety: no scripts except BINHI's tiny runtime, embeds only from known players. |
| In-memory rate limits | Single-process host; documented as the thing to replace when scaling out. |

## Boundaries that must hold

- The editor never writes HTML; it dispatches operations.
- The server never trusts client state; it re-applies operations.
- Published output never includes editor hooks or draft data.
- Nothing in `apps/binhi` imports from `@mayari/*` or ORIGIN.
