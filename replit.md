# BINHI on Replit

This is the standalone repository: run commands from the repository root.
Keep the existing React/Vite client, Fastify server, and PostgreSQL storage.

## Run

Click **Run** to start the `Start application` workflow:

```sh
npm run build && npm start
```

The workflow builds the editor and server, then serves the UI, API, media,
and published websites together on `0.0.0.0:5000`. Open Preview and choose
**Create an account** to start. No demo account or password is seeded.
Source changes appear after restarting the workflow, which rebuilds the app.

After a task merges, Replit runs `scripts/post-merge.sh` to install locked
dependencies, apply development database migrations, and rebuild the app,
then reconciles the running workflow. The hook refuses production execution.

Node.js 22 is configured. Dependencies are installed from `package-lock.json`.
Vite, its React plugin, and Vitest were upgraded together because the
imported Vitest version was blocked by the package security firewall.

## Configuration and persistence

- `DATABASE_URL`: Replit-managed development PostgreSQL; used automatically
  unless `BINHI_DATABASE_URL` is explicitly set.
- `SESSION_SECRET`: existing Replit secret; used automatically unless
  `BINHI_SESSION_SECRET` is explicitly set. Neither value belongs in files.
- `BINHI_PORT=5000`: configured in `.replit`.
- The workspace public URL is derived from `REPLIT_DEV_DOMAIN`; production
  uses `REPLIT_DOMAINS` or an explicit `BINHI_PUBLIC_URL`, never the
  workspace's `.replit.dev` address.
- The workspace serves its built editor with `BINHI_SERVE_BUILT_CLIENT`;
  this does not enable production mode.
- Media uses the existing PostgreSQL blob adapter by default, not local disk.
- Development startup applies checked-in migrations to the workspace
  database. Production startup skips migrations; Replit Publish applies
  development schema changes to its managed production database.

No external integration is needed for the existing standalone features.
Do not copy `.env.example` unchanged: its local database address and sample
secret are not the Replit configuration.

## Verification

```sh
npm run typecheck
npm run test:unit
node scripts/smoke.mjs "https://$REPLIT_DEV_DOMAIN"
```

Setup verification passed the build, both TypeScript checks, 45 unit tests,
and all seven smoke checks. The sign-in page was visually checked. HTTP
checks against the running workspace also passed sign-up/session handling,
website creation, saved document edits and reload, publication and anonymous
page retrieval, unpublication, and temporary account cleanup. The signed-in
editor was not visually verified.

**Do not point the integration tests at the workspace database.** `npm test`
and local end-to-end tests truncate their target database and require a
separate disposable `BINHI_TEST_DATABASE_URL`. Unit tests do not require it.

## Publishing status

This setup starts the development workspace only; it does not publish the app.
Publish from Replit to provision/use the managed production database and apply
the development-to-production schema diff. Do not run production DDL from
builds or app startup. See `docs/RELEASE.md` for owner steps.
