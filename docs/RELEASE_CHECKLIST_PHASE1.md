# BINHI Phase 1 — production release checklist

Scope: releasing PR #1 (`claude/binhi-visual-editor-12arge` → `main`) to the
existing Replit Autoscale deployment at https://binhi.replit.app.
Every step marked **FOUNDER** changes production or spends money and must be
performed or explicitly authorised by the founder. Steps marked **engineer**
can be done from the workspace or this repository without touching production.

## 0. Preconditions (must all be true before step 1)

| # | Check | Owner | How to verify |
| --- | --- | --- | --- |
| 0.1 | PR #1 CI green on its final head: typecheck, unit + integration, build, website journey, studio journey | engineer | GitHub Actions run on the PR head commit |
| 0.2 | Replit branch `feat/binhi-studio-m1` is on GitHub and merged into the PR branch (no commits lost) | engineer | **Done**: head `b6b07a0` is an ancestor of PR head `6bb1e43` (`git merge-base --is-ancestor`) |
| 0.3 | Replit workspace is checked out on the approved branch, development DB migrated, `npm run typecheck`, `npm run test:unit`, `npm run build` and `node scripts/smoke.mjs https://$REPLIT_DEV_DOMAIN` pass there | engineer | workspace shell output recorded in `docs/PHASE1_STATUS.md` |
| 0.4 | PR reviewed and merged to `main` | **FOUNDER** | merge commit SHA |

## 1. Database backup (before any production schema change)

| # | Step | Owner |
| --- | --- | --- |
| 1.1 | In Replit → Database (production), take a point-in-time restore point / snapshot and note its timestamp. If the plan has no snapshot feature, run a read-only `pg_dump` of the production database from the Replit shell to a private location outside the repository. | **FOUNDER** |
| 1.2 | Record `npm run db:check`-equivalent facts for production (database name `neondb`, 12 existing `binhi_*` tables + `drizzle.binhi_migrations`) — read-only. | **FOUNDER** |

## 2. Migration verification (what 0001 does and how to prove it is safe)

`migrations/0001_binhi_creative_studio.sql` (13 statements):

- `CREATE TABLE IF NOT EXISTS` × 4: `binhi_projects`, `binhi_library_assets`, `binhi_asset_usages`, `binhi_brand_kits`
- `ADD CONSTRAINT … FOREIGN KEY` × 5 (guarded by `duplicate_object`), all `ON DELETE cascade` to the new tables or to `binhi_users`
- `CREATE INDEX IF NOT EXISTS` × 5

No `DROP`, no `ALTER COLUMN`, no data migration, no change to any existing
table. Two things the generic scanner flags are safe by construction: the
unique index and foreign keys only constrain rows of the *new* tables (or
cascade from `binhi_users`), which the old build never writes. Evidence:

| Check | Result |
| --- | --- |
| Old build (`main` @ b6570ff, clean `npm ci`) integration suite against a database already carrying 0001 (2 migrations recorded, all 4 new tables present) | **28/28 tests passed** (auth, sites, media, publishing, forms), 2026-10-25 |
| `npm run db:compat` (scanner merged from the Replit branch) | Flags only the 2 foreign keys / 1 unique index on the new tables; migration carries the reasoned `binhi:compatibility-reviewed` marker; no drop, rename, column change or data removal |
| New build against a fresh database (0000 + 0001) | 116 tests, both browser journeys |
| Startup behaviour | development applies migrations at boot; production **refuses** to run them (`assertMigrationsAllowed`, unit-tested) |

Production receives the schema only through **Replit Publish's development → production schema diff**. Before confirming that diff:

| # | Step | Owner |
| --- | --- | --- |
| 2.1 | Workspace development DB is on 0001 (`npm run db:migrate` reports "applied"; `npm run db:check` shows 16 `binhi_*` tables) | engineer |
| 2.2 | Open Replit Publish; read the proposed schema diff. It must list exactly the four new tables, their indexes and foreign keys, and **nothing** else (no drops, renames or column changes). If anything else appears, stop. | **FOUNDER** |

## 3. Publish

| # | Step | Owner |
| --- | --- | --- |
| 3.1 | Confirm deployment secrets are unchanged: `BINHI_SESSION_SECRET` set and distinct from the workspace value; `BINHI_DATABASE_URL` unset (managed `DATABASE_URL` is used); `BINHI_PUBLIC_URL` unset or `https://binhi.replit.app`. | **FOUNDER** |
| 3.2 | Publish from the Replit Publishing tool (build `npm ci && npm run build`, run `NODE_ENV=production node dist/server/start.js`). Approve the schema diff from 2.2. | **FOUNDER** |
| 3.3 | Watch the deployment log until the health endpoint responds. | **FOUNDER** |

## 4. Post-publish verification (production, read-only or self-cleaning)

| # | Step | Owner | Pass condition |
| --- | --- | --- | --- |
| 4.1 | `curl https://binhi.replit.app/api/health` | engineer | `{"ok":true,"env":"production",…}` |
| 4.2 | `node scripts/smoke.mjs https://binhi.replit.app` | engineer | 7/7 |
| 4.3 | `BINHI_E2E_BASE=https://binhi.replit.app npm run test:e2e:remote` (creates and deletes its own account; needs Chromium) | engineer | 13 steps |
| 4.4 | Manual studio pass on production with a throwaway account: dashboard shows 10 destinations; save a photo project and reopen it; create a design and export PNG; create a brand kit; delete the account at the end | engineer | all pass, account deleted |
| 4.5 | Read-only production metadata: 16 `binhi_*` tables, `drizzle.binhi_migrations` unchanged (Replit Publish does not write it) | **FOUNDER** | matches |

The studio journey (`test:e2e:studio`) intentionally refuses remote mode
because it needs a disposable database; 4.4 is the manual equivalent.

## 5. Rollback

| Situation | Action | Owner |
| --- | --- | --- |
| App misbehaves, schema fine | Replit → Deployments → redeploy the previous build. The old build runs unchanged against the new schema (0001 is additive; verified in §2). | **FOUNDER** |
| Schema diff applied something unexpected | Restore the snapshot from 1.1, then redeploy the previous build. | **FOUNDER** |
| A website's content or theme is wrong (e.g. a brand kit applied by mistake) | Editor → History → Restore the previous revision (no deploy needed). | owner of the site |
| Need to disable the new tools without a rollback | Not available as a flag in Phase 1; redeploy the previous build instead. | **FOUNDER** |

## 6. What this checklist does not cover

- Custom domains and `chaosorigins.today` cutover (separate owner-approved DNS work).
- Any ORIGIN integration: Phase 1 ships no adapters and talks to no ORIGIN system.
- Phase 2 work: do not start until §4 passes.
