# Template Library v1.0: release readiness

Branch `claude/binhi-template-library`, based on `origin/main` @ `73e6092` and
merged with `7b260a2`. Nothing here is merged, published or applied to
production. Companion documents: `docs/TEMPLATE_LIBRARY_BASELINE.md` (audit,
gate, decisions) and `docs/TEMPLATE_LIBRARY.md` (how it works).

## 1. Recommendation

| Question | Answer | Why |
|---|---|---|
| Is the feature ready for **review and merge** into `main`? | **YES, after the founder items below** | Every acceptance criterion that can be evidenced in a sandbox is evidenced; all journeys pass. |
| Is it ready to be **published** to production? | **NOT YET** | The production database and live HTTP were not verified from this sandbox; the founder must run `npm run db:check` first. This change adds **no migration**, so the production schema risk is nil, but the unverified baseline from the icon release checklist still stands. |

Founder items before merge: **D1** (workflow PDF), **D5** (design fonts), the
merge **order** relative to PRs #2, #3 and #4 (§7), and a review of the 62
templates' art direction (inventory stage `approved` is left to the founder).

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
| 10 | Users create and reuse private templates | **met, with a name only** | integration (5), journey; description/category/tags/archive need decision D2 |
| 11 | Dependencies remain resolvable | met | validator requires every dependency to resolve; shipped templates have none outside Website/Design |
| 12 | Unsupported editors are not falsely advertised | met | validator blocks them; API lists only usable templates; UI shows "soon" with the reason; journey asserts zero cards |
| 13 | All released templates are genuinely editable | met | journey per template |
| 14 | Seed target met | **met: 62 of 60** (see §3) | `docs/TEMPLATE_INVENTORY.json` |
| 15 | Ownership and security checks pass | met | §6 |
| 16 | Existing functionality passes regression | met | §4 |
| 17 | CI passes | **pending**: runs when the branch is pushed | `.github/workflows/ci.yml` (new parallel `templates` job) |
| 18 | Documentation describes actual capabilities | met | `docs/TEMPLATE_LIBRARY*.md`; limits stated |
| 19 | The PR passes review | pending | a draft PR is opened; review is the founder's |
| 20 | Production deployment separately authorised and verified | **not done, out of scope** | |

## 3. Catalog results

* **Categories: 30. Subcategories: 300.** Categories with at least one template
  as primary: 14; reachable as primary or secondary: 25. Empty: 7 Forms, 17
  Video, 22 Health, 24 Email, 26 Merchandise. 7, 17 and 24 have no editor;
  22 and 26 could have had templates and do not.
* **Templates created: 62. Functional: 62** (all at `export-verified`; none
  `approved`, which is the founder's).
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
photo areas are labelled frames, not image slots; fonts depend on the viewer's
device (decision D5). Nothing uses icons or Elements 300, so the catalog does not
depend on PR #2/#3 or on assets that do not exist.

## 4. Verification

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `vitest run` (real Postgres) | **28 files, 252 tests pass** (`main` @ `73e6092`: 21 files, 149; the Stage 2 merge added 2 more) |
| Tests added by this work | 101: taxonomy/schema/lifecycle 28, search 15, catalog 8, brand 8, adapters 9, security 6, integration 27 |
| `npm run templates:assets:check` | pass (62 templates: content, lock, previews agree) |
| `npm run test:e2e:templates` | **pass: 75 checks, 62 templates** |
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

* **No migration, no schema change, no change to existing tables.**
  `git diff origin/main -- migrations src/server/db` is empty. Provenance is in
  the audit log; favorites and recents are browser-local. A future migration is
  decision D2.
* **Old builds:** documents created from templates are ordinary Website and Design
  documents (no new fields), so a previous build opens them unchanged. The old
  `/api/templates` endpoint and the six legacy website template ids keep working
  (`sites.template_id` still stores the legacy id).
* **PR #4 (social auth)** adds migrations `0002` and `0003`. This branch does
  not, so it cannot collide, but a later template migration would need renumbering
  after #4. **PRs #2 and #3** change `design.ts`, `DesignEditor.tsx` and
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

Because there is no migration and no schema change, rollback is: redeploy the
previous build. Projects created from templates stay valid ordinary projects.
The `/templates` route and the new `/api/template-library/*` routes disappear
with the build; the old `/api/templates` and `/sites/new` picker are unchanged.
Favorites and recents in browsers become unused data. Reverting the merge commit
is sufficient; there is nothing to restore in the database.

## 10. Not implemented (so nobody assumes it is)

* Server-side favorites/recents, personal template description, category, tags,
  archive state, public sharing, paid or premium templates, and popularity or
  trending (no data exists; none is shown).
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
| Fonts differ by device (D5) | Founder | Layouts have slack and are measured; previews use fallback fonts for designs |
| Merge order with #2/#3/#4 | Founder | see §7 |
| Production DB state unverified | Founder | `npm run db:check`; no schema change here |
| Art direction of 62 templates | Founder | inventory `approved` is empty by design |
| Journey takes about 15 minutes | Maintainers | its own CI job; `-- --quick` for iteration |
| Project create-then-validate quirk (§6) | Maintainers | pre-existing |

## 12. Decisions required (YES/NO)

1. **D1:** provide `chaos_origins_workflow_v2_1.pdf`?
2. **D2:** approve one additive migration (provenance column, personal-template
   metadata, server-side favorites), authored after PR #4's order is settled?
3. **D5:** load or self-host the design fonts so designs look the same on every device?
4. Merge order: #4 (auth), then #2/#3 (icons), then this branch, or this branch first?
5. Approve the 62 templates' art direction for release (sets inventory `approved`)?
