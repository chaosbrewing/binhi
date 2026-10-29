import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "../db/client.js";
import { assetUsages, libraryAssets, projects } from "../db/schema.js";
import { newId } from "../../core/ids.js";
import { inspectRaster, PHOTO_LIMITS } from "../../core/media/photo.js";
import { badRequest, conflict, notFound } from "../security/errors.js";
import type { ObjectStorage } from "../assets/storage.js";
import { EXT_BY_TYPE, safeFilename } from "../assets/images.js";
import { audit } from "../audit.js";
import type { AssetService } from "../assets/service.js";

export interface LibraryAssetRecord {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  alt: string;
  tags: string;
  origin: string;
  sha256: string;
  url: string;
  createdAt: string;
  /** Projects currently referencing the asset (ids), for honest delete prompts. */
  usedBy: { id: string; name: string; kind: string }[];
}

export interface LibraryBulkDeleteResult {
  deletedIds: string[];
  skippedUsed: { id: string; filename: string; usedBy: number }[];
  missingIds: string[];
}

export const LIBRARY_LIMITS = {
  maxAssetsPerOwner: 500,
  maxBytesPerOwner: 300 * 1024 * 1024,
} as const;

function toRecord(row: typeof libraryAssets.$inferSelect, usedBy: LibraryAssetRecord["usedBy"] = []): LibraryAssetRecord {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    alt: row.alt,
    tags: row.tags,
    origin: row.origin,
    sha256: row.sha256,
    url: `/api/library/${row.id}/file`,
    createdAt: row.createdAt.toISOString(),
    usedBy,
  };
}

/**
 * Private, account-scoped media. Bytes are only served to the owner through
 * /api/library/:id/file; nothing here is reachable without a session. Copying
 * an asset into a website's media library is an explicit action that goes
 * through the existing (public) AssetService with all of its checks.
 */
export class LibraryService {
  constructor(
    private readonly db: Db,
    private readonly storage: ObjectStorage,
    private readonly maxBytes: number,
  ) {}

  async list(ownerId: string): Promise<LibraryAssetRecord[]> {
    const rows = await this.db.select().from(libraryAssets).where(and(eq(libraryAssets.ownerId, ownerId), isNull(libraryAssets.deletedAt))).orderBy(desc(libraryAssets.createdAt));
    if (!rows.length) return [];
    const usage = await this.db
      .select({ assetId: assetUsages.assetId, id: projects.id, name: projects.name, kind: projects.kind })
      .from(assetUsages)
      .innerJoin(projects, eq(projects.id, assetUsages.projectId))
      .where(and(inArray(assetUsages.assetId, rows.map((r) => r.id)), isNull(projects.deletedAt)));
    const byAsset = new Map<string, LibraryAssetRecord["usedBy"]>();
    for (const u of usage) byAsset.set(u.assetId, [...(byAsset.get(u.assetId) ?? []), { id: u.id, name: u.name, kind: u.kind }]);
    return rows.map((r) => toRecord(r, byAsset.get(r.id) ?? []));
  }

  async getOwned(ownerId: string, assetId: string): Promise<typeof libraryAssets.$inferSelect> {
    const rows = await this.db.select().from(libraryAssets).where(and(eq(libraryAssets.id, assetId), eq(libraryAssets.ownerId, ownerId), isNull(libraryAssets.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("File not found");
    return rows[0];
  }

  async get(ownerId: string, assetId: string): Promise<LibraryAssetRecord> {
    const row = await this.getOwned(ownerId, assetId);
    const usage = await this.usedBy(assetId);
    return toRecord(row, usage);
  }

  private async usedBy(assetId: string): Promise<LibraryAssetRecord["usedBy"]> {
    const rows = await this.db
      .select({ id: projects.id, name: projects.name, kind: projects.kind })
      .from(assetUsages)
      .innerJoin(projects, eq(projects.id, assetUsages.projectId))
      .where(and(eq(assetUsages.assetId, assetId), isNull(projects.deletedAt)));
    return rows;
  }

  /**
   * Store a raster image. Validation is stricter than the website media
   * endpoint: PNG/JPEG/static WebP only, header dimensions bounded before any
   * decode (decompression-bomb guard), animated files refused. The bytes are
   * kept exactly as uploaded (original preservation); metadata is stripped
   * from exports, never from originals.
   */
  async upload(ownerId: string, input: { filename: string; data: Buffer; alt?: string; tags?: string; origin?: "upload" | "photo-original" }, ip?: string): Promise<LibraryAssetRecord> {
    if (!input.data.length) throw badRequest("The file is empty");
    if (input.data.length > this.maxBytes || input.data.length > PHOTO_LIMITS.inputBytes) throw badRequest(`Images must be ${Math.round(Math.min(this.maxBytes, PHOTO_LIMITS.inputBytes) / 1024 / 1024)} MB or smaller`);
    let info;
    try {
      info = inspectRaster(new Uint8Array(input.data.buffer, input.data.byteOffset, input.data.byteLength));
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : "Unsupported image");
    }
    const usage = await this.db
      .select({ n: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${libraryAssets.byteSize}),0)::bigint` })
      .from(libraryAssets)
      .where(and(eq(libraryAssets.ownerId, ownerId), isNull(libraryAssets.deletedAt)));
    if ((usage[0]?.n ?? 0) >= LIBRARY_LIMITS.maxAssetsPerOwner) throw badRequest("Your asset library is full (500 files). Delete files you no longer need.");
    if (Number(usage[0]?.bytes ?? 0) + input.data.length > LIBRARY_LIMITS.maxBytesPerOwner) throw badRequest("Your asset library has reached its 300 MB storage limit.");

    const id = newId("lib");
    const filename = safeFilename(input.filename, EXT_BY_TYPE[info.mimeType]);
    const key = `library/${ownerId}/${id}/${filename}`;
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    await this.storage.put(key, input.data, info.mimeType);
    await this.db.insert(libraryAssets).values({
      id,
      ownerId,
      filename,
      mimeType: info.mimeType,
      byteSize: input.data.length,
      width: info.width,
      height: info.height,
      alt: (input.alt ?? "").slice(0, 200),
      tags: (input.tags ?? "").slice(0, 120),
      origin: input.origin ?? "upload",
      storage: this.storage.name,
      storageKey: key,
      sha256,
    });
    await audit(this.db, { actorId: ownerId, action: "library.uploaded", details: { id, bytes: input.data.length, mimeType: info.mimeType, origin: input.origin ?? "upload" }, ip });
    return toRecord((await this.db.select().from(libraryAssets).where(eq(libraryAssets.id, id)).limit(1))[0]!);
  }

  async update(ownerId: string, assetId: string, patch: { alt?: string; tags?: string; filename?: string }): Promise<LibraryAssetRecord> {
    const row = await this.getOwned(ownerId, assetId);
    const set: Partial<typeof libraryAssets.$inferInsert> = {};
    if (patch.alt !== undefined) set.alt = patch.alt.slice(0, 200);
    if (patch.tags !== undefined) set.tags = patch.tags.slice(0, 120);
    if (patch.filename !== undefined) set.filename = safeFilename(patch.filename, EXT_BY_TYPE[row.mimeType as keyof typeof EXT_BY_TYPE] ?? ".png");
    if (Object.keys(set).length) await this.db.update(libraryAssets).set(set).where(eq(libraryAssets.id, assetId));
    return this.get(ownerId, assetId);
  }

  /** Read bytes for the owner only. */
  async read(ownerId: string, assetId: string): Promise<{ data: Buffer; mimeType: string; filename: string; sha256: string }> {
    const row = await this.getOwned(ownerId, assetId);
    const data = await this.storage.get(row.storageKey);
    if (!data) throw notFound("File not found");
    return { data, mimeType: row.mimeType, filename: row.filename, sha256: row.sha256 };
  }

  /** Soft-delete and remove bytes. Refused while a project still uses the file unless `force`. */
  async delete(ownerId: string, assetId: string, opts: { force?: boolean } = {}, ip?: string): Promise<void> {
    const row = await this.getOwned(ownerId, assetId);
    const usage = await this.usedBy(assetId);
    if (usage.length && !opts.force) throw conflict(`This file is used by ${usage.length} project${usage.length === 1 ? "" : "s"}. Remove it from them first, or delete anyway.`, { usedBy: usage });
    await this.db.update(libraryAssets).set({ deletedAt: new Date() }).where(eq(libraryAssets.id, assetId));
    await this.db.delete(assetUsages).where(eq(assetUsages.assetId, assetId));
    await this.storage.delete(row.storageKey);
    await audit(this.db, { actorId: ownerId, action: "library.deleted", details: { id: assetId, forced: !!opts.force, usedBy: usage.length }, ip });
  }

  async deleteMany(ownerId: string, assetIds: string[], opts: { force?: boolean } = {}, ip?: string): Promise<LibraryBulkDeleteResult> {
    const unique = Array.from(new Set(assetIds));
    if (!unique.length) return { deletedIds: [], skippedUsed: [], missingIds: [] };
    const rows = await this.db
      .select({ id: libraryAssets.id, filename: libraryAssets.filename, storageKey: libraryAssets.storageKey })
      .from(libraryAssets)
      .where(and(eq(libraryAssets.ownerId, ownerId), isNull(libraryAssets.deletedAt), inArray(libraryAssets.id, unique)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const missingIds = unique.filter((id) => !byId.has(id));
    if (!rows.length) {
      await audit(this.db, { actorId: ownerId, action: "library.bulk_deleted", details: { requested: unique.length, deleted: 0, forced: !!opts.force, skippedUsed: 0, missing: missingIds.length }, ip });
      return { deletedIds: [], skippedUsed: [], missingIds };
    }

    const usageRows = await this.db
      .select({ assetId: assetUsages.assetId, usedBy: sql<number>`count(*)::int` })
      .from(assetUsages)
      .innerJoin(projects, eq(projects.id, assetUsages.projectId))
      .where(and(inArray(assetUsages.assetId, rows.map((r) => r.id)), isNull(projects.deletedAt)))
      .groupBy(assetUsages.assetId);
    const usageByAsset = new Map(usageRows.map((u) => [u.assetId, Number(u.usedBy)]));
    const skippedUsed = !opts.force
      ? rows
          .map((r) => ({ id: r.id, filename: r.filename, usedBy: usageByAsset.get(r.id) ?? 0 }))
          .filter((r) => r.usedBy > 0)
      : [];
    const deletable = opts.force ? rows : rows.filter((r) => (usageByAsset.get(r.id) ?? 0) === 0);
    if (deletable.length) {
      const ids = deletable.map((r) => r.id);
      await this.db.update(libraryAssets).set({ deletedAt: new Date() }).where(inArray(libraryAssets.id, ids));
      await this.db.delete(assetUsages).where(inArray(assetUsages.assetId, ids));
      await Promise.all(deletable.map((r) => this.storage.delete(r.storageKey)));
    }
    await audit(this.db, {
      actorId: ownerId,
      action: "library.bulk_deleted",
      details: { requested: unique.length, deleted: deletable.length, forced: !!opts.force, skippedUsed: skippedUsed.length, missing: missingIds.length },
      ip,
    });
    return { deletedIds: deletable.map((r) => r.id), skippedUsed, missingIds };
  }

  /** Explicitly publish a private library file into a website's (public) media library. */
  async copyToSite(ownerId: string, assetId: string, siteId: string, assets: AssetService, ip?: string) {
    const file = await this.read(ownerId, assetId);
    const asset = await assets.upload(ownerId, siteId, { filename: file.filename, data: file.data, folder: "From asset library" }, ip);
    await audit(this.db, { actorId: ownerId, siteId, action: "library.copied_to_site", details: { libraryAssetId: assetId, siteAssetId: asset.id }, ip });
    return asset;
  }

  /** Replace the usage rows for a project with the given asset ids (all must belong to the owner). */
  async setUsages(ownerId: string, projectId: string, assetIds: string[]): Promise<void> {
    const unique = Array.from(new Set(assetIds));
    if (unique.length) {
      const owned = await this.db.select({ id: libraryAssets.id }).from(libraryAssets).where(and(inArray(libraryAssets.id, unique), eq(libraryAssets.ownerId, ownerId), isNull(libraryAssets.deletedAt)));
      if (owned.length !== unique.length) throw badRequest("This project refers to a file that is not in your asset library");
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(assetUsages).where(eq(assetUsages.projectId, projectId));
      if (unique.length) await tx.insert(assetUsages).values(unique.map((assetId) => ({ assetId, projectId })));
    });
  }
}
