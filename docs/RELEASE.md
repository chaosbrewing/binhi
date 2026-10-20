# Release, hosting and rollback

## Environments

| Environment | Database | `BINHI_PUBLIC_URL` | Notes |
| --- | --- | --- | --- |
| Local | `binhi_dev` on localhost | `http://127.0.0.1:4100` | `npm run dev` + `npm run dev:client` |
| Test / CI | `binhi_test` (truncated by tests) | `https://binhi.test` (verification injected) | never point at a real database |
| Production | a dedicated Postgres database | the public hostname | separate secrets; never ORIGIN's production database |

Required variables: `BINHI_DATABASE_URL` (or the host's `DATABASE_URL`),
`BINHI_SESSION_SECRET` (32 random bytes, hex), `BINHI_PUBLIC_URL` (derived
from Replit domains when unset), `BINHI_PORT` (or the host's `PORT`),
`NODE_ENV=production` (implied by `REPLIT_DEPLOYMENT`).
Optional: `BINHI_MEDIA_STORAGE=disk` + `BINHI_MEDIA_DIR` (persistent volume),
`BINHI_ALLOW_SIGNUP=false` for a private instance, `BINHI_MAX_UPLOAD_BYTES`,
`BINHI_VERIFY_BASE_URL` when the server cannot reach its own public URL.

## Replit (standalone host) — owner steps

BINHI ships a `.replit` file (Node 22 + PostgreSQL 16 modules, Autoscale
deployment that runs `npm ci && npm run build` and starts
`node dist/server/start.js`). The server resolves host defaults itself:
`DATABASE_URL` → `BINHI_DATABASE_URL`, `PORT` → `BINHI_PORT`,
`REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN` → `BINHI_PUBLIC_URL`,
`REPLIT_DEPLOYMENT` → `NODE_ENV=production`. The only secret that must be
set by hand is `BINHI_SESSION_SECRET`.

Nothing below has been executed by the development session; creating the
Replit app, its databases and secrets is an owner action.

1. **Create the Replit app** from the `chaosbrewing/binhi` repository
   (Import from GitHub). Do not reuse the ORIGIN Replit app.
2. **Development database**: add the Replit PostgreSQL database to the
   workspace. Replit sets `DATABASE_URL` for the workspace; BINHI uses it in
   development. Run `npm run db:check` in the workspace shell — it prints the
   database host and name without secrets.
3. **Production database**: in the Deployments pane, enable the separate
   production database (Replit provisions it and injects a *different*
   `DATABASE_URL` into deployments). After the first deploy, open a
   deployment shell and run `npm run db:check` again; the host/name must
   differ from step 2. If the option is unavailable on the plan, create a
   dedicated managed Postgres elsewhere and set `BINHI_DATABASE_URL` as a
   deployment-only secret. Development and production must never share a
   database.
4. **Secrets** (Workspace → Secrets, and Deployments → Secrets):
   - `BINHI_SESSION_SECRET` — 32 random bytes, hex; use *different* values
     for workspace and deployment (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - Optional: `BINHI_ALLOW_SIGNUP=false` once the first accounts exist,
     `BINHI_MEDIA_STORAGE=disk` + `BINHI_MEDIA_DIR` only if a persistent
     volume is attached (Autoscale has no persistent disk; keep the default
     Postgres storage), `BINHI_VERIFY_BASE_URL=http://127.0.0.1:4100` if the
     deployment cannot fetch its own public hostname.
5. **Deploy** (Autoscale, 1 machine is enough for a beta). Migrations run at
   startup; the deploy fails fast if the session secret is still the example
   value.
6. **Verify the deployment**:
   - `node scripts/smoke.mjs https://<app>.replit.app` — health, editor
     shell, 410 for unknown sites, CSRF/auth guards, secure headers.
   - `BINHI_E2E_BASE=https://<app>.replit.app npm run test:e2e:remote` —
     the complete journey in a real browser (sign-up, canvas editing,
     autosave, revision restore, publish, anonymous desktop and mobile visit,
     unpublish) which deletes its own account afterwards. Requires
     `npx playwright install chromium` on the machine running it.
7. Record the deployment URL and the two `db:check` outputs in
   `docs/RELEASE_READINESS.md`.

Custom domains / tenant subdomains: not supported in v0.1. They require
wildcard DNS, TLS issuance and host-based routing that Replit Autoscale does
not provide out of the box; path-based URLs are the honest default.

## Release checklist

- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` green
  (CI does this).
- Migrations reviewed (`apps/binhi/migrations/`), forward-only.
- `BINHI_SESSION_SECRET` is not the example value (the server refuses to boot
  in production otherwise).
- Smoke: health, sign-in, open editor, publish, visit live page, unpublish.

## Rollback

- **Application**: redeploy the previous build; the schema is additive so an
  older build runs against a newer database.
- **A website**: Publish dialog → publication history → *Make live* on an
  earlier publication (re-verified before switching).
- **Content**: History → *Restore* an earlier revision (creates a new
  revision; nothing is deleted).
- **Database**: standard Postgres backups; media stored in Postgres is included.

## Operations notes

- Rate limits are in-memory per process; a multi-instance deployment needs a
  shared store before scaling out.
- Published pages are cached for 60 s by intermediaries; unpublish is
  immediate at the origin.
- Audit entries live in `binhi_audit_log` (account, site, media and
  publishing actions with ip).
