import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { brandKits } from "../db/schema.js";
import { newId } from "../../core/ids.js";
import { BRAND_KIT_LIMITS, BrandKitDocument, brandKitAssetIds } from "../../core/creative/index.js";
import { badRequest, conflict, notFound } from "../security/errors.js";
import { audit } from "../audit.js";
import type { LibraryService } from "./library.js";

export interface BrandKitRecord {
  id: string;
  name: string;
  document: BrandKitDocument;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: typeof brandKits.$inferSelect): BrandKitRecord {
  return { id: row.id, name: row.name, document: row.document as BrandKitDocument, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export class BrandKitService {
  constructor(
    private readonly db: Db,
    private readonly library: LibraryService,
  ) {}

  async list(ownerId: string): Promise<BrandKitRecord[]> {
    const rows = await this.db.select().from(brandKits).where(and(eq(brandKits.ownerId, ownerId), isNull(brandKits.deletedAt))).orderBy(desc(brandKits.updatedAt));
    return rows.map(toRecord);
  }

  async get(ownerId: string, kitId: string): Promise<BrandKitRecord> {
    const rows = await this.db.select().from(brandKits).where(and(eq(brandKits.id, kitId), eq(brandKits.ownerId, ownerId), isNull(brandKits.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Brand kit not found");
    return toRecord(rows[0]);
  }

  private async assertAssets(ownerId: string, document: BrandKitDocument): Promise<void> {
    for (const assetId of brandKitAssetIds(document)) await this.library.getOwned(ownerId, assetId);
  }

  async create(ownerId: string, input: { name: string; document: unknown }, ip?: string): Promise<BrandKitRecord> {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw badRequest("Give your brand kit a name");
    const document = BrandKitDocument.parse(input.document);
    await this.assertAssets(ownerId, document);
    const count = await this.db.select({ n: sql<number>`count(*)::int` }).from(brandKits).where(and(eq(brandKits.ownerId, ownerId), isNull(brandKits.deletedAt)));
    if ((count[0]?.n ?? 0) >= BRAND_KIT_LIMITS.maxKits) throw conflict(`You can have up to ${BRAND_KIT_LIMITS.maxKits} brand kits`);
    const id = newId("kit");
    await this.db.insert(brandKits).values({ id, ownerId, name, document, schemaVersion: document.schemaVersion });
    await audit(this.db, { actorId: ownerId, action: "brandkit.created", details: { id }, ip });
    return this.get(ownerId, id);
  }

  async update(ownerId: string, kitId: string, input: { name?: string; document?: unknown }, ip?: string): Promise<BrandKitRecord> {
    await this.get(ownerId, kitId);
    const set: Partial<typeof brandKits.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const name = input.name.trim().slice(0, 80);
      if (!name) throw badRequest("Give your brand kit a name");
      set.name = name;
    }
    if (input.document !== undefined) {
      const document = BrandKitDocument.parse(input.document);
      await this.assertAssets(ownerId, document);
      set.document = document;
    }
    await this.db.update(brandKits).set(set).where(eq(brandKits.id, kitId));
    await audit(this.db, { actorId: ownerId, action: "brandkit.updated", details: { id: kitId }, ip });
    return this.get(ownerId, kitId);
  }

  async softDelete(ownerId: string, kitId: string, ip?: string): Promise<void> {
    await this.get(ownerId, kitId);
    await this.db.update(brandKits).set({ deletedAt: new Date() }).where(eq(brandKits.id, kitId));
    await audit(this.db, { actorId: ownerId, action: "brandkit.deleted", details: { id: kitId }, ip });
  }
}
