# Essential 250 (icon library) — release checklist and recommendation

Scope: pull request [#2](https://github.com/chaosbrewing/binhi/pull/2) (`claude/binhi-icon-library` → `main`), then
Replit Publish of the existing Autoscale deployment. **Nothing has been merged or published.** Steps marked
**FOUNDER** change `main`, production or spend money.

## 1. Recommendation

| Decision | Recommendation | Basis |
| --- | --- | --- |
| Review and merge PR #2 into `main` | **YES**, once the founder items F1–F3 below are answered | all engineering evidence in §2 is green on the final head; no migration, no secrets, no ORIGIN contact; every demonstrated data-loss path found in this work is fixed and regression-tested |
| Publish to production | **NOT YET** — YES after F4 and a staged switch-on (§4) | the production baseline could not be verified from here (§3); Phase 1's own production acceptance gate has no recorded evidence |

## 2. Engineering evidence (final branch head)

| Check | Result |
| --- | --- |
| GitHub CI on the PR head | see the PR checks (run for the final head is recorded in the PR description) |
| `npm run typecheck` | passed |
| `npm test` (unit + Postgres integration) | 209 tests passed (126 at Phase 1) |
| `npm run build` + `npm run check:bundle` | passed; main 184.8 KB gzip (Phase 1: 169.3 KB), icon browser 10.3 KB lazy, 25 lazy icon chunks 17.0 KB total |
| `npm run db:compat` | passed (no migration in this branch) |
| `npm run test:e2e` (website journey incl. the Replit coverage and an icon step) | 16/16 |
| `npm run test:e2e:studio` (Phase 1 Creative Studio) | 19/19 |
| `npm run test:e2e:icons` (browser, website icon, design icon, exports, kill switch, a11y/keyboard, phone/tablet, isolation) | 18/18 |
| Accessibility (axe-core, WCAG 2.2 A/AA; 5 regions incl. dark theme) | 0 violations after fixing one contrast failure |
| Licensing | 204 ISC, 41 ISC + MIT (Feather, detected by geometry), 5 BINHI originals; verbatim notices shipped at `/third-party-notices.txt` and in published pages; `docs/ICON_LICENSES.md` |
| Rapid-edit data loss (composites, duplicates, pastes, trees, groups, pages, reusable sections) | reproduced by 8 failing tests, fixed with deterministic `idSeeds`, now passing; documented in `EDITOR_OPERATIONS.md` |
| Older-build compatibility | measured against the Phase 1 build; strategy, kill switch, preflight in `ICON_COMPATIBILITY.md` |

## 3. What was independently checked about production (2026-10-25) — and what was not

| Item | Finding |
| --- | --- |
| Deployment | Replit reports the app published and `success` at https://binhi.replit.app; latest build `3a888f80-dea6-4768-860a-e0cd720e20e7`, 2026-10-25 00:29–00:32 UTC, account `porscharyder`. **Earlier reports that Phase 1 was unpublished are out of date.** |
| What is running | the workspace state at checkpoint `dc47889` (Phase 1 merge `dcdffcf` + two e2e-only commits); it contains migration 0001. It does **not** contain the icon library. |
| Replit workspace | branch `feat/binhi-studio-m1` @ `edf1d66`, clean tree. Two commits were absent from GitHub; preserved (plain push to a new branch, no force) as `replit/studio-e2e-2026-10-25` and merged into this branch with no conflicts. |
| Production database | **not verified.** The host and database are unreachable from this sandbox (proxy 403) and the production database was deliberately not queried. Whether the four Phase 1 tables exist in production, and whether Publish applied the schema diff, is unconfirmed. |
| HTTP health / smoke / remote e2e | **not run** for the same reason; no evidence that the Phase 1 acceptance gate (§4 of `RELEASE_CHECKLIST_PHASE1.md`) was run. |

## 4. Founder items (FOUNDER)

| # | Item | Why |
| --- | --- | --- |
| F1 | Read `docs/ICON_LICENSES.md`; confirm Lucide (ISC) + Feather (MIT) notices and the five BINHI originals are acceptable; decide whether AI-authored simple geometry needs legal sign-off | engineering reading of licences, not legal advice |
| F2 | Look at the icon set (`node --import tsx scripts/icons/contact-sheet.ts out/`) and approve it | brand judgement |
| F3 | Accept the rollback strategy in `docs/ICON_COMPATIBILITY.md` (kill switch first; preflight + backup before any older-build rollback) | defines what rollback means after use |
| F4 | Run the read-only production baseline (below) and send the output | production was not independently verifiable from here |
| F5 | Merge PR #2 | protected action |
| F6 | Publish (staged): set deployment env `BINHI_ICON_LIBRARY=false`, publish, verify, then remove it/set `true` | staged switch-on keeps a no-redeploy rollback |

Production baseline (read-only; run in the deployment shell, prints no secrets):
`npm run db:check` (expect `binhi tables: 16`), and `select table_name from information_schema.tables where table_name like 'binhi_%' order by 1;`
(expect the 12 original tables plus `binhi_projects`, `binhi_library_assets`, `binhi_asset_usages`, `binhi_brand_kits`).
If the four Phase 1 tables are missing in production, **stop**: Phase 1 is running without its schema and needs its own
fix before this release.

## 5. Publish procedure (after F1–F5)

1. Confirm no schema diff is proposed by Replit Publish (this release has no migration; anything listed means stop).
2. Set `BINHI_ICON_LIBRARY=false`, publish, wait for health.
3. `curl https://binhi.replit.app/api/health` → `ok: true`, `env: production`, `iconLibrary: false`.
4. `node scripts/smoke.mjs https://binhi.replit.app` → 7/7; `BINHI_E2E_BASE=https://binhi.replit.app npm run test:e2e:remote` (the
   website journey; with the switch off its icon step is skipped by design — run it again after switch-on).
5. Remove the override (or set `true`), redeploy/restart, re-run step 4: 16 steps including the library icon.
6. Manual pass with a throwaway account in Design Studio: insert an icon, recolour, export PNG and SVG; delete the account.

## 6. Rollback

First choice: `BINHI_ICON_LIBRARY=false` (no code change, nothing lost). If an older build must be deployed:
run `scripts/icons/rollback-preflight.ts` first and keep its backup; see `docs/ICON_COMPATIBILITY.md` for the measured
effects (website icon edits in an older build drop icon settings; designs with icon layers will not open) and the
recovery path. There is no migration to reverse.

## 7. Known limitations (unchanged by this work)

Photo Editor has no layers (icons go in Design Studio); design layer grouping is not implemented; only Chromium was
run; fonts are not embedded in exports; the editor-wide faint-text token is below AA contrast outside the icon surfaces;
design layers remain all-or-nothing for unknown layer types until the Elements 300 prerequisite E1
(`ELEMENTS_300_BACKLOG.md`).
