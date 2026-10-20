import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "../db/client.js";
import { assets, sites } from "../db/schema.js";
import { newId } from "../../core/ids.js";
import { badRequest, notFound } from "../security/errors.js";
import type { ObjectStorage } from "./storage.js";
import { EXT_BY_TYPE, safeFilename, sniffImage } from "./images.js";
import { audit } from "../audit.js";

export interface AssetRecord {
  id: string;
  siteId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
  url: string;
  createdAt: string;
}

const MAX_ASSETS_PER_SITE = 500;
const MAX_TOTAL_BYTES_PER_SITE = 200 * 1024 * 1024;

export function assetUrl(id: string, filename: string): string {
  return `/media/${id}/${encodeURIComponent(filename)}`;
}

function toRecord(row: typeof assets.$inferSelect): AssetRecord {
  return {
    id: row.id,
    siteId: row.siteId,
    filename: row.filename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    alt: row.alt,
    folder: row.folder,
    url: assetUrl(row.id, row.filename),
    createdAt: row.createdAt.toISOString(),
  };
}

export class AssetService {
  constructor(
    private readonly db: Db,
    private readonly storage: ObjectStorage,
    private readonly maxBytes: number,
  ) {}

  async list(siteId: string): Promise<AssetRecord[]> {
    const rows = await this.db.select().from(assets).where(and(eq(assets.siteId, siteId), isNull(assets.deletedAt))).orderBy(desc(assets.createdAt));
    return rows.map(toRecord);
  }

  async upload(ownerId: string, siteId: string, input: { filename: string; data: Buffer; alt?: string; folder?: string }, ip?: string): Promise<AssetRecord> {
    if (!input.data.length) throw badRequest("The file is empty");
    if (input.data.length > this.maxBytes) throw badRequest(`Images must be smaller than ${Math.round(this.maxBytes / 1024 / 1024)} MB`);
    const info = sniffImage(input.data);
    if (!info) throw badRequest("Only PNG, JPEG, WebP and GIF images are supported");
    if (info.width > 12000 || info.height > 12000) throw badRequest("Image dimensions are too large (max 12000px)");
    const usage = await this.db
      .select({ n: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${assets.byteSize}),0)::bigint` })
      .from(assets)
      .where(and(eq(assets.siteId, siteId), isNull(assets.deletedAt)));
    if ((usage[0]?.n ?? 0) >= MAX_ASSETS_PER_SITE) throw badRequest("This website has reached its media limit");
    if (Number(usage[0]?.bytes ?? 0) + input.data.length > MAX_TOTAL_BYTES_PER_SITE) throw badRequest("This website has reached its storage limit");

    const id = newId("ast");
    const filename = safeFilename(input.filename, EXT_BY_TYPE[info.mimeType]);
    const key = `${siteId}/${id}/${filename}`;
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    await this.storage.put(key, input.data, info.mimeType);
    await this.db.insert(assets).values({
      id,
      ownerId,
      siteId,
      filename,
      mimeType: info.mimeType,
      byteSize: input.data.length,
      width: info.width,
      height: info.height,
      alt: (input.alt ?? "").slice(0, 200),
      folder: (input.folder ?? "").slice(0, 60),
      storage: this.storage.name,
      storageKey: key,
      sha256,
    });
    await audit(this.db, { actorId: ownerId, siteId, action: "asset.uploaded", details: { id, bytes: input.data.length, mimeType: info.mimeType }, ip });
    const row = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return toRecord(row[0]!);
  }

  async update(siteId: string, assetId: string, patch: { alt?: string; folder?: string }): Promise<AssetRecord> {
    const rows = await this.db.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.siteId, siteId), isNull(assets.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Image not found");
    await this.db
      .update(assets)
      .set({ ...(patch.alt !== undefined ? { alt: patch.alt.slice(0, 200) } : {}), ...(patch.folder !== undefined ? { folder: patch.folder.slice(0, 60) } : {}) })
      .where(eq(assets.id, assetId));
    const after = await this.db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    return toRecord(after[0]!);
  }

  /** Soft-delete the record and remove the bytes. Published pages keep working only if they no longer reference it (the editor warns when an image is in use). */
  async delete(ownerId: string, siteId: string, assetId: string, ip?: string): Promise<void> {
    const rows = await this.db.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.siteId, siteId), isNull(assets.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Image not found");
    await this.db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, assetId));
    await this.storage.delete(rows[0].storageKey);
    await audit(this.db, { actorId: ownerId, siteId, action: "asset.deleted", details: { id: assetId }, ip });
  }

  /** Public read: anyone with the unguessable URL may fetch a live asset of a live (non-deleted) site. */
  async readPublic(assetId: string): Promise<{ data: Buffer; mimeType: string; filename: string } | null> {
    const rows = await this.db
      .select({ asset: assets })
      .from(assets)
      .innerJoin(sites, eq(sites.id, assets.siteId))
      .where(and(eq(assets.id, assetId), isNull(assets.deletedAt), isNull(sites.deletedAt)))
      .limit(1);
    const row = rows[0]?.asset;
    if (!row) return null;
    const data = await this.storage.get(row.storageKey);
    if (!data) return null;
    return { data, mimeType: row.mimeType, filename: row.filename };
  }
}
