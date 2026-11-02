# Template Library follow-up F7: Archive clarity and friendly validation messages

Status: **specification only, NOT STARTED.** Planning was authorised by the founder
on 2026-11-02 (decision record in `docs/TEMPLATE_LIBRARY_RELEASE.md` §14). No code
has been written. Executing this specification needs a separate founder
authorisation, and the resulting wording needs its own Phase 7 approval before
any merge. PR #13 stays on hold at `5f536c4` and is not modified by this work.

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

## 6. Branch and dependency

The code exists only on `claude/binhi-template-library`, so the follow-up branch
(`claude/binhi-template-f7-copy`) is cut from `5f536c4` and its PR targets
`claude/binhi-template-library`, never `main` while #13 is unmerged. This is a
declared dependency on PR #13; it is not resolved by merging #13. If #13 merges
first, the follow-up is retargeted to `main` with a normal merge, no rebase.

No migration, no schema change, no new dependency, no change to production
configuration. Expected size: under 60 changed lines in `personal.ts` and
`PersonalTemplates.tsx`, plus tests.

## 7. Gates

| Gate | Status |
|---|---|
| Planning (this document) | COMPLETED |
| Founder authorisation to implement | AWAITING APPROVAL |
| Implementation and tests | NOT STARTED |
| Renewed Phase 7 approval of the actual wording, with test evidence | NOT STARTED |
| Merge of the follow-up PR | NOT AUTHORISED |
| PR #13 merge, production migration, Replit publish | NOT AUTHORISED (unchanged) |
