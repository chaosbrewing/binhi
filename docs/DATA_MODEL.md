# BINHI data model

All tables are prefixed `binhi_` and created by the forward-only migrations in
`migrations/` (`0000_binhi_initial.sql`, `0001_binhi_creative_studio.sql`),
tracked in `drizzle.binhi_migrations`. Ownership is explicit on every reachable row.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `binhi_users` | Accounts | `email` (unique), `password_hash` (scrypt), `deleted_at` |
| `binhi_sessions` | Server-side sessions | `token_hash` (HMAC of the cookie token), `expires_at`, `last_seen_at` |
| `binhi_sites` | One website | `owner_id`, `slug` (unique, public path), `document` (jsonb, canonical), `revision`, `source_template_id` / `source_template_version` (provenance, nullable), `live_publication_id`, `deleted_at` |
| `binhi_site_revisions` | Immutable document snapshots | `(site_id, revision)` unique, `kind` (template/autosave/restore/publish/undo/redo), `summary` (op types), `document` |
| `binhi_op_batches` | Idempotency for autosave | `(site_id, batch_id)` unique, `result_revision` |
| `binhi_assets` | Media metadata | `site_id`, `mime_type`, `byte_size`, `width/height`, `alt`, `folder`, `storage`, `storage_key`, `sha256`, `deleted_at` |
| `binhi_asset_blobs` | Bytes for the Postgres storage adapter | `key`, `data` (bytea) |
| `binhi_publications` | Publication lifecycle | `state` (pending/building/deploying/live/failed/unpublished/superseded), `revision`, `revision_id`, `adapter`, `slug`, `url`, `error`, `verified_at` |
| `binhi_published_pages` | Rendered HTML per page | `(publication_id, path)` unique, `html` |
| `binhi_form_submissions` | Visitor form posts | `site_id`, `form_node_id`, `fields` (label → value) |
| `binhi_audit_log` | Who did what | `actor_id`, `site_id`, `action`, `details`, `ip` |
| `binhi_library_assets` | Private, account-level image library (Phase 1) | `owner_id`, `mime_type`, `width/height`, `alt`, `tags`, `origin` (upload / photo-original), `storage_key`, `sha256`, `deleted_at` |
| `binhi_projects` | Creative projects with a per-kind document (Phase 1) | `owner_id`, `kind` (photo / design / design-template), `document` (jsonb, validated per kind), `revision`, `source_template_id` / `source_template_version` (provenance, nullable), `description` / `category` / `tags` / `archived_at` (personal-template details, nullable, outside the document and its revision), `deleted_at` |
| `binhi_asset_usages` | Which projects reference which library files (Phase 1) | `(asset_id, project_id)` unique; recomputed on every project save |
| `binhi_template_favorites` | A person's favorite shared templates (Template Library) | `(user_id, template_id)` unique, `user_id` cascades; removed explicitly on account deletion because accounts are anonymised, not dropped |
| `binhi_brand_kits` | Colours, fonts, logo and tagline per account (Phase 1) | `owner_id`, `document` (jsonb), `deleted_at` |

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

## Creative documents (Phase 1)

Website projects stay in `binhi_sites`; the dashboard merges them read-only
with `binhi_projects`. Each project kind has its own Zod document in
`src/core/creative/`, validated on every write:

```
PhotoProjectDocument   schemaVersion 1, sourceAssetId (library), source {mimeType,width,height}, recipe (crop, size, rotation, flips, adjustments)
DesignDocument         schemaVersion 1, width/height (64–4096px, ≤16 MP), background, layers[] (text | rect | ellipse | image; ≤200)
BrandKitDocument       schemaVersion 1, colors[] (1–12), fonts {heading, body}, logoAssetId?, tagline
```

Projects use the same optimistic-concurrency contract as websites: a save
carries `baseRevision`; a mismatch is a 409 with the server copy. Library
files are private: bytes are served only to their owner through
`/api/library/:id/file`; a copy enters a website's public media only through
the explicit copy-to-site action, which runs the existing media checks.
