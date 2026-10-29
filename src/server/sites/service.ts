import { and, desc, eq, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { opBatches, publications, siteRevisions, sites } from "../db/schema.js";
import { applyOperations, OperationError, createSiteDocument, getTemplate, SiteDocument, type Operation, type OperationBatch } from "../../core/index.js";
import { newId } from "../../core/ids.js";
import { badRequest, conflict, HttpError, notFound } from "../security/errors.js";
import { isValidSiteSlug, slugifySiteName } from "./slugs.js";
import { audit } from "../audit.js";

export interface SiteSummary {
  id: string;
  name: string;
  slug: string;
  templateId: string;
  revision: number;
  livePublicationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDetail extends SiteSummary {
  document: SiteDocument;
}

export interface RevisionSummary {
  id: string;
  revision: number;
  kind: string;
  label: string | null;
  summary: string[];
  createdAt: string;
}

const MAX_SITES_PER_USER = 50;
const AUTOSAVE_RETENTION = 200;

function toSummary(row: typeof sites.$inferSelect): SiteSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    templateId: row.templateId,
    revision: row.revision,
    livePublicationId: row.livePublicationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SiteService {
  constructor(private readonly db: Db) {}

  async list(ownerId: string): Promise<SiteSummary[]> {
    const rows = await this.db.select().from(sites).where(and(eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).orderBy(desc(sites.updatedAt));
    return rows.map(toSummary);
  }

  /** Loads a site the user owns, or throws 404 (never 403: existence is not revealed). */
  async getOwned(ownerId: string, siteId: string): Promise<typeof sites.$inferSelect> {
    const rows = await this.db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Site not found");
    return rows[0];
  }

  async get(ownerId: string, siteId: string): Promise<SiteDetail> {
    const row = await this.getOwned(ownerId, siteId);
    return { ...toSummary(row), document: row.document as SiteDocument };
  }

  async create(ownerId: string, input: { name: string; templateId: string; source?: { canonicalId: string; version: number } }, ip?: string): Promise<SiteDetail> {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw badRequest("Give your website a name");
    if (!getTemplate(input.templateId)) throw badRequest("Unknown template");
    const count = await this.db.select({ n: sql<number>`count(*)::int` }).from(sites).where(and(eq(sites.ownerId, ownerId), isNull(sites.deletedAt)));
    if ((count[0]?.n ?? 0) >= MAX_SITES_PER_USER) throw badRequest(`You can have up to ${MAX_SITES_PER_USER} websites`);
    const document = createSiteDocument(input.templateId, name);
    const slug = await this.uniqueSlug(slugifySiteName(name));
    const id = newId("site");
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(sites).values({ id, ownerId, name, slug, templateId: input.templateId, ...(input.source ? { sourceTemplateId: input.source.canonicalId, sourceTemplateVersion: input.source.version } : {}), document, revision: 0, createdAt: now, updatedAt: now });
      await tx.insert(siteRevisions).values({ id: newId("rev"), siteId: id, revision: 0, document, kind: "template", label: `Created from ${getTemplate(input.templateId)!.name}`, summary: [], createdBy: ownerId });
    });
    await audit(this.db, { actorId: ownerId, siteId: id, action: "site.created", details: { templateId: input.templateId, ...(input.source ? { source: input.source } : {}) }, ip });
    return this.get(ownerId, id);
  }

  async updateMeta(ownerId: string, siteId: string, patch: { name?: string; slug?: string }, ip?: string): Promise<SiteSummary> {
    const row = await this.getOwned(ownerId, siteId);
    const set: Partial<typeof sites.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, 80);
      if (!name) throw badRequest("Give your website a name");
      set.name = name;
    }
    if (patch.slug !== undefined && patch.slug !== row.slug) {
      if (row.livePublicationId) throw badRequest("Unpublish the site before changing its web address, then publish again");
      const slug = patch.slug.trim().toLowerCase();
      if (!isValidSiteSlug(slug)) throw badRequest("Use 3–40 lowercase letters, numbers and dashes. Some names are reserved.");
      const taken = await this.db.select({ id: sites.id }).from(sites).where(eq(sites.slug, slug)).limit(1);
      if (taken[0] && taken[0].id !== siteId) throw conflict("That web address is already taken");
      set.slug = slug;
    }
    await this.db.update(sites).set(set).where(eq(sites.id, siteId));
    await audit(this.db, { actorId: ownerId, siteId, action: "site.updated", details: patch, ip });
    return toSummary(await this.getOwned(ownerId, siteId));
  }

  async softDelete(ownerId: string, siteId: string, ip?: string): Promise<void> {
    await this.getOwned(ownerId, siteId);
    await this.db.update(sites).set({ deletedAt: new Date(), livePublicationId: null, updatedAt: new Date() }).where(eq(sites.id, siteId));
    await audit(this.db, { actorId: ownerId, siteId, action: "site.deleted", ip });
  }

  /**
   * Apply a validated batch of operations against the site's current draft.
   * - the site row is locked for the duration of the transaction;
   * - the batch is rejected with 409 when the client's base revision is stale;
   * - a replayed batchId is acknowledged with its original result;
   * - the whole batch applies or nothing does.
   */
  async applyBatch(ownerId: string, siteId: string, batch: OperationBatch, ip?: string): Promise<{ revision: number; document: SiteDocument; createdIds: string[]; replayed: boolean }> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).for("update").limit(1);
      const site = rows[0];
      if (!site) throw notFound("Site not found");

      const seen = await tx.select().from(opBatches).where(and(eq(opBatches.siteId, siteId), eq(opBatches.batchId, batch.batchId))).limit(1);
      if (seen[0]) {
        return { revision: site.revision, document: site.document as SiteDocument, createdIds: [], replayed: true };
      }
      if (batch.baseRevision !== site.revision) {
        throw conflict("Your copy of this website is out of date.", { serverRevision: site.revision, document: site.document });
      }
      let result;
      try {
        result = applyOperations(site.document as SiteDocument, batch.ops as Operation[]);
      } catch (e) {
        if (e instanceof OperationError) throw new HttpError(422, e.code, e.message);
        throw e;
      }
      const revision = site.revision + 1;
      const now = new Date();
      const summary = summarize(batch.ops as Operation[]);
      const kind = batch.ops.length === 1 && batch.ops[0]!.type === "replaceDocument" ? batch.ops[0]!.reason : "autosave";
      await tx.update(sites).set({ document: result.document, revision, updatedAt: now, name: result.document.name }).where(eq(sites.id, siteId));
      await tx.insert(siteRevisions).values({ id: newId("rev"), siteId, revision, document: result.document, kind, summary, createdBy: ownerId, createdAt: now });
      await tx.insert(opBatches).values({ siteId, batchId: batch.batchId, resultRevision: revision });
      // Retention: keep the last N autosaves plus anything a publication points at.
      const published = tx.select({ id: publications.revisionId }).from(publications).where(eq(publications.siteId, siteId));
      await tx
        .delete(siteRevisions)
        .where(and(eq(siteRevisions.siteId, siteId), eq(siteRevisions.kind, "autosave"), lt(siteRevisions.revision, revision - AUTOSAVE_RETENTION), notInArray(siteRevisions.id, published)));
      return { revision, document: result.document, createdIds: result.createdIds, replayed: false };
    });
  }

  async listRevisions(ownerId: string, siteId: string, limit = 100): Promise<RevisionSummary[]> {
    await this.getOwned(ownerId, siteId);
    const rows = await this.db
      .select({ id: siteRevisions.id, revision: siteRevisions.revision, kind: siteRevisions.kind, label: siteRevisions.label, summary: siteRevisions.summary, createdAt: siteRevisions.createdAt })
      .from(siteRevisions)
      .where(eq(siteRevisions.siteId, siteId))
      .orderBy(desc(siteRevisions.revision))
      .limit(limit);
    return rows.map((r) => ({ ...r, summary: r.summary as string[], createdAt: r.createdAt.toISOString() }));
  }

  async getRevisionDocument(ownerId: string, siteId: string, revision: number): Promise<SiteDocument> {
    await this.getOwned(ownerId, siteId);
    const rows = await this.db.select({ document: siteRevisions.document }).from(siteRevisions).where(and(eq(siteRevisions.siteId, siteId), eq(siteRevisions.revision, revision))).limit(1);
    if (!rows[0]) throw notFound("Revision not found");
    return rows[0].document as SiteDocument;
  }

  /** Restore = a new revision whose document equals an earlier one (history is never rewritten). */
  async restoreRevision(ownerId: string, siteId: string, revision: number, baseRevision: number, ip?: string) {
    const document = await this.getRevisionDocument(ownerId, siteId, revision);
    const result = await this.applyBatch(ownerId, siteId, { baseRevision, batchId: `restore-${revision}-${Date.now()}`, ops: [{ type: "replaceDocument", document, reason: "restore" }] }, ip);
    await this.db.update(siteRevisions).set({ label: `Restored revision ${revision}` }).where(and(eq(siteRevisions.siteId, siteId), eq(siteRevisions.revision, result.revision)));
    await audit(this.db, { actorId: ownerId, siteId, action: "site.restored", details: { fromRevision: revision, toRevision: result.revision }, ip });
    return result;
  }

  async uniqueSlug(base: string): Promise<string> {
    let candidate = isValidSiteSlug(base) ? base : `site-${base}`.slice(0, 40);
    if (!isValidSiteSlug(candidate)) candidate = `site-${newId("x").slice(2, 8)}`;
    for (let i = 0; i < 20; i++) {
      const taken = await this.db.select({ id: sites.id }).from(sites).where(eq(sites.slug, candidate)).limit(1);
      if (!taken[0]) return candidate;
      candidate = `${base.slice(0, 32)}-${newId("x").slice(2, 7)}`;
    }
    throw conflict("Could not find a free web address; try another name");
  }
}

function summarize(ops: Operation[]): string[] {
  const counts = new Map<string, number>();
  ops.forEach((o) => counts.set(o.type, (counts.get(o.type) ?? 0) + 1));
  return Array.from(counts.entries()).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t));
}
