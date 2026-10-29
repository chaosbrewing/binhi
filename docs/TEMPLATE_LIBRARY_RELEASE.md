# Template Library v1.0: release readiness

Branch `claude/binhi-template-library`, based on `origin/main` @ `73e6092` and
merged with `7b260a2`. Nothing here is merged, published or applied to
production. Companion documents: `docs/TEMPLATE_LIBRARY_BASELINE.md` (audit,
gate, decisions) and `docs/TEMPLATE_LIBRARY.md` (how it works).

## 1. Recommendation

| Question | Answer | Why |
|---|---|---|
| Is the feature ready for **review and merge** into `main`? | **YES, after auth (PR #4) is on `main`** | Every acceptance criterion that can be evidenced in a sandbox is evidenced; all journeys pass. |
| Is it ready to be **published** to production? | **NOT YET** | The production database and live HTTP were not verified from this sandbox; the founder must run `npm run db:check` first. This change now adds **one additive migration (`0004`)** that has only ever run on disposable test databases; applying it to production needs a backup and its own founder approval (§7). The unverified baseline from the icon release checklist also still stands. |

Founder answers (2026-10-28 and 2026-10-29) are recorded in §12. Done: D1 (workflow
PDF supplied and audited), D2 (migration `0004` written and tested on disposable
databases), D5 (fonts), art-direction approval, merge order (auth first, and auth
is now merged into `main`), and the workflow v2.1 approvals in §14. Still open: the
Phase 4 approval for the migration work (new since the §14 approval, which covered
`c0de6dd`), and production approval, which has not been requested.

## 2. Acceptance criteria (directive §25)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Canonical taxonomy has 30 categories | met | `tests/unit/template-library.test.ts` (30 categories, frozen ids, 300 subcategories) |
| 2 | Search and filtering work | met | `template-search.test.ts` (15), integration, journey (format, category, style, orientation, colour, editor, URL persistence, empty state) |
| 3 | Previews match actual content | met | thumbnails generated from the real content and fingerprinted (`catalog/lock.ts`, `templates:assets:check`); enlarged previews drawn from the real document / real HTML; journey checks real pixels and the document's true size |
| 4 | Supported templates open in the correct editor | met | journey, all 62 |
| 5 | Creating a template gives an independent, user-owned project | met | integration + journey (new id, owner, revision 0, exact copy) |
| 6 | Editing and saving work | met | journey (autosave, undo/redo) |
| 7 | Projects reopen without loss | met | journey (reload, layer count, edited text) |
| 8 | Shared templates remain unchanged | met | journey and integration compare the template before and after |
| 9 | Brand Kit works on supported types | **met for BINHI templates (designs and websites)**; not available for personal templates | `template-brand.test.ts` (8), integration (5), journey (real-pixel preview, apply, revision 1, restore) |
| 10 | Users create and reuse private templates | **met, with description, category, tags and archive** (migration `0004`) | integration (5 + 6 for details), journey |
| 11 | Dependencies remain resolvable | met | validator requires every dependency to resolve; shipped templates have none outside Website/Design |
| 12 | Unsupported editors are not falsely advertised | met | validator blocks them; API lists only usable templates; UI shows "soon" with the reason; journey asserts zero cards |
| 13 | All released templates are genuinely editable | met | journey per template |
| 14 | Seed target met | **met: 62 of 60** (see §3) | `docs/TEMPLATE_INVENTORY.json` |
| 15 | Ownership and security checks pass | met | §6 |
| 16 | Existing functionality passes regression | met | §4 |
| 17 | CI passes | **met** on head `67364ae` (run 29): both jobs green, the template journey in 6 min 40 s | `.github/workflows/ci.yml`: "Typecheck, test, build, browser journey" and the new parallel "Template library journey (every catalog template)" |
| 18 | Documentation describes actual capabilities | met | `docs/TEMPLATE_LIBRARY*.md`; limits stated |
| 19 | The PR passes review | pending | a draft PR is opened; review is the founder's |
| 20 | Production deployment separately authorised and verified | **not done, out of scope** | |

## 3. Catalog results

* **Categories: 30. Subcategories: 300.** Categories with at least one template
  as primary: 14; reachable as primary or secondary: 25. Empty: 7 Forms, 17
  Video, 22 Health, 24 Email, 26 Merchandise. 7, 17 and 24 have no editor;
  22 and 26 could have had templates and do not.
* **Templates created: 62. Functional: 62. Approved: 62** (the founder approved
  the art direction on 2026-10-28; `docs/TEMPLATE_APPROVALS.json` binds each
  approval to the template's content fingerprint, and changing a template
  withdraws its approval).
  * Website templates: **10** (6 from Phase 1, registered without changing their
    content, and 4 new: Link in bio, Event website, Product launch, Community
    group).
  * Graphics (Design Studio) templates: **52**.
  * Templates requiring unavailable editors: **0** (none can be published).
* By format: 21 print, 19 social, 12 custom, 10 websites. By category as primary:
  social 12, websites 9, posters/flyers 8, logos/brand 6, business essentials 6,
  marketing 6, photography 4, blank/custom 3, portfolios/personal branding 2,
  invitations 2, planners 1, food 1, real estate 1, music/podcasts 1.
* Against the suggested allocation: social 12/12, websites 10/10 (one starter is
  filed under "Blank & Custom"), posters 8/8, logos 6/6, business 6/6, marketing
  6/6, photography 4/4. Portfolios/personal branding has 2 as primary (5 website
  starters also appear under it as secondary) against 4, and blank/custom
  layouts has 3 against 4; five other categories got one or two each instead.
  The total exceeds 60.
* Variety: 11 lead styles, 14 primary categories; a test compares layouts
  (ignoring colour) and fails if any two same-orientation designs are near-identical.

Limits that shape the art, stated plainly: text and shapes only; solid colours;
photo areas are labelled frames, not image slots. Inter, Playfair Display, DM
Sans, Space Grotesk and Lora are self-hosted (D5), Latin scripts only; Georgia
and Monospace are device fonts and differ slightly between devices. Nothing uses icons or Elements 300, so the catalog does not
depend on PR #2/#3 or on assets that do not exist.

## 4. Verification

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `vitest run` (real Postgres) | **30 files, 305 tests pass** (`main` with auth, `0dd7c39`: 23 files, 189) |
| Tests added by this work | 116: taxonomy/schema/lifecycle/approvals 29, search 15, catalog 9, brand 8, adapters 9, security 6, integration 40 (provenance, favorites, personal details, account deletion), migration check 1 |
| `npm run templates:assets:check` | pass (62 templates: content, lock, previews agree) |
| `npm run test:e2e:templates` | **pass: 77 checks, 62 templates** (adds favorites following the account to a new browser, the one-time hand-over of old browser-only favorites, personal details, archive and restore) |
| Previous build against the new schema | **pass:** `main` (`0dd7c39`, without this change) ran its whole suite, 23 files and 189 tests, against a database already migrated to `0004` |
| `npm run db:compat` | `0004` reported "review required (annotated)" for the new table's unique index and foreign key only; no drop, rename, type change or required column |
| `npm run test:e2e` (website journey) | pass, 13 steps |
| `npm run test:e2e:studio` | pass, 21 checks (covers Phase 1 designs, photo, library, brand kits, projects, account isolation and deletion) |
| Build | pass |
| Not run | the icon branch's journeys (not on this branch); anything against production |

The template journey, per template (each group of 12 on its own account): card
thumbnail loads → enlarged preview from the real content → create → correct
editor → edit → autosave → undo/redo → reload → export a native-size PNG, or
publish and read the live page on a phone width → the template unchanged →
another account cannot open the project. Discovery, favorites, keyboard, phone
width, axe-core, Brand Kits and personal templates are checked once.

## 5. Accessibility

axe-core 4.14.0 (new exact-pinned dev dependency) runs on the page at desktop and
phone width, on search results, on an unavailable-format state and on both
preview dialogs. Serious and critical findings fail the run. The audit found
and I fixed two real issues: the "soon" count on unavailable format chips and
the favorited button used insufficient contrast. Also verified: previews open
from the keyboard and focus returns to the card; no horizontal scrolling at 390
px; unavailable formats are explained in text, not colour. **Not covered:**
screen-reader testing by a person, and moderate/minor axe findings, which are
recorded in the run output but do not fail it.

## 6. Security and privacy review

Tests cover: strict records that reject unknown fields and prototype keys;
thumbnails limited to generated files under one path; no markup, scripts or
links in shipped design text; website previews that render with no script or
inline handler and link only to expected `https` hosts; sandboxed, script-free
preview responses; ownership for use, rename, duplicate and delete of personal
templates; other accounts' kits and logos rejected (404, nothing created); a rate
limit on template use (30 per account per 10 minutes). Audit records capture
template id, version and kit for each use. Favorites and recents never leave the
browser.

**Findings:** (1) `ProjectService.create` inserts a project and then checks asset
ownership, so a project referencing a foreign asset is rejected after the row
exists. This predates this work and is reachable only by passing a foreign asset
id directly; the template path never does, because a kit's logo is the owner's.
It is not fixed here. (2) There is no import or community submission, so there is
no untrusted template path to attack; when one is added it must use these strict
contracts.

## 7. Migration, compatibility and conflicts

* **One additive migration, `migrations/0004_binhi_template_library.sql`**
  (founder-approved D2). It adds only nullable columns and one new table, and drops,
  renames or rewrites nothing:
  * `binhi_sites` and `binhi_projects`: `source_template_id`, `source_template_version`
    (provenance, so a project records which template it came from).
  * `binhi_projects`: `description`, `category`, `tags`, `archived_at` (details of a
    personal template, kept outside the document and its revision).
  * New `binhi_template_favorites` (user, template id, time), unique per pair, with a
    cascade on the user and an explicit delete on account deletion.
  `npm run db:compat` reports it as "review required (annotated)" only for the new
  table's unique index and foreign key, which cannot reject data because the table
  starts empty; the migration carries the reasoned review marker. It was generated
  by `drizzle-kit`, applied only to disposable databases by the test suite and the
  browser journeys, and **never applied to production**. Production startup skips
  migrations; Replit Publish applies schema changes, so applying `0004` is a
  separate step that needs a backup and the founder's approval.
* **Old builds:** documents created from templates are ordinary Website and Design
  documents (no new fields), so a previous build opens them unchanged. An old build
  also runs against the new schema: every new column is nullable and unused by it,
  and it never touches the new table. The old `/api/templates` endpoint and the six
  legacy website template ids keep working (`sites.template_id` still stores the
  legacy id).
* **Merge order (founder, 2026-10-29): auth first. Done:** PR #4 (social sign-in)
  was merged into `main` (merge commit `0dd7c39`) on the founder's instruction, with
  its five baseline commits, after one conflict-free-in-code merge of `main` into its
  branch; this branch has since merged `main` (five keep-both conflicts) and
  re-passed every check. What I found before doing it, kept for the record:
  * PR #4's base is `replit/auth-baseline-2026-10-26`, **not `main`**, and its
    branch is 18 commits behind `main` (it forked from the old Phase 1 PR). It
    needs retargeting or updating onto current `main` before it can merge there;
    that is the auth owner's work, not this branch's.
  * It adds migrations `0002` and `0003`. Icons (#2, #3) and PR #14 add none, so
    after auth lands the next migration number is `0004`.
  * A throwaway test merge of PR #4's branch into this one conflicts in five
    files (`src/server/app.ts`, `src/client/dashboard/AccountPage.tsx`,
    `tests/helpers.ts`, `package.json`, `docs/TESTING.md`), all small and
    textual. After auth merges, this branch will merge `main` and resolve them,
    then re-run every check.
  * **Trial of auth on current `main`** (scratch copy, nothing pushed): one
    conflict, `package.json` (two script lines, keep both). The merged result passes
    typecheck, 189 tests, the build, the website journey (15 steps), the studio
    journey (21 checks) and the synthetic auth journey (7 checks). The migrations
    are additive.
  * **What retargeting PR #4 to `main` also brings in:** its base branch carries 5
    commits that are not on `main` (founder and Replit Agent: e2e coverage for the
    signup-to-publish journey, `docs/RELEASE_READINESS.md` and `docs/TESTING.md`
    edits, agent metadata). The PR's own text says it deliberately kept them out
    and requires a founder integration review before any retarget or merge.
  * **Production schema:** merging to `main` does not change the production
    database: production startup skips migrations and Replit Publish applies
    schema changes. PR #4 also lists items still required before enabling it:
    native-crypto verifier security review, provider branding and lifecycle review,
    migration and backup approval, and a separate release authorisation. Providers
    default to disabled.
  * The D2 migration is written on top of `0003` as `0004`, now that auth is on
    `main`.
* **PRs #2 and #3** (icons) change `design.ts`, `DesignEditor.tsx` and
  `renderDesign.ts`; this branch changes none of them, so they should merge
  cleanly, and icons can be added to templates only after #2/#3 land and the
  catalog's `design.icons` feature is enabled.
* Main's CI was red for three pushes before `7b260a2` fixed it; this branch merges
  that commit.

## 8. Performance (in-process, real catalog, 62 templates)

| Call | Payload | p50 | p95 |
|---|---|---|---|
| taxonomy | 14.5 KB | 2.8 ms | 7.4 ms |
| first page, 24 cards | 23.6 KB | 2.4 ms | 3.7 ms |
| 48 cards | 46.1 KB | 2.7 ms | 4.6 ms |
| search "poster" | 12.5 KB | 5.3 ms | 6.6 ms |
| detail / one design document | 1.4 KB / 2.1 KB | 1.7 / 2.1 ms | 2.6 / 3.1 ms |

Thumbnails: 62 JPEGs, 1.37 MB total, 22 KB average, 42 KB largest, lazy-loaded
(about 516 KB for a first page of 24 if all were visible). Client bundle:
`index` 186,797 → 187,773 bytes (+0.5 %; gzip 59,948 → 60,301, +353 B); the
Templates page is a separate lazy chunk of 37.4 KB (11.9 KB gzip). Server-side
paging means list cost does not grow with the document size of templates.
Reproduce with `scripts/templates/measure-performance.ts`. **Not measured:**
real network, low-end phones, a catalog far larger than 62.

## 9. Rollback

Rollback is: redeploy the previous build. Projects created from templates stay
valid ordinary projects. The `/templates` route and the new
`/api/template-library/*` routes disappear with the build; the old
`/api/templates` and `/sites/new` picker are unchanged. Because every `0004`
change is additive and unused by the previous build, **leave the new columns and
table in place**: dropping them would delete provenance, personal-template details
and favorites, and nothing needs them removed. Favorites and personal-template
details stay in the database, unused, until the new build is restored; recents in
browsers become unused data. Reverting this branch's merge commit is sufficient for
the code. Before applying `0004` to production, take a backup (the founder's
checklist), so a restore is possible if anything unexpected appears.

## 10. Not implemented (so nobody assumes it is)

* Server-side recents (they deliberately stay in the browser), public sharing of
  personal templates, paid or premium templates, and popularity or trending (no
  data exists; none is shown).
* A filter for exact dimensions (orientation and size are shown instead) and a
  "Free" filter (everything is free).
* Brand Kit on personal templates; image slots; icons or Elements 300 in templates.
* Photo, Forms, Documents, Presentations, Email and Video templates: contracts and
  tests only; their editors do not exist or do not accept templates.
* Design revision history (designs have only an optimistic revision counter), so
  "restore a previous revision" applies to websites only.
* Template import or community submission.

## 11. Risks and owners

| Risk | Owner | Note |
|---|---|---|
| Georgia / Monospace differ by device | Maintainers | The other five fonts are self-hosted (D5). Layouts keep slack and are measured; the build fails on overflow |
| `Inter` is also the app's interface font, so the whole app now renders in hosted Inter (previously the system fallback on most devices) | Founder | Side effect of D5; all journeys and axe pass; revert by removing the `fonts.css` import in `src/client/main.tsx` |
| Merge order with #2/#3/#4 | Founder | see §7 |
| Production DB state unverified | Founder | `npm run db:check`; no schema change here |
| Journey takes about 15 minutes | Maintainers | its own CI job; `-- --quick` for iteration |
| Project create-then-validate quirk (§6) | Maintainers | pre-existing |

## 12. Decisions

Founder answers, 2026-10-28: **"Yes all"** to the five questions below. What each
yes did, and did not, authorise:

| # | Question | Result |
|---|---|---|
| 1 | D1: provide `chaos_origins_workflow_v2_1.pdf` | **Done 2026-10-29.** PDF supplied, read in full and audited: `docs/TEMPLATE_LIBRARY_BASELINE.md` section 1. Open items it found: Phase 1, 2, 4 and 7 exit approvals are not recorded (decision 6 below), and release notes and a monitoring plan were missing (drafted in section 13). |
| 2 | D2: approve one additive migration (provenance column, personal-template metadata, server-side favorites), authored after PR #4's order is settled | **Done in code, not applied anywhere real.** `0004` written on top of auth, tested on disposable databases, and shown compatible with the previous build (§4, §7). Applying it to production stays a separate approval and needs a backup. |
| 3 | D5: load or self-host the design fonts | **Done.** Self-hosted (§3, §11, `public/fonts/README.md`). Re-measured every template with the real fonts: no overflow. Thumbnails regenerated. All journeys, axe and tests pass. |
| 4 | Merge order: #4 (auth), then #2/#3 (icons), then this branch, or this branch first? | **Answered 2026-10-29: "Merge auth first."** Then authorised in writing to retarget and merge PR #4 and fold in its five baseline commits. Done: merged into `main` as `0dd7c39`. |
| 5 | Approve the 62 templates' art direction | **Recorded.** `docs/TEMPLATE_APPROVALS.json`; inventory shows 62 approved. This is approval of the art direction only. It is not authority to merge or publish. |

Not authorised so far, and not done: merging PR #13 or PR #4, publishing, any
production database change, any change to production secrets or deployment
settings. `npm run db:check` is still required before any publish.

Decision 6 (from the v2.1 audit) was answered "Yes to all" on 2026-10-29: see §14.
## 13. Release notes (draft) and monitoring plan (workflow v2.1 Phase 6)

Not approved, not published. Plain-language draft for when production release is
authorised:

> **Templates.** Browse 62 ready-made templates: 10 website starters and 52
> designs for social posts, posters, flyers, logos, business cards, invitations
> and more. Pick one and it becomes your own project to edit; the original is
> never changed. Add a Brand Kit to see your colours, fonts and logo in the
> template before you start. Save your own designs as personal templates and
> reuse them. Presentations, forms, video, documents and email templates are
> marked "soon": those editors do not exist yet. Designs now use the same fonts on
> every device.

Monitoring after release, using only what exists (no new infrastructure):
* Audit log records `template.used` with template id, version and kit; count
  uses per template per day to see what people actually start.
* The template-use rate limit (30 per account per 10 minutes) returns 429; a rise
  signals scripting or a loop in the client.
* Watch server 5xx on `/api/template-library/*` and 404 on
  `/template-previews/*` and `/fonts/*` (a missing preview or font).
* No client analytics or tracking is added; browsing, favorites and recents stay
  in the browser.

## 14. Workflow v2.1 approvals (founder, 2026-10-29: "Yes to all")

| # | Question | Answer |
|---|---|---|
| 1 | Merge PR #4 (auth) once it is retargeted to `main` | **Yes. The condition was then met by a second written authorisation and PR #4 was merged (`0dd7c39`).** At the time of the first yes it was still based on `replit/auth-baseline-2026-10-26` (checked 2026-10-29) and I did not act. See §7 |
| 2 | Directive counts as the Phase 1 approval (concept) | Yes |
| 3 | Directive counts as the Phase 2 approval (scope) | Yes |
| 4 | Phase 4 requirements are met | Yes, as of head `c0de6dd` |
| 5 | Phase 7 communications (UI copy and docs) | Yes, as of head `c0de6dd` |

Second written authorisation (founder, 2026-10-29: "Yes and yes"): (a) push a
non-force merge of `main` onto PR #4's branch, retarget it to `main`, mark it ready
and merge it; (b) fold its five baseline commits into `main`. Both done (`c8faaf7`,
then `0dd7c39`).

Each approval covers what existed at `c0de6dd`; changed or new material needs its
own approval. Approvals are the founder's words, not tooling output.

**Owed now (new since `c0de6dd`), YES/NO:**
1. Phase 4: approve that the `0004` migration work meets its requirements (§7)?
2. Phase 7: approve the new interface copy (Template details dialog, Archive and
   Restore, "Show archived", favorites hand-over)?
