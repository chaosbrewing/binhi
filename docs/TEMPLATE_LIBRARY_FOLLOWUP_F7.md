# Template Library follow-up F7: Archive clarity and friendly validation messages

Status: **COMPLETED to `main`, NOT RELEASED.** Implementation was authorised by the
founder on 2026-11-02 (D-BINHI-TPL-F7-015); the final wording in §8 was approved on
2026-11-03 (D-BINHI-TPL-P7-017); PR #15 was merged at its exact head `b04b202` on
2026-11-03 (D-BINHI-TPL-MERGE-018, merge commit `1dee170`). Register:
`docs/TEMPLATE_LIBRARY_RELEASE.md` §14. Production migration `0004`, Replit Publish,
deployment and production configuration remain separately gated and unexecuted.

## 0. Four-Question Gate (recorded before implementation, 2026-11-02)

| Question | Answer |
|---|---|
| What chaos does this organise? | People were not told what archiving a template does, and a tag that broke a rule produced a developer message (`tags.0: String must contain at most 30 character(s)`) in a toast after the dialog closed. |
| What meaning does it create? | Predictable template management (archive is hidden, not deleted, and reversible) and feedback a person can act on without leaving their input. |
| Who is it for? | BINHI creators organising their saved templates and editing their details. |
| Why should they care? | They can archive and restore with confidence and fix an invalid tag in place, in plain words. |

No feature is added; validation rules, limits, permissions, schema and production
behaviour are unchanged.

Findings being addressed (from the pre-merge review, release report §16):

| Finding | Problem today (verified by reading and running the code at `50daec1`) |
|---|---|
| F7-1 | Nothing in the interface says what Archive does. A person sees "Archive", an "Archived" badge, "Show archived (n)" and "Restore", but is never told the template is hidden, not deleted. |
| F7-2 | Three reachable errors show developer wording: `tags.0: String must contain at most 30 character(s)`, `tags: Array must contain at most 8 element(s)`, `tags.0: Tags need at least one letter or number`. They appear as an error toast, not in the dialog. |
| F7-3 (optional) | The delete dialog title uses straight quotes (`Delete template "X"?`); every other message uses curly quotes. |

## 1. Scope

In scope: interface copy, how validation errors are shown, and the tests that prove
both. Out of scope, and must not change: the validation rules and limits
(`PERSONAL_LIMITS` in `src/core/templates/library/personal.ts`), migration `0004`,
template details data, favorites, archive state, the approved words "Archive",
"Restore", "Show archived", "Template details", "Save details", the accessibility
labels (`Archive template X`, `Restore template X`, `Details for template X`), and
the server's global error handler in `src/server/app.ts` (other screens and tests
rely on its `path: message` format).

Server-side validation stays authoritative: every message below is produced by the
shared schema that the server enforces, and the browser only displays it.

## 2. F7-1: say what Archive does

Three small additions in `src/client/templates/PersonalTemplates.tsx`. The
existing labels are unchanged.

| Where | Proposed wording |
|---|---|
| Toast after archiving (replaces `“X” archived`) | `“X” archived. It is hidden from your list, not deleted. Use “Show archived” to find it.` |
| Toast after restoring (unchanged) | `“X” restored` |
| Help line shown next to the "Show archived" checkbox, only when at least one template is archived | `Archived templates are hidden, not deleted. Restore one to bring it back.` |
| `title` on the Archive button (hover and assistive-technology description) | `Hide from your list without deleting` |

Why not a confirmation dialog: archiving loses nothing and is reversed with one
click, so a dialog would add friction without protecting anything. Delete keeps its
confirmation because it cannot be undone.

The founder's proposed text ("Archiving hides this template from your active list.
You can restore it anytime.") is carried in substance; the lines above are shorter
because they sit beside a control, and they reuse the approved words so the
explanation and the controls match.

## 3. F7-2: friendly validation messages

### 3.1 Messages come from the shared schema, with the real limits

In `src/core/templates/library/personal.ts`, give every rule a human message. The
numbers are interpolated from `PERSONAL_LIMITS`, so a limit can never disagree with
its message.

| Rule (unchanged) | Message today | Proposed message |
|---|---|---|
| tag longer than `tagLength` (30) | `String must contain at most 30 character(s)` | `Each tag must be 30 characters or fewer` |
| more than `tags` (8) tags | `Array must contain at most 8 element(s)` | `You can add up to 8 tags` |
| tag empty after trimming | `String must contain at least 1 character(s)` | `Remove the empty tag` |
| tag with no letter or number (for example `!!!`) | `Tags need at least one letter or number` | unchanged |
| tag with a control character | `Tags cannot contain control characters` | unchanged |
| description longer than `description` (280) | `String must contain at most 280 character(s)` | `The description must be 280 characters or fewer` |
| description with a line break | `The description cannot contain line breaks` | unchanged |
| unknown category | `Choose a category from the list` | unchanged |

The founder's proposed "You can add up to the allowed number of tags" is
implemented with the actual number ("up to 8 tags"), because the number is what
the person needs; it comes from `PERSONAL_LIMITS.tags`, not a second copy. The
founder's "Enter a valid tag or remove the empty one" is split into the two cases
the schema already distinguishes (empty; no letter or number), each with one clear
instruction.

### 3.2 The dialog shows the message, in place, without the field path

The server already returns the individual issues in `error.details` (first ten
issues, each with `path` and `message`; see the `ZodError` branch in
`src/server/app.ts`), and `ApiError` already carries `details` to the browser.
In `PersonalTemplates.tsx`, `saveDetails` will:

1. read `details[0].message` when `details` is a non-empty array of issues, and
   fall back to `e.message` otherwise (offline, 404, 429, unknown errors keep their
   existing text);
2. show that text inside the Template details dialog, directly under the fields,
   in an element with `role="alert"`, and keep the dialog open with the person's
   input intact;
3. not raise the error toast for validation errors (the toast stays for every other
   failure).

So the person sees `Each tag must be 30 characters or fewer` under the Tags field
and can fix it; today the dialog closes to a toast reading `tags.0: String must
contain at most 30 character(s)`.

Optional (same strings, same source of truth, no new rule): before sending, the
browser may check tag count and length against `PERSONAL_LIMITS` and show the same
message without a round trip. If implemented, the server check still runs and the
test in §5.2 must prove the server message is identical.

## 4. F7-3 (optional): curly quotes in the delete dialog title

`Delete template "X"?` becomes `Delete template “X”?`. One character change in
`PersonalTemplates.tsx`. Include only if the founder says yes.

## 5. Acceptance tests (all must be added; all must pass)

### 5.1 Unit: `tests/unit/template-library.test.ts` (or a new `template-personal.test.ts`)

* `PersonalMetaPatch.safeParse` returns, for each row in §3.1, exactly the proposed
  message (first issue), and the limits in the messages equal `PERSONAL_LIMITS`.
* Valid input still passes unchanged (tags slugified and de-duplicated).

### 5.2 Integration: `tests/integration/template-library.test.ts`

* `PATCH /api/template-library/mine/:id` with a 31-character tag → 400,
  `error.details[0].message === "Each tag must be 30 characters or fewer"`, and
  `error.message` still has the `tags.0: ` prefix (the global handler is untouched).
* Nine tags → 400, `You can add up to 8 tags`. An empty tag → `Remove the empty tag`.
* One existing assertion on another route's `path: message` format is kept, to
  prove nothing else changed.

### 5.3 Browser journey: `e2e/templates.ts`

* In the Template details dialog, enter a 31-character tag and click Save details:
  the dialog stays open, an element with `role="alert"` inside the dialog reads
  `Each tag must be 30 characters or fewer`, no toast containing `tags.0` appears,
  the other fields keep their values. Fix the tag; Save details succeeds.
* Archive a template: the toast reads `“X” archived. It is hidden from your list,
  not deleted. Use “Show archived” to find it.`; the help line `Archived templates
  are hidden, not deleted. Restore one to bring it back.` is visible next to the
  checkbox; Restore brings the template back and the help line disappears when
  nothing is archived.
* Keyboard: Tab to the Archive button and press Enter; Tab into the dialog's Tags
  field, trigger the error, and confirm focus stays in the dialog.
* axe-core on the dialog while the error is shown: no serious or critical findings.
* The inventory (`docs/TEMPLATE_INVENTORY.json`) must be unchanged except for the
  commit it records: no template content changes.

### 5.4 Regression gates before the follow-up PR

`npm run typecheck`, `npx vitest run`, `npm run build`,
`npm run templates:assets:check` (must still report 62 templates, unchanged lock),
`npm run test:e2e:templates` (full, not `--quick`, before the PR), `npm run
test:e2e:studio`, `npm run db:compat` (unchanged: no migration is touched).

## 6. Branch and merge history (verified)

What actually happened, replacing the dependency plan written while PR #13 was on
hold:

1. `claude/binhi-template-f7-copy` was cut from `8cb182a`, the approved head of PR
   #13, before PR #13 merged, so this follow-up's diff is exactly its own change.
2. PR #13 was merged into `main` on 2026-11-02 at `8cb182a` (merge commit
   `ab94d7a0398fa2905199085674138025e17aa9f3`; D-BINHI-TPL-MERGE-016).
3. The follow-up branch received two commits: the governance record (`2f3712a`) and
   the implementation (`b04b202`).
4. PR #15 was opened from that branch against `main` (not against the old feature
   branch, which was no longer needed), as a draft, with CI run `41538920921` green.
5. After the founder's Phase 7 and merge approvals, PR #15 was merged into `main` on
   2026-11-03 at `b04b202` (merge commit `1dee1709b0ab86ef7ef1589e3d1460b66849a92a`,
   parents `ab94d7a` and `b04b202`; D-BINHI-TPL-MERGE-018). `main`'s tree equals the
   branch tree; no rebase, amend or force-push was used anywhere.

No migration, schema change, new dependency or production configuration change was
involved at any step.

## 7. Gates

| Gate | Status |
|---|---|
| Planning (this document) | COMPLETED (2026-11-02) |
| Founder authorisation to implement | COMPLETED (D-BINHI-TPL-F7-015, 2026-11-02) |
| Implementation and tests | COMPLETED (`b04b202`, §9) |
| Phase 7 approval of the actual wording, with test evidence | COMPLETED (D-BINHI-TPL-P7-017, 2026-11-03) |
| Merge of the follow-up PR | COMPLETED (D-BINHI-TPL-MERGE-018; PR #15 merged as `1dee170`, 2026-11-03) |
| PR #13 (Template Library v1.0) | COMPLETED to `main` (merged as `ab94d7a`, 2026-11-02); NOT RELEASED |
| Production migration `0004`, Replit Publish, deployment, production configuration | NOT AUTHORISED; unexecuted (release report §15) |

## 8. Final wording as implemented (approved by the founder, D-BINHI-TPL-P7-017)

Every sentence a person can meet from this follow-up. Items marked *founder copy*
were the founder's sentences verbatim; the founder approved the whole table on
2026-11-03.

| Where | Wording | Source |
|---|---|---|
| Line shown with the personal-template controls whenever at least one template exists; `id="tpl-archive-help"`, referenced by `aria-describedby` from every Archive button | Archiving hides this template from your active list. You can restore it anytime. | founder copy |
| Toast after archiving | “X” archived. You can restore it anytime from “Show archived”. | new (was: “X” archived) |
| Toast after restoring | “X” restored | unchanged |
| Tag longer than 30 characters | Each tag must be 30 characters or fewer. | founder copy |
| More than 8 tags | You can add up to 8 tags. | new; the number comes from `PERSONAL_LIMITS.tags` |
| Tag empty after trimming (reachable by API only; the browser drops empty tags) | Remove the empty tag. | new |
| Tag with no letter or number (for example `!!!`) | Each tag needs at least one letter or number. | reworded (was: Tags need at least one letter or number) |
| Tag with a control character (API only) | Tags cannot contain control characters. | punctuation only |
| Description longer than 280 characters (API only; the input is length-limited) | The description must be 280 characters or fewer. | new |
| Description with a line break (API only) | The description cannot contain line breaks. | punctuation only |
| Unknown category (API only; the control is a list) | Choose a category from the list. | punctuation only |

Deliberate choices: every message is a full sentence ending in a period, matching the
founder's approved sentence, so the reachable messages read consistently inside one
dialog. Numbers are interpolated from `PERSONAL_LIMITS`, never typed twice. The
message is shown inside the Template details dialog, under the fields, in an element
with `role="alert"`, the dialog stays open, the person's input is kept, editing the
tags clears it, and no toast is raised for a validation problem. Every other failure
(offline, not found, rate limit) keeps its existing toast. The server's global error
format (`path: message`) is untouched; an integration test proves it still carries
the `tags.0: ` prefix while the dialog shows only the message. F7-3 (curly quotes in
the delete title) is not part of this authorisation and is unchanged.

## 9. Evidence

Head `b04b202` (merged to `main` as `1dee170`). Files changed by the follow-up
(10): `src/core/templates/library/personal.ts` (messages only),
`src/client/templates/PersonalTemplates.tsx`, `src/client/templates/templates.css`,
`tests/unit/template-personal.test.ts` (new), `tests/integration/template-library.test.ts`,
`e2e/templates.ts`, `docs/TEMPLATE_LIBRARY_FOLLOWUP_F7.md`, `docs/TEMPLATE_LIBRARY.md`,
`docs/TEMPLATE_LIBRARY_RELEASE.md`, `docs/TEMPLATE_LIBRARY_BASELINE.md`. No
migration, schema, authentication, favorites-persistence, ownership or revision
change.

| Check | Result (local, 2026-11-02, on `b04b202`) |
|---|---|
| `npm run typecheck`, `npm run build` | pass |
| `npx vitest run` (unit + integration, real Postgres) | 31 files, 312 tests; 7 added (6 unit, one per message; 1 integration: messages travel as issues, global format unchanged) |
| `npm run test:e2e:templates` | 77 checks, 62 templates; new assertions: in-dialog message, kept input, no `tags.0` in any toast, message clears on edit, axe-core on the dialog in its error state, Archive explanation visible and `aria-describedby` from the button, archive toast |
| `npm run test:e2e:studio` | 21 checks |
| `npm run db:compat`, `npm run templates:assets:check` | unchanged (`0004` annotated; 62 templates) |
| GitHub Actions run `41538920921` on `b04b202` | success: jobs `125597774528` and `125597774877` |

## 10. Separate product concern, recorded and not fixed here

If a person favorites a template and leaves the page before the request has reached
the server (network latency rather than server latency), the favorite can be lost
silently; the button had already flipped. The e2e race fixed under D-BINHI-TPL-CI-014
was the test's reload reading before a slow server finished, where the server still
stored the favorite. `keepalive` on the request was tried against a slow server and
made no difference there, and the network-latency case was not reproducible in the
test harness. This is outside the F7 scope and stays open for a separate decision.
