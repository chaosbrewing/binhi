# Release, hosting and rollback

## Environments

| Environment | Database | `BINHI_PUBLIC_URL` | Notes |
| --- | --- | --- | --- |
| Local | `binhi_dev` on localhost | `http://127.0.0.1:4100` | `npm run dev` + `npm run dev:client` |
| Test / CI | `binhi_test` (truncated by tests) | `https://binhi.test` (verification injected) | never point at a real database |
| Production | a dedicated Postgres database | the public hostname | separate secrets; never ORIGIN's production database |

Required variables: `BINHI_DATABASE_URL`, `BINHI_SESSION_SECRET` (32 random
bytes, hex), `BINHI_PUBLIC_URL`, `BINHI_PORT`, `NODE_ENV=production`.
Optional: `BINHI_MEDIA_STORAGE=disk` + `BINHI_MEDIA_DIR` (persistent volume),
`BINHI_ALLOW_SIGNUP=false` for a private instance, `BINHI_MAX_UPLOAD_BYTES`,
`BINHI_VERIFY_BASE_URL` when the server cannot reach its own public URL.

## Replit (standalone host) — owner steps

BINHI does not create or modify any Replit project itself. To host it:

1. Create a Replit app from this repository (Node 22). In the Replit shell:
   `npm ci && npm run build --workspace apps/binhi`.
2. Add a Replit PostgreSQL database and set `BINHI_DATABASE_URL` to its
   connection string; set the other secrets above.
3. Run command: `NODE_ENV=production node apps/binhi/dist/server/start.js`
   (migrations run at startup). Port: `BINHI_PORT` (Replit maps it to 80/443).
4. Set `BINHI_PUBLIC_URL` to the deployment's hostname. Published sites are
   served at `https://<hostname>/s/<slug>/`.
5. Verify: `GET /api/health` returns `{ ok: true }`; sign up, create a site,
   publish, open the live link in a private window.

Custom domains / tenant subdomains: not supported in v0.1. They require
wildcard DNS, TLS issuance and host-based routing that Replit autoscale does
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
