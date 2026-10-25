# Release, hosting and rollback

## Environments

| Environment | Database | `BINHI_PUBLIC_URL` | Notes |
| --- | --- | --- | --- |
| Local | `binhi_dev` on localhost | `http://127.0.0.1:4100` | `npm run dev` + `npm run dev:client` |
| Test / CI | `binhi_test` (truncated by tests) | `https://binhi.test` (verification injected) | never point at a real database |
| Replit development workspace | Replit-managed development PostgreSQL (`DATABASE_URL`) | `REPLIT_DEV_DOMAIN` or an explicit URL | startup migrations apply to development |
| Replit production | Replit-managed production PostgreSQL (`DATABASE_URL`) | `REPLIT_DOMAINS` or an explicit published URL | Replit Publish applies development-to-production schema changes |

Required settings: `BINHI_DATABASE_URL` (or the host's `DATABASE_URL`),
`BINHI_SESSION_SECRET` (32 random bytes, hex), `BINHI_PORT` (or the host's
`PORT`), and `NODE_ENV=production` (implied by `REPLIT_DEPLOYMENT`).
`BINHI_PUBLIC_URL` is optional where Replit supplies the environment-specific
domain; set it explicitly in production if `REPLIT_DOMAINS` is unavailable or
does not identify the canonical host.
Optional: `BINHI_MEDIA_STORAGE=disk` + `BINHI_MEDIA_DIR` (persistent volume),
`BINHI_ALLOW_SIGNUP=false` for a private instance, `BINHI_MAX_UPLOAD_BYTES`,
`BINHI_VERIFY_BASE_URL` when the server cannot reach its own public URL.

In production, BINHI uses the published host from `REPLIT_DOMAINS` (the first
entry) or an explicit `BINHI_PUBLIC_URL`; it never falls back to
`REPLIT_DEV_DOMAIN` or a `.replit.dev` URL. Set `BINHI_PUBLIC_URL` explicitly
when a custom domain should be canonical or the deployment exposes multiple
domains.

## Replit owner steps

The `.replit` file configures Node 22, PostgreSQL 16, and an Autoscale
deployment. The development Run workflow builds and starts BINHI without
forcing production mode; `BINHI_SERVE_BUILT_CLIENT` keeps the built editor
available while local/workspace migrations continue to run at startup.
Publishing builds with `npm ci && npm run build` and starts
`node dist/server/start.js` with `NODE_ENV=production`; neither the build nor
production startup runs schema DDL.

The server maps the host's `DATABASE_URL` to `BINHI_DATABASE_URL`,
`SESSION_SECRET` to `BINHI_SESSION_SECRET`, and `PORT` to `BINHI_PORT` when
the BINHI-specific setting is absent. Replit uses a different managed
`DATABASE_URL` for development and production.

Publishing is an owner action. Do not create a separate external production
database or set a deployment-only `BINHI_DATABASE_URL` for the managed
Replit database.

1. **Development database**: attach Replit PostgreSQL to this workspace.
   `DATABASE_URL` is the development database. Run `npm run db:check` in the
   workspace shell to verify the selected host and database name without
   printing credentials.
2. **Schema changes**: use the development workflow or `npm run db:migrate`
   to apply checked-in migrations to development. When publishing, Replit
   compares the development and production schemas and applies the diff to
   the managed production database. Review and confirm any rename prompts in
   the Publish UI. Never run `db:migrate`, SQL DDL, or another schema-changing
   command against production; do not add DDL to the build or app startup.
3. **Secrets** (Workspace → Secrets, and deployment secrets):
   - `BINHI_SESSION_SECRET` — 32 random bytes, hex; use *different* values
     for workspace and deployment (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - Optional: `BINHI_ALLOW_SIGNUP=false` once the first accounts exist,
     `BINHI_MEDIA_STORAGE=disk` + `BINHI_MEDIA_DIR` only if a persistent
     volume is attached (Autoscale has no persistent disk; keep the default
     Postgres storage), `BINHI_VERIFY_BASE_URL=http://127.0.0.1:4100` if the
     deployment cannot fetch its own public hostname.
4. **Published URL**: the app derives its URL from the published
   `REPLIT_DOMAINS` value. Set deployment `BINHI_PUBLIC_URL` to the actual
   published URL when choosing a canonical custom domain or when more than
   one domain is configured. Never set it to the workspace `.replit.dev`
   address.
5. **Publish** from the Replit Publishing tool. Replit manages the production
   database and applies the schema diff; production app startup does not run
   migrations. The app fails fast if the session secret is still the example
   value.
6. **Verify the published deployment** using the actual URL shown in
   Publishing:
   - `node scripts/smoke.mjs https://<published-domain>` — health, editor
     shell, 410 for unknown sites, CSRF/auth guards, secure headers.
   - `BINHI_E2E_BASE=https://<published-domain> npm run test:e2e:remote` —
     the complete journey in a real browser (sign-up, canvas editing,
     autosave, revision restore, publish, anonymous desktop and mobile visit,
     unpublish) which deletes its own account afterwards. Requires
     `npx playwright install chromium` on the machine running it.
7. Record the published URL and development/production `db:check` outputs in
   `docs/RELEASE_READINESS.md`.

Custom domains / tenant subdomains: not supported in v0.1. They require
wildcard DNS, TLS issuance and host-based routing that Replit Autoscale does
not provide out of the box; path-based URLs are the honest default.

## Phase 1 schema change (owner approval needed before publishing)

`migrations/0001_binhi_creative_studio.sql` adds four tables
(`binhi_projects`, `binhi_library_assets`, `binhi_asset_usages`,
`binhi_brand_kits`). It is additive: no existing table or column changes, and
the previous build runs unchanged against the new schema. In the Replit
workspace the development database picks it up on the next start or
`npm run db:migrate`; production receives it only through the Replit Publish
schema diff, which is an owner action. Library originals are stored in the
existing Postgres blob storage, so the managed database grows with uploads
(up to 300 MB per account by the service limit); no new paid service is
introduced.

## Release checklist

- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` green
  (CI does this).
- `npm run db:compat` passes. Review each migration against both the current
  release and the immediately previous release, including their reads and
  writes; the checker flags common incompatible/destructive SQL but is not a
  substitute for this review.
- Migrations reviewed (`migrations/`), forward-only; development schema is
  current before Publish. Follow the expand/contract and review steps below.
- Never edit a migration already applied to an environment. Add a new
  incremental migration instead; `npm run db:compat` intentionally scans
  incremental migrations, not the immutable bootstrap.
- Production schema changes are made only by the Replit Publish flow, never
  by app startup or deploy builds.
- `BINHI_SESSION_SECRET` is not the example value (the server refuses to boot
  in production otherwise).
- Smoke: health, sign-in, open editor, publish, visit live page, unpublish.

## Schema compatibility review

`0000_binhi_initial.sql` is the bootstrap: it creates the initial tables,
indexes and foreign keys for a fresh database and is excluded from the
compatibility scan. `0001_binhi_creative_studio.sql` is the first incremental
migration; its review is recorded in *Phase 1 schema change* above and in
`docs/RELEASE_CHECKLIST_PHASE1.md`.
Once applied, migration files are immutable: change the schema only in a new
incremental migration.
For later migrations, check the actual current and immediately previous
application versions, including rollback builds. Preserve every column,
constraint, default, and data shape those versions still read or write.

Use an expand/contract sequence:

1. **Expand:** add new tables or nullable columns, or columns with a safe
   database default. Avoid renames, drops, new required columns without a
   default, and constraints that old writes can violate. Consider the table
   size and lock/backfill cost as well as application compatibility.
2. **Transition:** release code that works with both old and new schema,
   backfill data separately when needed, and keep old write paths valid.
   Verify reads and writes for both the current and previous build against the
   expanded schema.
3. **Contract:** remove old columns or constraints only in a later release,
   after the oldest supported/rollback build no longer uses them and a rollback
   to it is no longer expected.

Run `npm run db:compat` for a quick scan of migration SQL. It blocks common
drop, rename, column-contract, uniqueness, and data-removal operations unless
the migration includes a reasoned
`-- binhi:compatibility-reviewed: <reason>` annotation. This annotation only
records that a reviewer considered the risk; it does not make a migration
compatible. The release reviewer must still document which app versions were
checked and how rollback remains safe. Add a focused test when an SQL change
cannot be assessed from syntax alone.

## Rollback

- **Application**: redeploying the previous build is safe only if that build
  is compatible with the schema already applied. Replit Publish's schema
  change is not undone by rolling back application code. Do not claim an app
  rollback is safe merely because migrations are forward-only; use the schema
  compatibility review above.
- **A website**: Publish dialog → publication history → *Make live* on an
  earlier publication (re-verified before switching).
- **Content**: History → *Restore* an earlier revision (creates a new
  revision; nothing is deleted).
- **Database**: Replit documents point-in-time database restore for recovery,
  subject to the account's restore-retention window. A database restore does
  not roll application code back; coordinate and restore the matching app
  version separately. Restoring the database can discard writes made after
  the restore point, so it is a data-recovery operation, not a routine schema
  rollback. See [Replit data recovery](https://docs.replit.com/features/data-and-storage/data-recovery)
  and [development and production databases](https://docs.replit.com/features/data-and-storage/development-and-production).
- **Schema**: do not assume Replit Publish provides a reversible migration or
  that a later schema diff can reconstruct dropped data. Treat applied schema
  changes as forward-only; prefer a corrective forward migration. Use a
  coordinated database restore only when necessary and after accounting for
  writes since the restore point.

## Operations notes

- Rate limits are in-memory per process; a multi-instance deployment needs a
  shared store before scaling out.
- Published pages are cached for 60 s by intermediaries; unpublish is
  immediate at the origin.
- Audit entries live in `binhi_audit_log` (account, site, media and
  publishing actions with ip).
