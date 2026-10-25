import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex, customType } from "drizzle-orm/pg-core";

/**
 * BINHI persistence. Every table is prefixed `binhi_` so the schema can live
 * in a shared Postgres without colliding with anything else, and ownership
 * is explicit on every row that a user can reach.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable(
  "binhi_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ emailIdx: uniqueIndex("binhi_users_email_idx").on(t.email) }),
);

export const sessions = pgTable(
  "binhi_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => ({ tokenIdx: uniqueIndex("binhi_sessions_token_idx").on(t.tokenHash), userIdx: index("binhi_sessions_user_idx").on(t.userId) }),
);

export const sites = pgTable(
  "binhi_sites",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Public slug under /s/<slug>/. Unique across BINHI. */
    slug: text("slug").notNull(),
    templateId: text("template_id").notNull(),
    /** Current draft document (canonical). */
    document: jsonb("document").notNull(),
    /** Monotonic draft revision; every applied batch increments it. */
    revision: integer("revision").notNull().default(0),
    schemaVersion: integer("schema_version").notNull().default(1),
    /** Id of the publication currently live, if any. */
    livePublicationId: text("live_publication_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ slugIdx: uniqueIndex("binhi_sites_slug_idx").on(t.slug), ownerIdx: index("binhi_sites_owner_idx").on(t.ownerId) }),
);

export const siteRevisions = pgTable(
  "binhi_site_revisions",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    document: jsonb("document").notNull(),
    /** Why this revision exists: autosave, restore, publish, template. */
    kind: text("kind").notNull(),
    label: text("label"),
    /** Operation types applied in this batch, for the history list. */
    summary: jsonb("summary").notNull().default([]),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteRevIdx: uniqueIndex("binhi_site_revisions_site_rev_idx").on(t.siteId, t.revision) }),
);

/** Idempotency for autosave batches: a retried batch is acknowledged, never re-applied. */
export const opBatches = pgTable(
  "binhi_op_batches",
  {
    siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    resultRevision: integer("result_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: uniqueIndex("binhi_op_batches_pk").on(t.siteId, t.batchId) }),
);

export const assets = pgTable(
  "binhi_assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    folder: text("folder").notNull().default(""),
    /** Storage adapter that holds the bytes and its key. */
    storage: text("storage").notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ siteIdx: index("binhi_assets_site_idx").on(t.siteId) }),
);

/** Durable bytes for the default "postgres" storage adapter. */
export const assetBlobs = pgTable("binhi_asset_blobs", {
  key: text("key").primaryKey(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const PUBLICATION_STATES = ["pending", "building", "deploying", "live", "failed", "unpublished", "superseded"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const publications = pgTable(
  "binhi_publications",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    /** Draft revision this publication was built from (immutable snapshot in siteRevisions). */
    revision: integer("revision").notNull(),
    revisionId: text("revision_id").notNull(),
    state: text("state").notNull().$type<PublicationState>(),
    adapter: text("adapter").notNull(),
    slug: text("slug").notNull(),
    url: text("url"),
    pageCount: integer("page_count").notNull().default(0),
    error: text("error"),
    requestedBy: text("requested_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({ siteIdx: index("binhi_publications_site_idx").on(t.siteId) }),
);

export const publishedPages = pgTable(
  "binhi_published_pages",
  {
    publicationId: text("publication_id").notNull().references(() => publications.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    pageId: text("page_id").notNull(),
    html: text("html").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: uniqueIndex("binhi_published_pages_pk").on(t.publicationId, t.path) }),
);

export const formSubmissions = pgTable(
  "binhi_form_submissions",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    formNodeId: text("form_node_id").notNull(),
    pagePath: text("page_path").notNull(),
    fields: jsonb("fields").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => ({ siteIdx: index("binhi_form_submissions_site_idx").on(t.siteId) }),
);

export const auditLog = pgTable(
  "binhi_audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    siteId: text("site_id"),
    action: text("action").notNull(),
    details: jsonb("details").notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteIdx: index("binhi_audit_site_idx").on(t.siteId) }),
);

/* ------------------------------------------------------------------ Phase 1: creative studio */

/** Account-level, private media library shared by the photo editor, design studio and brand kits. */
export const libraryAssets = pgTable(
  "binhi_library_assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull().default(""),
    tags: text("tags").notNull().default(""),
    /** Why the file exists: "upload" (chosen by the owner) or "photo-original" (saved with a photo project). */
    origin: text("origin").notNull().default("upload"),
    storage: text("storage").notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ ownerIdx: index("binhi_library_assets_owner_idx").on(t.ownerId) }),
);

export const PROJECT_KINDS_DB = ["photo", "design", "design-template"] as const;

/** Creative projects with a per-kind document. Website projects remain in binhi_sites. */
export const projects = pgTable(
  "binhi_projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<(typeof PROJECT_KINDS_DB)[number]>(),
    name: text("name").notNull(),
    document: jsonb("document").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    /** Optimistic concurrency: clients send the revision they loaded; a mismatch is a 409. */
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ ownerIdx: index("binhi_projects_owner_idx").on(t.ownerId) }),
);

/** Which projects reference which library assets; recomputed on every project save. */
export const assetUsages = pgTable(
  "binhi_asset_usages",
  {
    assetId: text("asset_id").notNull().references(() => libraryAssets.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: uniqueIndex("binhi_asset_usages_pk").on(t.assetId, t.projectId), projectIdx: index("binhi_asset_usages_project_idx").on(t.projectId) }),
);

export const brandKits = pgTable(
  "binhi_brand_kits",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    document: jsonb("document").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({ ownerIdx: index("binhi_brand_kits_owner_idx").on(t.ownerId) }),
);
