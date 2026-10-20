# BINHI data model

All tables are prefixed `binhi_` and created by `migrations/0000_binhi_initial.sql`
(tracked in `binhi_migrations`). Ownership is explicit on every reachable row.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `binhi_users` | Accounts | `email` (unique), `password_hash` (scrypt), `deleted_at` |
| `binhi_sessions` | Server-side sessions | `token_hash` (HMAC of the cookie token), `expires_at`, `last_seen_at` |
| `binhi_sites` | One website | `owner_id`, `slug` (unique, public path), `document` (jsonb, canonical), `revision`, `live_publication_id`, `deleted_at` |
| `binhi_site_revisions` | Immutable document snapshots | `(site_id, revision)` unique, `kind` (template/autosave/restore/publish/undo/redo), `summary` (op types), `document` |
| `binhi_op_batches` | Idempotency for autosave | `(site_id, batch_id)` unique, `result_revision` |
| `binhi_assets` | Media metadata | `site_id`, `mime_type`, `byte_size`, `width/height`, `alt`, `folder`, `storage`, `storage_key`, `sha256`, `deleted_at` |
| `binhi_asset_blobs` | Bytes for the Postgres storage adapter | `key`, `data` (bytea) |
| `binhi_publications` | Publication lifecycle | `state` (pending/building/deploying/live/failed/unpublished/superseded), `revision`, `revision_id`, `adapter`, `slug`, `url`, `error`, `verified_at` |
| `binhi_published_pages` | Rendered HTML per page | `(publication_id, path)` unique, `html` |
| `binhi_form_submissions` | Visitor form posts | `site_id`, `form_node_id`, `fields` (label → value) |
| `binhi_audit_log` | Who did what | `actor_id`, `site_id`, `action`, `details`, `ip` |

## The canonical document (`binhi_sites.document`)

Defined in `src/core/schema/document.ts`. Summary:

```
SiteDocument
  schemaVersion: 1
  name
  theme        colors{primary…border}, palette[], fonts{heading,body}, textStyles{display…navigation},
               buttons{primary,secondary,ghost}, links, radii, shadows, spacing{contentWidth, sectionPaddingY, gap}
  settings     language, faviconAssetUrl, socialImage, defaultSeoTitle/Description, headerSticky
  pages[]      id, name, slug, isHome, hiddenFromNav, seo{title, description, socialImage, canonicalUrl, noIndex}, sections[Node]
  navigation   auto | items[NavItem{label, target: LinkTarget, children}]
  header       Node | null      (site-wide)
  footer       Node | null
  reusableSections[] id, name, node
```

```
Node
  id, type (registry), name?, props (validated per type)
  style: StyleSet (desktop)           responsive: { tablet?: StyleSet, mobile?: StyleSet }
  layout?: { mode: flow|free, designWidth, designHeight, stackOnMobile, contentWidth }   (containers)
  placement?: { desktop: Placement, tablet?, mobile? }   Placement = { x, y, width, height, rotation, z }
  visibility: { desktop, tablet, mobile }
  locked, hidden, textStyle?, interactions?, a11y?, anchorId?, reusableId?, children?
```

Invariants enforced by the schema: exactly one homepage; unique page slugs;
unique node ids; only whitelisted CSS values (lengths with units, colours
matching a strict grammar, enumerated keywords); bounded array sizes.

## Lifecycle rules

- **Revision**: `binhi_sites.revision` increments by one per accepted batch.
  Clients send `baseRevision`; a mismatch is a 409 carrying the server copy.
- **Retention**: autosave snapshots older than the last 200 are pruned unless
  a publication references them. Template/restore/publish snapshots are kept.
- **Deletion**: sites and accounts are soft-deleted (`deleted_at`) and
  unpublished immediately; media bytes are removed on asset deletion.
- **Publication**: `live_publication_id` is the only pointer the public route
  follows. It is moved after verification succeeds, never before.
