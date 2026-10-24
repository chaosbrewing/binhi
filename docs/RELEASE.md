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

## Release checklist

- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` green
  (CI does this).
- Migrations reviewed (`migrations/`), forward-only; development schema is
  current before Publish.
- Production schema changes are made only by the Replit Publish flow, never
  by app startup or deploy builds.
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
