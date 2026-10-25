# Icon library — compatibility with older builds and rollback

Goal: no document content may be silently discarded or overwritten when an older build meets documents written by
the icon-library build, and no rollback may be performed without knowing exactly what it touches.

## 1. What actually happens (measured, not assumed)

Harness: `scripts/icons/compat-harness/phase1-vs-icon-build.test.ts`. It writes icon content with this branch, then
opens the **same database** with the Phase 1 build (`main` @ `2c766f2`) and records the responses. Run 2026-10-25
against a disposable database; the pre-Phase-1 build (`b6570ff`) predates designs entirely and has the same website
behaviour as the Phase 1 build.

| Older build does… | Result | Data effect |
| --- | --- | --- |
| **Open a design that has icon layers** (list, read) | `200`; the client's strict layer union rejects the document ("This design could not be read"), so no editor opens and nothing is saved | none — content intact |
| Rename that design | `200`; only the name changes, the document still holds the icon layers | none |
| Duplicate it / save it as a template | `400` (the older server cannot validate icon layers) | none — refused |
| Overwrite it with a different document through the API | `200` | only a deliberate API call can do this; the older editor cannot produce it |
| Edit **other** elements of a website that contains library icons | `200`; icon props are preserved (stored in the free-form `props` record) | none |
| Preview/publish a website with library icons | works; the icon renders as the **legacy fallback glyph** from `name` (the camera, not a library icon) — or the default star when no equivalent exists | cosmetic |
| **Edit a library-icon element** (e.g. change its size) | `200`, and **`icon`, `variant`, `strokeWidth` are silently dropped** from that element (its older schema strips unknown keys) | **loss on that element** — recoverable from revision history (below) |
| Restore/read the revision written before that edit | still holds the full icon props | recovery path |

So the real hazards of running an older build against icon content are exactly two: (R1) editing a library-icon
element there strips its icon settings, and (R2) designs with icon layers cannot be opened (not lost).

## 2. Strategy

### Rule 1 — an operational rollback is the kill switch, not an older build
`BINHI_ICON_LIBRARY=false` (deployment secret/env; default on) hides every way to *add or change* a library icon
(left-rail Icons tab, Elements → Icon, the icon picker in Properties, Design Studio's Icon button). Everything already
saved keeps rendering, publishing and saving exactly as before, in both the editors and published sites (covered by an
integration test and the icon browser journey run against a second server with the switch off). It is a redeploy-free
setting, loses nothing and is reversible. **Use it first.** For a staged release, publish with the switch **off**,
verify the deployment, then turn it on.

### Rule 2 — if an older build must be deployed anyway
1. Run the **read-only preflight** and keep its backup:
   `node --import tsx scripts/icons/rollback-preflight.ts --backup /private/place/icon-content-backup.json`
   (needs `BINHI_DATABASE_URL`/`DATABASE_URL`; SELECTs inside a READ ONLY transaction; never overwrites an existing
   file; backup is mode 0600; credentials are never printed). It lists every site/design with icon content and saves
   their full documents. If it reports none, the rollback loses nothing.
2. Treat sites it lists as **do-not-edit** while the older build is live (R1). Designs it lists will not open (R2).
3. After rolling **forward** again, for any listed site that was edited meanwhile, use *History → Restore* on its
   revision from before the rollback (restore is non-destructive: it writes a new revision). Autosave revisions are
   retained for the last 200 saves and every publish snapshot is kept forever, so recovery normally works; the backup
   file covers anything older. Designs need no repair.
4. Do not run `db:migrate`, change schemas or touch data as part of the rollback: this release has no migration.

### Rule 3 — from this release on, builds preserve content they do not understand
- `updateProps` keeps props already stored on an element even if this build's schema does not know them (keys sent in
  the operation itself are still validated away, so clients cannot smuggle data in). So future newer-than-this
  content survives edits in this build. Test: `tests/unit/operations.test.ts`.
- Library icons also store the closest built-in name in the legacy `name` prop (camera → camera, email → mail, …,
  20 true equivalents; others fall back to the default). Older builds therefore show a meaningful glyph instead of
  a star. The library icon always wins in this build. Test: `tests/unit/icons.test.ts`.

### Not done here (backlog, needed before the next new layer type, see `ELEMENTS_300_BACKLOG.md`)
Design layers are a strict union: a layer type this build does not know makes the whole design unreadable (safe, but
all-or-nothing). Before Elements 300 adds layer types, designs need a forward-compatible envelope: unknown layers are
kept verbatim, shown as locked placeholders, and written back unchanged. That requires a coordinated client and
server change to the design document contract and was deliberately not bundled into this release.

## 3. Verification

| Claim | Evidence |
| --- | --- |
| Older-build behaviour in §1 | harness above, results recorded in this file and in the PR |
| Kill switch hides entry points, keeps content | `tests/integration/icons.test.ts` (switch off: edit, publish, render) and `e2e/icons.ts` (second server on `BINHI_ICON_LIBRARY=false`) |
| Preflight is read-only, complete and private | `tests/integration/icon-rollback.test.ts` |
| Unknown props survive edits | `tests/unit/operations.test.ts` |
