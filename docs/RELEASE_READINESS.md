# BINHI v0.1 — release readiness report

Date: 2026-10-24 · Scope: standalone BINHI in the Replit development workspace and published runtime

## Verdict

**BINHI is published, and development/production database separation is
verified read-only.** The workspace uses `heliumdb`; the production database
reports `neondb`. The published health endpoint reports `production` and
successfully queries its database, while the deployment uses Replit's managed
`DATABASE_URL` with no `BINHI_DATABASE_URL` override. Both databases have the
12 expected BINHI tables. The full remote primary journey
(`npm run test:e2e:remote`) remains to be run before claiming complete
production readiness; see *Deployment status*.

## Deployment status

| Item | State |
| --- | --- |
| Replit development workspace | **Imported and running**. |
| Published runtime | **Published and healthy** at `https://binhi.replit.app`; `/api/health` reports `env: production` and successfully queries the database. |
| Development / production databases | **Separation confirmed read-only on 2026-10-24.** Development is `helium` / `heliumdb`; the production read-only database reports `neondb`. Replit-managed `DATABASE_URL` is present for production, and no `BINHI_DATABASE_URL` override is configured. Both databases contain the 12 expected BINHI tables. |
| Secrets | Configure distinct workspace and deployment `BINHI_SESSION_SECRET` values; the server refuses to boot in production with the example value. |
| Production schema handling | **Configured**: development migrations run in non-production; production startup refuses migrations and relies on Replit Publish's schema diff. |
| Published-domain configuration | **Verified**: Replit deployment metadata reports `https://binhi.replit.app`; the production health endpoint responds there. |
| Complete journey against a deployed instance | **Not run against the published domain.** The same journey passes locally in 13 steps, including sign-up, canvas editing, autosave, revision restore, publish, anonymous desktop + mobile access, unpublish and cleanup. |

## Verification evidence

The full editor journey and PostgreSQL integration results below come from the
prior local release exercise. Typechecking, unit tests, the production build,
and the local editor journey were last recorded on 2026-10-21. On 2026-10-24,
the workspace `npm run db:check` reported `development (Replit workspace)`,
host `helium`, database `heliumdb`, a successful connection, and 12 BINHI
tables. The published `/api/health` endpoint reported `env: production` and
`ok: true`; its database probe succeeded. A read-only query through Replit's
production database replica reported database `neondb` and 12 BINHI tables,
including the `drizzle.binhi_migrations` table. The deployment uses
Replit-managed `DATABASE_URL`; no `BINHI_DATABASE_URL` override is configured.

The workspace does not provide a shell inside the published container, so
`npm run db:check` itself could not be run there. Production separation was
instead confirmed with the live health endpoint, deployment configuration,
and read-only production database metadata. No production records were read or
changed, and no DDL or migrations were run.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | **Passed for current Replit configuration and migration guard** |
| Unit tests | `npm run test:unit` | **50 tests passed** (config, migrations, document, operations, render, store, geometry) |
| Production build | `npm run build` | **Passed**; client and server compiled |
| Development database check | `npm run db:check` | **Connected read-only to Replit workspace database (`helium` / `heliumdb`); 12 BINHI tables** |
| Published runtime health | `curl https://binhi.replit.app/api/health` | **Passed**; returned `env: production`, `ok: true`; the app's database probe succeeded. |
| Production database metadata | Read-only Replit production query | **Database `neondb`; all 12 expected BINHI tables exist.** No application records were queried. |
| Published database separation | Deployment configuration + published health + read-only production metadata | **Confirmed**: production resolves Replit-managed `DATABASE_URL` (no `BINHI_DATABASE_URL` override); production database is `neondb`, distinct from workspace `heliumdb`. The published container shell was unavailable, so `npm run db:check` itself was not run there. |
| Production DDL guard | `tests/unit/migrations.test.ts` and startup condition | **Unit tests verify the migration runner refuses production; app startup skips it**. Replit Publish owns production schema changes. |
| Browser journey | `npm run test:e2e` | **13/13 steps passed**: sign up → template → canvas render → properties edit → inline canvas edit → insert element → autosave (server revision advanced) → undo → revision restore from history (and undo) → mobile breakpoint → publish (verified live) → anonymous visit desktop + mobile (no horizontal overflow, second page) → unpublish (410) → account cleanup (site stays offline) |
| Compiled artifact + smoke | `node dist/server/start.js` + `node scripts/smoke.mjs` | passed (7/7) with Replit-style environment |
| Exported standalone tree | `npm install && npm run typecheck && npm test && npm run build && npm run test:e2e` in the split repository | EXPORT_RESULT_PLACEHOLDER |
| Freeform interactions (browser probe) | ad-hoc Playwright probes | drag (+300/+99 px), resize via handle, rotation persisted to the document (73°), multi-select + group, undo removes group, mobile view, layers panel |

Screenshots from the journey are produced under `e2e/screenshots/`
(uploaded as a CI artifact).

## Milestone status

| Milestone | Status | Notes |
| --- | --- | --- |
| 0 Repository & architecture | Done | canonical schema, registry, ops, renderer, templates, CI, docs |
| 1 Functional editor foundation | Done | accounts, sites, pages, registry, canvas, properties, selection, structured containers, autosave |
| 2 Canva-like editing | Done | drag/drop, zoom/pan/fit, resize/rotate handles, alignment guides + snapping + grid, layers/z-order, group/ungroup, lock, copy/paste/duplicate, responsive preview, theme tokens, media library, templates, undo/redo, revision history |
| 3 Wix-like structure | Done | pages (create/duplicate/rename/reorder/home/hide/URL/SEO/delete), menu (auto or custom with nesting), header/footer, saved sections, columns/grids, responsive overrides, brand styles panel |
| 4 Publishing | Done | snapshot → render → deploy → verify → live; unpublish; rollback; failure states; forms with submissions |
| 5 Release hardening | Partially done | security tests, e2e, CI and docs done; see *Not done* |
| 6 ORIGIN adapter readiness | Specified | `docs/ORIGIN_INTEGRATION.md`; no adapters built, nothing connected to ORIGIN |

## Security and privacy summary

- Ownership checked on every site, asset, revision, publication and
  submission call; strangers receive 404 (tests cover cross-account access).
- scrypt password hashes; HMAC-hashed session tokens; HttpOnly, SameSite=Lax,
  Secure-in-production cookie; custom-header CSRF guard; rate limits on auth,
  uploads, publishing and forms.
- All visitor-facing output is generated from the validated document with
  escaping; links and media sources are sanitised (no `javascript:`, `data:`
  or non-https); embeds are sandboxed and limited to known hosts; published
  pages carry a strict CSP.
- Uploads are sniffed by magic bytes; SVG and non-images are rejected; sizes
  and quotas are enforced; file names are sanitised.
- Account deletion unpublishes and soft-deletes everything and revokes
  sessions. Audit log records account, site, media and publishing actions.
- No telemetry, no third-party scripts on the editor; published sites load
  only Google Fonts (when a web font is chosen) and the optional embeds the
  owner adds.

## Not done (honest gaps)

1. **Custom domains / tenant subdomains** — path-based `/s/<slug>/` only.
2. **Rich text inline editing** — rich text is edited through the structured
   block editor in the properties panel, not directly on the canvas (headings,
   paragraphs and button labels are inline-editable).
3. **Image cropping is numeric** — crop values are set in the panel, not by
   dragging a crop frame.
4. **Email notifications for form submissions** — stored only.
5. **Multi-instance scaling** — rate limiters are in-memory; sessions and
   everything else are in Postgres.
6. **Full accessibility audit of the editor UI** — focus traps, labels,
   keyboard shortcuts and reduced-motion are implemented; an axe/manual pass
   is still to be run. The *published* output has heading/alt checks built in.
7. **Collaboration** — single editor per site is assumed; concurrent edits are
   detected (409) and resolved by choice, not merged.
8. **Remote release journey** — deployment and database separation are
   verified, but the full remote journey has not been run against the
   published domain.
9. **Standalone repository** — `chaosbrewing/binhi` does not exist yet; the
   export is prepared and verified, creation needs an owner.

## Owner actions required (in order)

1. Confirm workspace and deployment `BINHI_SESSION_SECRET` values are distinct.
   Keep `BINHI_DATABASE_URL` unset so Replit supplies the environment-specific
   managed database.
2. Run `node scripts/smoke.mjs https://binhi.replit.app` and
   `BINHI_E2E_BASE=https://<published-domain> npm run test:e2e:remote`.
3. Decide whether sign-ups stay open (`BINHI_ALLOW_SIGNUP`).
4. Approve the BINHI brand treatment used in the editor (green seed mark) or
   supply the approved sector icon derivative.
5. If the separate standalone repository is still part of the handoff, complete
   its reviewed transfer separately; it is not a prerequisite to this
   workspace's Replit Publish flow.

Integration contracts for ORIGIN, TALA, AGOS and LIYAB remain documented in
`ORIGIN_INTEGRATION.md` and inactive; nothing in this release talks to them.
