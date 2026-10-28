# Template Library v1.0 — M0 baseline, governance record and decisions

Status: M0 complete. Written 2026-10-28 on branch `claude/binhi-template-library`,
created from `origin/main` @ `73e6092`. Nothing here is published, merged or
applied to production.

## 1. Governing workflow — limitation (must be resolved by the founder)

The directive names `chaos_origins_workflow_v2_1.pdf`. It is **not** in this
repository and was not found anywhere on the build machine (full filesystem
search). `docs/CREATIVE_STUDIO.md` already records that no canonical seven-phase
specification was ever found. This record therefore does **not** claim
conformance to workflow v2.1. It applies the Four-Question Gate exactly as
written in the directive and the seven-phase mapping in `docs/CREATIVE_STUDIO.md`
(discover, define, architect, design, build, verify, release) as an explicit
working mapping. **Decision D1 asks for the authoritative PDF.**

## 2. Four-Question Gate (recorded before implementation)

| # | Question | Answer (from the directive, checked against the repository) |
|---|---|---|
| Q1 | What chaos does this organize? | Template discovery, customization, asset reuse and output are split across other sites and file downloads. Today BINHI has 6 hard-coded website starters and a bare list of the owner's own design templates (`/templates`), with no search, formats, previews or provenance. |
| Q2 | What meaning does it create? | A real starting point that becomes a finished, exportable or publishable creation. |
| Q3 | Who is it for? | Independent creators, freelancers, small businesses, artists and designers, founders, educators, community organizations, everyday users. |
| Q4 | Why should people care? | Templates are real editable projects, reuse the Brand Kit and Asset Library, and stay inside one ORIGIN-connected workspace. |

Validation against the product charter (`docs/PRODUCT.md`): the charter's
Templates row ("start from a credible layout", "every template renders
responsively with replaced content") is consistent; it only covers website
templates, so the Design Studio, personal-template and discovery scope is a
charter extension. **Founder approval recorded:** the overall vision, per the
directive (section 27). **Not assumed approved:** any implementation detail,
migration, merge or release; those go through the decisions in section 8.

## 3. Verified repository baseline

| Item | Evidence |
|---|---|
| Base | `origin/main` @ `73e6092` (2026-10-28, Cursor Agent: studio homepage). Feature branch `claude/binhi-template-library` created from it; no history rewritten. |
| Typecheck | `npm run typecheck` exit 0 (client + server). |
| Main's CI history (correction) | The first version of this report said main was green. That was only true of the local unit and integration run. GitHub CI on `main` was **red for three consecutive pushes** (runs 23, 24, 25: `d5a7dcf`, `793cd97`, `73e6092`) because the studio browser journey still expected a heading the Cursor homepage redesign had removed. Commit `7b260a2` ("Stage 2 navigation foundation", landed while this work was in progress) updated that journey and run 27 is green. This branch merges `7b260a2`. |
| Tests | `vitest run`: 21 files, 149 tests, all pass against a disposable local PostgreSQL 16 (`binhi_test`). The suite refuses non-test databases (`tests/test-database.ts`). |
| CI definition | `.github/workflows/ci.yml`: typecheck, `npm test` on Postgres 16, build, Playwright journeys `test:e2e` and `test:e2e:studio`. |
| Not run in baseline | Browser journeys (run per milestone when UI changes); production. |

### Pull requests and branches (GitHub, live)

| PR | State | Relevance to this feature |
|---|---|---|
| #1 Phase 1 studio | merged to main | Source of the current templates, design, brand kit and library code. |
| #5–#11 Cursor studio work | closed, **commits merged directly into main** | Projects/Library search, view state, accessibility, lazy routes, new studio homepage. Main moved 16 commits past the icon branches. |
| #2 Essential 250 icons | **open, not mergeable by me** | Adds the `icon` design layer and website `icon` component. Not on main. |
| #3 Essential 250 v1 reconciliation (draft) | open, base is the catalog-plan branch | Rewrites `design.ts`, `DesignEditor.tsx`, `renderDesign.ts`. |
| #4 Social auth (draft) | open, base `replit/auth-baseline-2026-10-26` | **Adds migrations `0002` and `0003`** and edits `src/server/db/schema.ts`. |

Consequences: (a) icons are not a template dependency until #2/#3 land;
(b) any migration I add collides in number with #4; (c) edits to the design
document schema collide with #2/#3 in `design.ts`.

### Replit workspace and tasks

Read-only questions to the Replit app `binhi` (replId `1449194b-…`):
branch `feat/binhi-studio-m1` @ `7f89a6f`, working tree **clean**, no Agent task
running or merging. The workspace is behind GitHub main (it does not have the
Cursor commits), and has no template-library work. A published deployment
exists (`https://binhi.replit.app`, status `success`); its database was not
queried and production was not touched.

### Database separation

Verified in code: `src/server/config.ts` takes `DATABASE_URL` from the host
(different values in Replit development and production), production startup
skips DDL and Replit Publish applies schema changes
(`docs/CREATIVE_STUDIO.md` §1, audit-time identities `heliumdb` dev and
`neondb` prod, 11 tables each at the time). Tests refuse the app/production
database. **Not verifiable from this sandbox:** the live production schema.
The current migration chain is `0000`, `0001`; production state after
Phase 1 must be confirmed with `npm run db:check` by the founder before any
publish (carried over from the icon release checklist).

## 4. What exists today (audit)

* **Website templates** (`src/core/templates/index.ts`): 6 code-defined
  `TemplateDefinition`s (`blank`, `portfolio`, `studio`, `freelancer`,
  `business`, `landing`), each a builder producing a valid `SiteDocument`
  (pages, navigation, sections, forms, theme tokens, SEO). Referenced by
  `binhi_sites.template_id`; no discovery metadata, no preview image, no
  versioning, no provenance beyond the id.
* **Design templates**: a project of kind `design-template` in
  `binhi_projects` (private, owner-scoped). "Save as template" and "Use
  template" (server `duplicate`) already work. There are no shipped
  (system) design templates and no previews.
* **Design document** (`src/core/creative/design.ts`, schema v1, `.strict()`):
  layers `text`, `rect`, `ellipse`, `image`; solid colours only (no gradients);
  9 fonts; max 200 layers; 64–4096 px edges, 16 MP. Presets: 11 formats.
  Image layers **require an owned library asset id**, so a shipped template
  cannot contain an image slot today.
* **Revision model for creative projects**: `binhi_projects.revision` is an
  optimistic-concurrency counter only. Unlike websites (`binhi_site_revisions`)
  there is **no stored revision history** for design/photo projects, and undo/redo
  is client session state. The directive's "own revision history" and
  "restore previous revision" therefore apply fully to websites and only as
  "revision 0 + optimistic revisions" to designs.
* **Brand Kits** (`brandKit.ts`): colours (≤12), heading/body fonts, logo asset
  id, tagline. Websites: `brandKitToThemePatch` through the `updateTheme`
  operation. Designs: applied from the editor panel.
* **Asset Library**: private, 500 files and 300 MB per owner, 8 MB upload cap,
  usage tracking in `binhi_asset_usages`. Website media is separate and public.
* **Photo projects**: original asset + non-destructive recipe.
* **Forms**: only the website `form` component with submissions. The standalone
  Form Builder is "planned" in `destinations.tsx`.
* **Documents, presentations, video, motion**: no editor, renderer or export.
  The `presentation` design preset is just a 1920×1080 canvas.
* **Navigation** (`destinations.tsx`, `App.tsx`): Home, My Projects, Templates,
  Website Builder, Design Studio, Photo Editor, Asset Library, Brand Kits exist
  already; `/templates` is a plain page.

## 5. Capability matrix (what a template may truthfully claim in v1.0)

| Editor | Available on main | Template support in v1.0 |
|---|---|---|
| Website Builder | yes | Yes: full `SiteDocument`. Commerce only if a commerce capability exists: it does not, so no shop templates. |
| Design Studio | yes (text, shapes, images) | Yes, built only from text, rectangles and ellipses. No icons (PR #2/#3), no gradients, no lines or paths, no groups. |
| Photo Editor | yes | Only recipe-based presets. Frames/overlays/collages are not supported, so no collage claims. |
| Form Builder | no | Contracts only (M6). Website forms may appear inside website templates. |
| Documents / Presentations / Video / Email sending | no | Contracts only; marked unavailable. Cannot be public (directive section 9 rule). |

Of the 30 categories, the ones that can hold usable v1.0 templates are those
whose output is a fixed-size graphic or a website: 01 Social, 02 Websites,
03 Logos, 04 Posters, 08 Marketing, 09 Invitations, 10 Business essentials,
11 Food menus, 18 Photography layouts (as graphic frames), 23 Nonprofits,
27 Seasonal, 28 Portfolios, 29 Music covers, 30 Blank. The rest stay in the
taxonomy with zero public templates.

## 6. Design implications that need a decision

* **Image placeholders.** Without an image slot, templates would ship coloured
  frames (rectangles labelled "Your photo here"). A true slot means a design
  schema change (v2) in the same file PRs #2/#3 rewrite. Recommendation: ship
  v1.0 with labelled frame shapes and add slots after #2/#3 merge.
* **Provenance and personalization storage.** Recording the originating
  template id/version, favorites and recent templates needs somewhere to live.
  Options: (1) additive nullable column `binhi_projects.template_ref` plus two
  small tables, one migration; (2) browser-local favorites/recents and an audit
  log entry for provenance, no migration. Option 1 is safer for users (works
  across devices, queryable), but its migration number collides with PR #4.
* **Visual variety under the primitive limit.** Nine fonts and flat shapes can
  still give varied, intentional layouts; every template needs a per-template
  review, and near-duplicate recolors will be rejected by an automated
  similarity check in the inventory tests.

## 7. Risk register

| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Migration number collision with PR #4 | Broken migration chain at merge | Keep M1–M2 migration-free; regenerate our migration after #4's order is decided | Founder (D2) |
| Design schema collisions with PR #2/#3 | Merge conflicts, broken icon dependency | No design-schema change in v1.0 without D3; no icon dependency | Founder (D3) |
| Workflow PDF missing | Governance gaps | Working mapping, request the PDF | Founder (D1) |
| Replit workspace behind main | Stale deploy base | Sync only after approved merge | Founder |
| Production schema unverified | Unknown prod state | Founder runs `npm run db:check` before any publish | Founder |
| Seed target of 60 | Padding or broken templates | Count only templates passing the editor journey; report any shortfall for approval | Claude/Founder |

## 8. Decisions required (YES/NO)

* **D1.** Provide `chaos_origins_workflow_v2_1.pdf` (or its verified repo path)? Until then the working mapping is used. *Still open.*
* **D2.** Approve one additive migration (a nullable `template_ref` column on `binhi_projects` for provenance, a small metadata column for personal templates, and server-side favorites/recents tables), authored after the order of PR #4 versus this work is decided? Default while open: no migration; provenance lives in the audit log, favorites/recents stay in the browser, personal templates have a name only. *Still open; nothing was blocked by it.*
* **D3.** Keep v1.0 free of any design-schema change and of icon dependencies, with image placeholders as labelled frames? **Applied as the default** (recommended YES); no design-schema change was made.
* **D4.** Accept that the first release lists templates only for Websites and Design Studio output, with Photo, Forms, Documents, Presentations, Email and Video as documented contracts only? **Applied as the default** (recommended YES).
* **D5 (new).** The Design Studio never loads the web fonts its font list names, so design text falls back to system fonts on most devices (published websites do load Google Fonts). Approve loading the design fonts in the Design Studio (the app's CSP already allows `fonts.googleapis.com`), or self-hosting the OFL font files? Until then templates are authored to survive fallback fonts and avoid `Inter`.
  **Resolved:** the founder answered yes (2026-10-28). Implemented as self-hosting (no third-party requests, no CSP change): see `public/fonts/README.md`.

## 9. Milestone register

| Milestone | State | Evidence |
|---|---|---|
| M0 Baseline and governance | done | this document; branch from verified `main` |
| M1 Taxonomy and schema | done | `tests/unit/template-library.test.ts` |
| M2 Discovery | done | `tests/unit/template-search.test.ts`, `tests/integration/template-library.test.ts`, `e2e/templates.ts` |
| M3 Instantiation | done | integration + journey (ownership, independence, provenance in the audit log) |
| M4 Seed catalog | done, see the release report for counts | `docs/TEMPLATE_INVENTORY.json` written by the journey |
| M5 Brand Kits and personal templates | done within the no-migration limit | `tests/unit/template-brand.test.ts`, integration, journey |
| M6 Cross-editor contracts | done (contracts and tests, all unavailable) | `tests/unit/template-adapters.test.ts` |
| M7 Quality and release preparation | see `docs/TEMPLATE_LIBRARY_RELEASE.md` | |
