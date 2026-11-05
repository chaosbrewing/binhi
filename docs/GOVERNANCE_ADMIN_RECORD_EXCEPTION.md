# Administrative Governance Record Exception

**Status: ADOPTED by founder decision D-BINHI-GOV-022-ADOPT (YES, 2026-11-05),
subject to the founder's approval of this exact text. In force from the merge of
the pull request that carries this document to `main`.** Prepared under
D-BINHI-GOV-022 (preparation only). Both decisions are recorded in the canonical
register, `docs/TEMPLATE_LIBRARY_RELEASE.md` §14. This document was merged by an
ordinary, separately approved documentation PR: the exception was not used to
adopt itself.

Repository: `chaosbrewing/binhi`. Governing standard: CHAOS ORIGINS Application
Development Workflow v2.1. Scope: the BINHI repository's governance records. It
grants no authority over application code, security controls, migrations,
deployment, production configuration or any existing hold.

## 1. Problem it solves

Recording a merge decision in the register changes the branch it would be
recorded on, so the record must land after the merge, in its own documentation
PR. That PR then needs its own merge decision, which needs its own record. The
sequence PR #16 (MERGE-020) → PR #17 (MERGE-021) → "record MERGE-021" shows the
loop. The principle: **record decisions without generating unnecessary decisions
about recording decisions.**

## 2. Definition

An **administrative governance record** is a documentation-only change whose sole
purpose is to write into the canonical register, and its execution notes, a
decision the founder has already made in writing and an operation that has
already been completed and verified.

## 3. Eligibility (all required)

A change qualifies only when every condition holds:

1. It records an operation that was already authorised by a written founder
   decision and already completed (for example, a merge executed under a
   MERGE-nnn decision).
2. It contains no new substantive founder decision and no change to the value,
   scope or date of any existing decision.
3. It changes only the explicitly approved governance-record files:
   `docs/TEMPLATE_LIBRARY_RELEASE.md` §14 (register rows and their execution
   paragraphs) and, where the same operation is summarised, the status header
   or status table of `docs/TEMPLATE_LIBRARY_BASELINE.md` and
   `docs/TEMPLATE_LIBRARY_FOLLOWUP_F7.md`. No other file.
4. It preserves every existing decision identifier and historical row. Rows are
   appended, never edited, renumbered or deleted. Corrections to historical
   prose are made by a dated note beneath the original, never by rewriting it.
5. Every row it adds cites the verifiable evidence: decision identifier, the
   founder's words or directive reference, date, PR number, approved head SHA,
   merge commit SHA, parent SHAs and the CI run that was green on the head.
6. It does not change application behaviour, tests, migrations, configuration,
   workflows, dependencies or security controls, and the diff proves it.

## 4. Required safeguards before merging under the exception

Each is verified fresh and recorded in the execution evidence:

1. **Exact head.** The head SHA is fetched from the remote immediately before
   merging and the merge call is pinned to it (expected-head guard). Any change
   of head stops the merge.
2. **Documentation-only diff.** `git diff --name-only <base>...<head>` lists
   only the files in §3 item 3; any other path disqualifies the change.
3. **Required CI green on that head.** Both required jobs of `ci.yml` succeeded
   on the exact head. A still-running or failed job disqualifies the change.
4. **No unresolved blocking review.** No open review thread, no
   changes-requested review, no comment asking for a hold.
5. **Branch protection enforced.** The merge goes through GitHub's normal
   protected-branch path with a merge commit. No bypass, no admin override, no
   force-push, no rebase, no amend.
6. **Auditable execution evidence.** The merge commit message names the
   decision being recorded, the head SHA, the CI run and the checks performed.
   The agent's report to the founder repeats them with the resulting merge SHA
   and parents, confirmed from a fresh fetch, and the post-merge CI result on
   `main` reported as it actually is (IN PROGRESS until it completes).
7. **No production or financial operation.** The exception never touches
   production databases, Replit Publish, deployments, DNS, secrets, billing or
   payments, and it says so in the record.
8. **No alteration of existing holds.** Every production restriction and every
   NOT AUTHORISED / NOT STARTED state in §15 stays as it is.

## 5. Exclusions (never covered)

The exception never applies to a change that touches, in any amount:

- application code (`src/`, `public/`, `e2e/`, `tests/`, `scripts/`);
- database migrations (`migrations/`, `drizzle/`, schema files);
- authentication or authorisation logic or configuration;
- security configuration (sessions, secrets handling, rate limits, CORS, CSP);
- CI/CD workflows (`.github/`) or any deploy, publish or release automation;
- infrastructure or hosting configuration (`.replit`, `replit.nix`,
  `package.json`, lockfiles, environment files);
- a production release, migration application, publish or deployment;
- any financial operation;
- a new or amended substantive founder decision, including any change to
  interface wording, scope, dates or the value of an existing decision;
- documentation outside the governance-record files named in §3 item 3.

If a documentation change mixes an administrative record with anything else, the
whole change is outside the exception and needs an ordinary decision.

## 6. Procedure under the exception

1. Agent cuts a branch from the current `main`, adds only the record, pushes and
   opens a PR titled "Governance record: <decision ids> (administrative)".
2. Agent waits for CI on the head.
3. Agent re-verifies §4 items 1 to 5 from a fresh fetch, merges with a merge
   commit pinned to the head, and verifies §4 item 6.
4. Agent reports once, in the standard format, citing this policy and its
   adoption decision identifier. No founder decision is requested for the merge.
5. Any failed safeguard stops the procedure; the agent reports the blocker and
   waits for the founder.

## 7. Adoption, first use and revocation

Adopted by **D-BINHI-GOV-022-ADOPT** (YES, 2026-11-05), recorded in
`docs/TEMPLATE_LIBRARY_RELEASE.md` §14. The founder may narrow or revoke the
exception at any time in writing; a change is recorded as a register row and
takes effect immediately.

The exception cannot be used to merge itself: this document and the register rows
for GOV-022, GOV-022-ADOPT and MERGE-021 entered `main` by an ordinary
documentation PR with its own founder merge decision. The first use of the
exception, if any, is the administrative record of that merge decision.
