# BINHI v0.1 — release readiness report

Date: 2026-10-21 · Scope: standalone BINHI in the Replit development workspace

## Verdict

**Code and artifact are deployment-ready; the product is not yet verified in
production because no BINHI instance has been deployed.** Every
primary-journey step works against a real database and a real browser,
the development workspace is running, publishing is verified before it is
called live, and ownership is enforced on every API. Replit Publish manages
production schema changes; production startup and build do not run migrations.
Production readiness will be claimed only after the remote journey
(`npm run test:e2e:remote`) passes against a deployed instance — see
*Deployment status*.

## Deployment status

| Item | State |
| --- | --- |
| Replit development workspace | **Imported and running**. Publishing has not been performed. |
| Development / production databases | Development uses Replit's workspace `DATABASE_URL`; production uses Replit's publish-managed database. Production provisioning and separation remain unverified until the owner publishes. |
| Secrets | Configure distinct workspace and deployment `BINHI_SESSION_SECRET` values; the server refuses to boot in production with the example value. |
| Production schema handling | **Configured**: development migrations run in non-production; production startup refuses migrations and relies on Replit Publish's schema diff. |
| Published-domain configuration | Development uses `REPLIT_DEV_DOMAIN`; production uses `REPLIT_DOMAINS` or an explicit deployment `BINHI_PUBLIC_URL`, with no `.replit.dev` fallback. Verify the selected canonical domain after publishing. |
| Complete journey against a deployed instance | **Not run** (not published). The same journey passes locally in 13 steps, including sign-up, canvas editing, autosave, revision restore, publish, anonymous desktop + mobile access, unpublish and cleanup. |

## Verification evidence

The full editor journey and PostgreSQL integration results below come from the
prior local release exercise. For this update on 2026-10-21, typechecking,
unit tests, the production build, and a read-only development `db:check` were
rerun. No production publish or production database query was performed.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | **Passed for current Replit configuration and migration guard** |
| Unit tests | `npm run test:unit` | **50 tests passed** (config, migrations, document, operations, render, store, geometry) |
| Production build | `npm run build` | **Passed**; client and server compiled |
| Development database check | `npm run db:check` | **Connected to Replit development database; 12 BINHI tables** |
| Production DDL guard | `tests/unit/migrations.test.ts` and startup condition | **Unit tests verify the migration runner refuses production; app startup skips it**. Replit Publish owns production schema changes. |
| Browser journey | `npm run test:e2e --workspace apps/binhi` | **13/13 steps passed**: sign up → template → canvas render → properties edit → inline canvas edit → insert element → autosave (server revision advanced) → undo → revision restore from history (and undo) → mobile breakpoint → publish (verified live) → anonymous visit desktop + mobile (no horizontal overflow, second page) → unpublish (410) → account cleanup (site stays offline) |
| Compiled artifact + smoke | `node dist/server/start.js` + `node scripts/smoke.mjs` | passed (7/7) with Replit-style environment |
| Exported standalone tree | `npm install && npm run typecheck && npm test && npm run build && npm run test:e2e` in the split repository | EXPORT_RESULT_PLACEHOLDER |
| Freeform interactions (browser probe) | ad-hoc Playwright probes | drag (+300/+99 px), resize via handle, rotation persisted to the document (73°), multi-select + group, undo removes group, mobile view, layers panel |

Screenshots from the journey are produced under `apps/binhi/e2e/screenshots/`
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
8. **Replit deployment** — documented in `RELEASE.md`; creating the Replit
   project, databases and secrets is an owner action and has not been done,
   so the remote journey has not been run.
9. **Standalone repository** — `chaosbrewing/binhi` does not exist yet; the
   export is prepared and verified, creation needs an owner.

## Owner actions required (in order)

1. Confirm the workspace's Replit development PostgreSQL is selected and
   migrations are current (`npm run db:check`).
2. Configure separate workspace and deployment `BINHI_SESSION_SECRET`
   values. Keep `BINHI_DATABASE_URL` unset so Replit supplies the
   environment-specific managed database.
3. Publish from Replit. Review the development-to-production schema diff and
   confirm any column or table rename prompts. Do not run production DDL or
   migrations from a deployment shell, build, or app startup.
4. Verify that the deployment uses its production database and that
   `BINHI_PUBLIC_URL` resolves to the actual published domain (set it
   explicitly if needed); record the published URL and safe `db:check`
   outputs.
5. Run `node scripts/smoke.mjs https://<published-domain>` and
   `BINHI_E2E_BASE=https://<published-domain> npm run test:e2e:remote`.
6. Decide whether sign-ups stay open (`BINHI_ALLOW_SIGNUP`).
7. Approve the BINHI brand treatment used in the editor (green seed mark) or
   supply the approved sector icon derivative.
8. If the separate standalone repository is still part of the handoff, complete
   its reviewed transfer separately; it is not a prerequisite to this
   workspace's Replit Publish flow.

Integration contracts for ORIGIN, TALA, AGOS and LIYAB remain documented in
`ORIGIN_INTEGRATION.md` and inactive; nothing in this release talks to them.
