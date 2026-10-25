# Icon library — release checklist (gate for founder approval)

Scope: branch `claude/binhi-icon-library` → `main` → Replit Publish of the existing Autoscale deployment.
**Nothing here has been merged or published.** Steps marked **FOUNDER** change `main`, production or spend money.

## 0. What is and is not affected

| Item | Status |
| --- | --- |
| Database schema / migrations | **None.** No Replit Publish schema diff is expected; if the diff shows anything, stop. |
| Environment variables / secrets | none added or changed |
| ORIGIN / TALA / AGOS / LIYAB repositories, data, credentials | untouched; no cross-product dependency introduced |
| Phase 1 production release | independent. Phase 1 is merged to `main` but still awaits its own founder steps (`RELEASE_CHECKLIST_PHASE1.md`). This branch is based on that merge commit (`2c766f2`); releasing it ships Phase 1 and the icon library together, so Phase 1's backup/diff/publish steps still apply. |

## 1. Evidence required before approval (engineer — done on the branch head)

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm test` (unit + Postgres integration) | 184 tests passed (126 before the icon work) |
| `npm run build` | passed |
| `npm run test:e2e` (website journey, now with an icon step) | 14/14 |
| `npm run test:e2e:studio` (Phase 1 regression) | 19/19 |
| `npm run test:e2e:icons` | 16/16 |
| GitHub CI on the pull request | see the PR (recorded in the final report) |

## 2. Review items for the founder (FOUNDER)

| # | Item | Why it needs a person |
| --- | --- | --- |
| 2.1 | Read `docs/ICON_LICENSES.md` and confirm Lucide (ISC, with Feather MIT notices) plus the five BINHI originals are acceptable for commercial distribution | engineering reading of the licence, not legal advice |
| 2.2 | Look at the icons (contact sheets: `node --import tsx scripts/icons/contact-sheet.ts out/`, or the CI screenshots) and approve the visual set | brand judgement |
| 2.3 | Decide on the rollback caveat (below) | affects what rolling back means after people use icons |
| 2.4 | Merge the pull request | protected action |

## 3. Rollback caveat (read before publishing)

There is no data migration, so redeploying the previous build is always possible. After people have started using
icons, the previous build:

- cannot open a **design** that contains an icon layer (it shows "This design could not be read"; the data is intact
  and returns when the new build is redeployed);
- shows a library icon on a **website** as the default star, and would drop the icon id if that element were edited
  and saved from the older build.

Recommended mitigation: publish the icon library and avoid rolling back after real use; if a rollback is needed,
roll forward with a fix instead. Websites already published are static snapshots and are unaffected.

## 4. Post-publish verification (engineer, after the founder publishes)

| Step | Pass condition |
| --- | --- |
| `curl https://binhi.replit.app/api/health` | `ok: true`, `env: production` |
| `node scripts/smoke.mjs https://binhi.replit.app` | 7/7 |
| `BINHI_E2E_BASE=https://binhi.replit.app npm run test:e2e:remote` | 14 steps including "inserted a library icon" and the live site showing it (creates and deletes its own account) |
| Manual, throwaway account: Design Studio → Icon → insert, recolour, export PNG and SVG; delete the account | exports contain the icon |
