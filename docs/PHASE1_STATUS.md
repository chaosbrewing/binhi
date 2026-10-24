# BINHI Phase 1 — Core Creative Studio: status and gap assessment

Date: 2026-10-24 · Branch: `claude/binhi-visual-editor-12arge` · Baseline: `main` @ b6570ff

Statuses: **Not Started · In Progress · Ready for Review · Blocked · Verified Complete**.
"Verified" means a command or browser journey listed under *Evidence* passed in
this branch; nothing here is inferred from earlier reports. Nothing in this
branch has been published; https://binhi.replit.app still runs the earlier
build.

## 0. Reconciliation of concurrent work

The Replit workspace (`binhi`, published at https://binhi.replit.app) carried
an unpushed "studio milestone 1" written by a Replit Agent session: a studio
home, a browser-side photo editor / image compressor, coming-soon screens for
design, conversion and forms, a destructive-test database guard, Replit
run-workflow and secrets mapping, a Vite 8 / Vitest 5 toolchain upgrade and
the accompanying tests and docs (`docs/CREATIVE_STUDIO.md`, `replit.md`).
GitHub `main` had none of it.

That work was imported file-by-file into this branch (commit "Import Replit
workspace studio milestone 1") rather than overwritten; every remaining
workspace file was compared and found identical. Two defects it fixed were
confirmed by failing tests before the fix was applied here:

- the shared API client spread `init` after `headers`, dropping the CSRF
  header on uploads (`tests/unit/api-upload.test.ts`);
- the built client was only served with `NODE_ENV=production`, so the Replit
  workspace could not serve the editor without production mode
  (`BINHI_SERVE_BUILT_CLIENT`).

Two deliberate departures from the imported work, both documented in
`docs/CREATIVE_STUDIO.md` §8: browser-local IndexedDB photo drafts were
replaced by account projects (the directive requires save/reopen and
server-side permissions), and `.env.example` was kept because the README
refers to it. After the import, the Replit Agent reported (read-only) a clean working
tree on its local branch `feat/binhi-studio-m1` at commit 5bf6148: ten
commits that were never pushed to GitHub, no task in progress, and further
tasks (#6–#14) queued or proposed in its own registry. GitHub `main` in turn
holds two documentation commits the workspace never fetched. The file-level
import above captured that branch's tree; its commit history stays only in
the workspace until the owner reconciles it (see *Open items*).

## 1. Gap assessment against the Phase 1 directive

| Capability | Before this branch | Status now | Evidence |
| --- | --- | --- | --- |
| Website Builder (protected baseline) | Complete | **Verified Complete** | 13-step website journey re-run; 97 → 116 tests all green |
| Unified Creative Dashboard | 6 destinations, no projects/templates/kits/library | **Verified Complete** | Studio journey step 1: ten destinations, 8 available / 2 planned, recent work strip |
| My Projects | — | **Verified Complete** | Studio journey: websites + photos + designs + templates merged, filter tabs, delete |
| Photo Editor (non-destructive, save/reopen/export) | Browser-only drafts | **Verified Complete** | Save uploads the original once (private), reload reopens the recipe from the server, re-save does not re-upload; exports verified from bytes |
| Image Compressor (JPEG/PNG/WebP, real sizes) | Working | **Verified Complete** | Studio journey: 382 754 → 79 059 bytes with honest "% smaller" copy |
| Design Studio (fixed-size, own validated model, PNG/JPEG export) | Coming-soon only | **Verified Complete** | Text + rectangle + library image, autosave with revisions, drag + undo, verified 1080×1080 PNG/JPEG (blue pixel check) |
| Template Creator (editable templates) | — | **Verified Complete** | "Save as template" → Templates page → "Use template" starts a new design with the same layers; template itself stays editable |
| Universal Brand Kit | — | **Verified Complete** | Kit with library logo; applied to a website theme as a new revision (`theme.colors.primary`, heading font asserted) and to a design layer |
| Smart Asset Library (shared, ownership-checked, usage tracking) | Site-scoped public media only | **Verified Complete** | Private bytes 401/404 for others, usage listed per project, delete blocked while in use (409) unless forced, copy-to-site explicit |
| File Converter | Planned destination | **Verified Complete as planned** (must stay planned) | Journey asserts "Planned, not available yet" |
| Form Builder | Planned destination | **Verified Complete as planned** (must stay planned) | Journey asserts "Planned, not available yet" |
| Unified projects + per-type documents | — | **Verified Complete** | `binhi_projects` + `src/core/creative/*`; kind-mismatch and foreign-asset documents rejected (integration tests) |
| Media-processing safety | Client checks only | **Verified Complete** | Server library upload: magic bytes, header dimensions ≤ 8192 px / 16 MP before decode, animated PNG/WebP and SVG/GIF refused, 8 MiB cap, originals preserved; exports carry no EXIF |
| Server-side permissions | Sites only | **Verified Complete** | Every project/library/kit route is owner-scoped (404 for strangers); account deletion removes all of it |
| ORIGIN boundaries | Intact | **Verified Complete (unchanged)** | No ORIGIN code, credentials or database reachable |
| Production deployment of Phase 1 | — | **Blocked (owner action)** | Publishing and the production schema diff are owner-gated by policy |

## 2. Evidence (this branch, local container, disposable `binhi_test` database)

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed (client + server) |
| `npm test` | 16 files, 116 tests passed (unit + Postgres integration) |
| `npm run build` | passed (Vite 8.3.5) |
| `npm run test:e2e` | 13/13 website-builder steps passed |
| `npm run test:e2e:studio` | 19/19 studio checks passed (dashboard, photo, library, design, templates, brand kits, isolation) |

Screenshots: `e2e/screenshots/studio/01-home.png`, `03-photo-desktop.png`,
`02-photo-mobile.png`, `04-library.png`, `05-design.png` (CI artifact).

## 3. Not done / limits (honest)

- Design text is rendered with the fonts the browser has loaded; Google
  fonts are not embedded in exports. The UI says so next to the export.
- Design rotation is numeric (properties panel), not a drag handle.
- Image Compressor has no batch mode; one image at a time.
- No per-project revision history for photos and designs (websites keep
  theirs); concurrency is handled by 409 + reload.
- Website starter templates remain code constants; only design templates are
  user-editable.
- Remote journey against https://binhi.replit.app was not run (host blocked
  from this sandbox; see RELEASE_READINESS.md).

## 4. Open items (owner)

1. Reconcile the Replit workspace with this branch before any further Replit
   Agent session: in the workspace, fetch `claude/binhi-visual-editor-12arge`
   and check it out (or merge it to `main` on GitHub first and pull). The
   workspace's queued tasks #6–#14 should be reviewed against this branch
   rather than run on the old `feat/binhi-studio-m1` tree; two diverging
   copies cannot both be canonical.
2. Review and merge the branch; CI runs both browser journeys.
3. Publish from Replit when ready. The Publish schema diff will add the four
   Phase 1 tables (additive). Nothing was published automatically.
