# Essential 250 canonical v1.0 — implementation and release review

## Status and authority

This is an **unpublished review increment**, not a completed release or founder artwork approval.
Parent: CHAOS ORIGINS. Platform: ORIGIN. Product: BINHI. Repository: chaosbrewing/binhi.
BINHI Elements 300 is excluded. No ORIGIN/TALA/AGOS/LIYAB/LIPAD repository is modified.

The approved decisions in the implementation request supersede the open questions in `ICON_CATALOG_V1_PLAN.md`.
The plan TSVs remain the frozen names/order/classification inputs. Its category headings supply the canonical
category names. The complete longer engineering directive was not present as a separate workspace document;
this report does not invent additional requirements or organizational approvals.

## Seven-phase evidence mapping

The project's existing seven-phase mapping is provisional, not a claim to know unsupplied official phase names.

| Working phase | Evidence / outcome |
| --- | --- |
| 1. Discover / governance | Gate 0 below; source/task/ancestry inventory before writes |
| 2. Define | Frozen 250 TSV concepts and S/L/C/O assignments; approved decisions recorded here |
| 3. Architect | One canonical catalog plus compatibility resolution; typed ids, alias normalization, bounded safe nodes |
| 4. Design | 105 actual AI-assisted vector artworks; 25 contact sheets and before/after optical proposals; founder review pending |
| 5. Build | Reproducible generator, 250-row collision matrix, per-item manifest, shared browser/search/renderer integration |
| 6. Verify | Typecheck, unit/integration, legacy and canonical browser journeys, pixel output, accessibility and bundle checks |
| 7. Release / learn | Dedicated dependent review PR only; no merge, production SQL or deployment; owner release gates remain open |

## Gate 0 — safe isolation

- Original checkout: `feat/binhi-studio-m1`, `edf1d66`, clean and preserved on `replit/studio-e2e-2026-10-25`.
- Dedicated implementation branch: `feat/binhi-essential-v1-reconciliation`, rooted at verified plan `c4f9b66`.
- That plan includes PR #2 head `c24afbd` and preserved workspace `edf1d66` as ancestors.
- Implementation lives in an ignored separate Git worktree under `.local/worktrees/binhi-icon-v1`.
  The original checkout/branch and its stopped workflow were not changed or restarted.
- No active Agent task was present. Task #8 remains implemented/unmerged. Task #12 remains queued and overlaps
  general Design Studio work; its editor modules, dashboard and task ownership were not modified.
- No reset, rebase, merge, force-push, production database access, secret change or deployment was used.
- Review PR should target the plan branch to isolate this increment from unmerged PR #2; neither PR #2 nor main
  is altered. Founder must decide the eventual merge order.

## Gate 1 — collision / coverage matrix

`ICON_V1_COLLISION_MATRIX.tsv` contains exactly 250 data rows. `ICON_V1_MANIFEST.json` contains each name,
category, permanent id, ICN alias, class, source, basis, provenance, geometry SHA-256 and pending review state.
No placeholder records or missing-geometry fallback are accepted: generation fails if any artwork is absent.
Canonical geometry hashes are all distinct.

Ten plan collisions have explicit decisions. Nine use an alternative pinned Lucide glyph while retaining the
old asset unchanged. ICN-233 keeps the conventional @ glyph under a **new** semantic id; it is not an alias for
legacy Email Input. ICN-004 uses a checked dashed circle so it is not byte-identical to preserved Blur/Vignette.
These semantic/visual choices are proposed for founder review, not asserted as approved art.

## Gate 2 — batches and actual artwork

| Batch | Implemented / verified | Outstanding |
| --- | --- | --- |
| A — identity / compatibility | Exactly 250 canonical entries; 250 unique permanent ICN aliases normalized to persistent ids; all 250 old sources retained; 75 S ids reused only for the same concept | Founder semantic review of the matrix |
| B — Lucide | 70 additional pinned, parsed, allowlisted real glyphs; ISC/Feather notices and lineage verified | Founder visual approval of choices |
| C — compositions | 80 distinct, original multi-part vector compositions with reproducible coordinates and no third-party parts | Founder artwork / AI-assisted authorship clearance |
| D — original drawings | 25 distinct original vector drawings with reproducible coordinates and no third-party parts | Founder artwork / AI-assisted authorship clearance |
| E — optical target | Review-only 20×20 live-area / 1.5px profile and unchanged-2px vs proposed-profile contact sheets | **Not applied to runtime or saved documents**; 133 target flags need optical review |

Rendered class counts: **S 75 / L 70 / C 80 / O 25 = 250**. Canonical licence classes:
124 ISC, 20 ISC AND MIT, 106 original-source (one preserved plus 105 new).
425 total unique ids resolve including compatibility assets; the canonical inventory remains exactly 250.

The C/O geometry is AI-assisted. It is not claimed as human-commissioned artwork, nor as a modified Lucide glyph
where no Lucide parts were used. `LicenseRef-BINHI` records pending rights review; it is not legal clearance.
All 250 entries remain marked `review: pending` until founder sign-off.

### Variants and visual states

Outline, supported duotone/filled, inverted badge and brand colour use the existing safe presentation model.
Filled exceptions are curated, not applied to every glyph. Bold/active treatment can use the same geometry with
stroke 2px; it is not counted as an additional icon.
No extra canonical entry is minted for a purely visual state, and distinct actions keep distinct ids.
The selector/usage model still exposes the default visual state only: explicit eye hidden / toggle off /
unchecked visual-state controls are **not implemented in this increment** and require a bounded UI/schema follow-up.

## Gate 3 — editor / document verification

Existing website and Design Studio modules remain in place; no monolithic canvas or schema migration.
The canonical gallery uses the existing lazy browser, favorites/recents, brand palette and safe renderer.
Search accepts name, keywords and ICN alias. Old assets remain reachable via explicit searches and saved lists,
with a compatibility label; default browsing remains the canonical 250.
Aliases normalize through document validation; geometry/markup is never accepted from a document or upload.

Local evidence:

- `npm run typecheck`: passed client + server.
- `npm test` with **only a disposable test database**: 25 files / 215 tests passed.
- `npm run test:e2e:icons`: 18 checks passed (legacy references, variants, favorites, undo/redo, save/reopen,
  PNG/JPEG pixel checks, SVG vectors, website publishing, auth/isolation, kill switch, phone/tablet).
- `npm run test:e2e:icons:v1`: 8 checks passed, exercising S/L/C/O insertion through ICN search, customization,
  favorites, save/reopen, brand kit, undo/redo, all three exports with per-glyph pixel checks, and anonymous local
  website publishing/unpublishing at phone width.
- `npm run test:e2e:studio`: 19 checks passed, including photos, designs, templates, brand kits and owner isolation.
- `npm run test:e2e`: 16 steps passed, including keyboard-only signup/publishing and two-session conflicts.
- `npm run build`: passed; Vite retains its existing >500KB advisory.
- `npm run check:bundle`: passed with unchanged per-chunk budgets. Main 186.7KB gzip (limit190);
  icon browser12.9KB (limit14); 25 canonical + 25 compatibility lazy geometry chunks, 35.2KB total, each ≤4KB.
- `npm run db:compat`: exit0; existing annotated migration warnings at lines57/86 remain. No migration was changed.

The test PostgreSQL cluster is disposable, loopback port55433, database `binhi_v1_test`. Destructive suites never
targeted the workspace application database or production. Browser-publish tests publish only on disposable
localhost servers, **not Replit Publishing**. Test accounts/data are deleted by the journeys or discarded with
the temporary cluster. Development/production database identities were not re-queried for this feature.

## Gate 4 — security, compatibility and visual QA

- All canonical and preserved nodes pass the runtime SVG geometry allowlist; no script, use/href, external
  SVG resource, arbitrary SVG import, event attributes or executable upload.
- No third-party runtime icon dependency. The pinned npm source tarball is only an authoring input.
- Alias, category, id/meaning, duplicate-geometry, licence, malformed input and owner-boundary tests pass.
- All 250 preserved ids retain exact geometry and supported variants; legacy generated source files are unchanged.
- Existing icon journey: five axe regions, WCAG2.2 A/AA, zero violations; keyboard focus and phone/tablet checks pass.
- Contact sheets: **25** categories; **1,000** nonblank native SVG raster checks at16/20/24/32px.
  No measured default-stroke geometry exceeds the24×24 viewBox. 133 assets exceed the tighter optical target.
- Sampled contact sheets were visually inspected; automated pixel presence is **not** semantic legibility or founder
  approval. Full visual approval remains pending. Firefox/WebKit were not executed here.
- `npm audit`: **9 existing findings — 3 high, 6 moderate**. No lockfile dependency changed. Major upgrades to
  Fastify static/Drizzle/Zod/Router tooling require separate reviewed remediation; security release gate remains open.
- Remote CI result must be read from the review PR; local success is not labeled as remote CI success.

## Review pack and reproduction

```sh
# Only in an isolated worktree with locked dependencies installed:
# Extract pinned lucide-static@1.61.0 under /tmp; never run the legacy generator on the canonical catalog.
node --import tsx scripts/icons/v1-catalog/build.ts /tmp/binhi-v1-lucide/package
PLAYWRIGHT_BROWSERS_PATH=/tmp/binhi-v1-browsers node --import tsx scripts/icons/v1-catalog/review.ts
```

Generated review HTML, PNGs, pixel/bounds evidence and browser screenshots are ignored by both Git and deployment:
`generated-artifacts/icon-v1-review/` and `e2e/screenshots/`. The single-file `all-250-review.html` is self-contained.
The source geometry, manifest, matrix and deterministic tests are committed. Reproduction uses the pinned upstream
license, so no legal notice is silently replaced. There is no recurring icon API cost; authoring/CI uses local CPU,
storage and browser time. No new hosting/storage service is required.

## Founder release blockers / explicit incomplete scope

1. Approve the 250-row semantic matrix and all250 contact-sheet artworks, especially the ten collision choices.
2. Clear AI-assisted authorship/release terms for the105 C/O assets; do not treat the provisional licence label as approval.
3. Decide optical normalization from the before/after pack; do not bulk-rescale preserved saved content.
4. Review dependency audit findings and remote CI; full cross-browser visual QA is not completed.
5. Implement/review explicit visual-state controls if required for v1 release; default states/styles alone are implemented.
6. Resolve PR #2 / plan / reconciliation merge ordering and queued task #12 ownership before wider editor work.
7. Obtain explicit founder approval before any eventual merge, production schema action or publish.

No deployment, production SQL, production secret/environment mutation or live artwork replacement was performed.
