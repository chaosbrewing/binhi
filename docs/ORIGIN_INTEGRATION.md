# ORIGIN integration plan (Milestone 6 — specification)

BINHI is standalone today. This document is the contract for making it the
website sector of ORIGIN without rewriting it. **Nothing here is wired to
ORIGIN production; no ORIGIN credentials, databases or routes are used.**

## Seams that exist in the code now

| Seam | Where | Standalone implementation | ORIGIN implementation |
| --- | --- | --- | --- |
| Identity | `SessionService.resolve(token)` → `AuthUser { id, email, displayName }`; every service takes `ownerId` | BINHI accounts + cookie sessions | An `OriginIdentityContext` that resolves ORIGIN's session and maps Person → `ownerId`; organisation/project ownership replaces `binhi_sites.owner_id` through a compatibility view |
| Project ownership | `SiteService.getOwned(ownerId, siteId)` is the single authorization gate | owner = user | owner = ORIGIN project membership (role check), read-only adapter over ORIGIN's project table |
| Publishing | `PublishingAdapter` (`deploy/activate/retract/siteUrl`) | `LocalPublishingAdapter` | `LiyabPublishingAdapter` calling LIYAB's approved deployment execution; `binhi_publications.adapter` names the authority |
| Media | `ObjectStorage` (`put/get/delete`) | Postgres blobs or disk | ORIGIN/LIYAB-managed object storage (S3-compatible) |
| Edits | `Operation` + `applyOperations` | editor dispatches | TALA proposes `Operation[]` batches through the same validated endpoint; it never touches the DOM or published files |
| Events | `audit()` records `site.created`, `site.updated`, `publish.live`, `publish.unpublished`, `asset.*`, `account.*` | audit table | emit typed events (`binhi.site.created`, `binhi.site.updated`, `binhi.site.published`, `binhi.site.unpublished`, `binhi.form.submitted`) with tenant context, idempotency ids and minimal payloads for AGOS |

## Rules

1. ORIGIN owns identity, organisations, projects, permissions, billing and
   audit policy. BINHI keeps content, the canonical document, revisions and
   publication intent.
2. TALA reasons and proposes; BINHI validates and records; LIYAB executes
   infrastructure. Exactly one adapter is authoritative per publication.
3. No dual writes: integration is by adapters and read-only compatibility
   views, never by copying ORIGIN tables into `binhi_*`.
4. The standalone path keeps working; ORIGIN adapters are additive.
5. Library ids (`binhi.icon.*`, and later `binhi.element.*`) are opaque strings in BINHI documents. Adapters may carry
   them but must not interpret or rewrite them; TALA proposals reference them through the same validated operations
   (the optional `idSeeds` field is for editors and can be omitted by proposers).

## Event schema (draft)

```json
{
  "type": "binhi.site.published",
  "version": 1,
  "id": "evt_…",            // idempotency key
  "occurredAt": "2026-10-20T10:00:00Z",
  "tenant": { "organisationId": "…", "projectId": "…" },
  "actor": { "kind": "user", "id": "…" },
  "data": { "siteId": "…", "publicationId": "…", "revision": 12, "url": "https://…" }
}
```

No document content, no personal data beyond ids.

## Contract tests to add when the adapters are built

- Identity adapter: a BINHI site is reachable only by members of its ORIGIN
  project with an editor role; viewers get 404.
- Publishing adapter: `deploy → verify → activate` against a LIYAB sandbox;
  failed verification leaves the previous publication live.
- Event emitter: every `publish.live` audit entry produces exactly one
  `binhi.site.published` event, replay-safe by `id`.
- TALA proposal: an `Operation[]` batch from TALA is accepted or rejected by
  the same rules as an editor batch (no privileged path).
