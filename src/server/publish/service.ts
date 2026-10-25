import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { publications, publishedPages, siteRevisions, sites, type PublicationState } from "../db/schema.js";
import { renderAllPages, validateForPublish, type SiteDocument, type ValidationIssue } from "../../core/index.js";
import { newId } from "../../core/ids.js";
import { resolveIconShapeSync } from "../../core/icons/shapes-all.js";
import { badRequest, conflict, notFound } from "../security/errors.js";
import type { PublishingAdapter } from "./adapter.js";
import { audit } from "../audit.js";

export interface PublicationSummary {
  id: string;
  siteId: string;
  revision: number;
  state: PublicationState;
  adapter: string;
  slug: string;
  url: string | null;
  pageCount: number;
  error: string | null;
  createdAt: string;
  verifiedAt: string | null;
  endedAt: string | null;
  isLive: boolean;
}

export interface PublishOptions {
  publicUrl: string;
  verifyBaseUrl: string;
  fetchImpl: typeof fetch;
}

export const VERIFY_HEADER = "x-binhi-verify";
export const RUNTIME_PATH = "/s/_binhi/runtime.js";

export class PublishService {
  constructor(
    private readonly db: Db,
    private readonly adapter: PublishingAdapter,
    private readonly opts: PublishOptions,
  ) {}

  siteUrl(slug: string): string {
    return `${this.opts.publicUrl}/s/${slug}/`;
  }

  private toSummary(row: typeof publications.$inferSelect, livePublicationId: string | null): PublicationSummary {
    return {
      id: row.id,
      siteId: row.siteId,
      revision: row.revision,
      state: row.state,
      adapter: row.adapter,
      slug: row.slug,
      url: row.url,
      pageCount: row.pageCount,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      isLive: row.id === livePublicationId,
    };
  }

  private async ownedSite(ownerId: string, siteId: string) {
    const rows = await this.db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Site not found");
    return rows[0];
  }

  async validate(ownerId: string, siteId: string) {
    const site = await this.ownedSite(ownerId, siteId);
    return validateForPublish(site.document as SiteDocument);
  }

  /**
   * Publish the current draft:
   * pending → building (render) → deploying (adapter) → verify public endpoint → live.
   * The previously live publication keeps serving until verification succeeds.
   */
  async publish(ownerId: string, siteId: string, ip?: string): Promise<{ publication: PublicationSummary; warnings: ValidationIssue[] }> {
    const site = await this.ownedSite(ownerId, siteId);
    const doc = site.document as SiteDocument;
    const report = validateForPublish(doc);
    if (!report.ok) throw badRequest(report.errors[0]!.message, report.errors);

    const inFlight = await this.db.select({ id: publications.id }).from(publications).where(and(eq(publications.siteId, siteId), inArray(publications.state, ["pending", "building", "deploying"]))).limit(1);
    if (inFlight[0]) throw conflict("A publication is already in progress");

    const snapshot = await this.db.select({ id: siteRevisions.id }).from(siteRevisions).where(and(eq(siteRevisions.siteId, siteId), eq(siteRevisions.revision, site.revision))).limit(1);
    if (!snapshot[0]) throw conflict("The current revision has no snapshot; save again and retry");
    await this.db.update(siteRevisions).set({ kind: "publish", label: "Published" }).where(eq(siteRevisions.id, snapshot[0].id));

    const id = newId("pub");
    const target = { publicationId: id, siteId, slug: site.slug };
    await this.db.insert(publications).values({ id, siteId, revision: site.revision, revisionId: snapshot[0].id, state: "pending", adapter: this.adapter.name, slug: site.slug, requestedBy: ownerId });
    await audit(this.db, { actorId: ownerId, siteId, action: "publish.requested", details: { publicationId: id, revision: site.revision }, ip });

    const setState = (state: PublicationState, extra: Partial<typeof publications.$inferInsert> = {}) => this.db.update(publications).set({ state, ...extra }).where(eq(publications.id, id));

    try {
      await setState("building");
      const pages = renderAllPages(doc, {
        mode: "publish",
        baseHref: `/s/${site.slug}/`,
        runtimeHref: RUNTIME_PATH,
        publicationId: id,
        formAction: (formId) => `/s/${site.slug}/__form/${formId}`,
        iconShape: resolveIconShapeSync,
      });
      await setState("deploying", { pageCount: pages.length });
      await this.adapter.deploy(target, pages);
      await this.verify(site.slug, id);
      const previousLive = site.livePublicationId;
      await this.adapter.activate(target);
      await setState("live", { url: this.siteUrl(site.slug), verifiedAt: new Date() });
      if (previousLive && previousLive !== id) {
        await this.db.update(publications).set({ state: "superseded", endedAt: new Date() }).where(and(eq(publications.id, previousLive), eq(publications.state, "live")));
      }
      await audit(this.db, { actorId: ownerId, siteId, action: "publish.live", details: { publicationId: id }, ip });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await setState("failed", { error: message.slice(0, 1000), endedAt: new Date() });
      await audit(this.db, { actorId: ownerId, siteId, action: "publish.failed", details: { publicationId: id, error: message.slice(0, 300) }, ip });
    }
    const pub = await this.getById(id);
    return { publication: pub!, warnings: report.warnings };
  }

  /** Fetch the not-yet-live publication through the public route and confirm it is the one we built. */
  private async verify(slug: string, publicationId: string): Promise<void> {
    const url = `${this.opts.verifyBaseUrl}/s/${slug}/`;
    let res: Response;
    try {
      res = await this.opts.fetchImpl(url, { headers: { [VERIFY_HEADER]: publicationId }, redirect: "manual" });
    } catch (e) {
      throw new Error(`Could not reach the published site at ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.status !== 200) throw new Error(`Published site responded with HTTP ${res.status} at ${url}`);
    const html = await res.text();
    if (!html.includes(`<meta name="binhi-publication" content="${publicationId}">`)) throw new Error("Published page did not match the publication that was built");
  }

  async unpublish(ownerId: string, siteId: string, ip?: string): Promise<PublicationSummary | null> {
    const site = await this.ownedSite(ownerId, siteId);
    if (!site.livePublicationId) return null;
    const id = site.livePublicationId;
    await this.adapter.retract({ publicationId: id, siteId, slug: site.slug });
    await this.db.update(publications).set({ state: "unpublished", endedAt: new Date() }).where(eq(publications.id, id));
    await audit(this.db, { actorId: ownerId, siteId, action: "publish.unpublished", details: { publicationId: id }, ip });
    return this.getById(id);
  }

  /** Make an earlier publication live again (its pages are still stored). */
  async rollback(ownerId: string, siteId: string, publicationId: string, ip?: string): Promise<PublicationSummary> {
    const site = await this.ownedSite(ownerId, siteId);
    const rows = await this.db.select().from(publications).where(and(eq(publications.id, publicationId), eq(publications.siteId, siteId))).limit(1);
    const target = rows[0];
    if (!target) throw notFound("Publication not found");
    if (target.state !== "superseded" && target.state !== "unpublished") throw badRequest("Only earlier successful publications can be restored");
    if (target.slug !== site.slug) throw badRequest("This publication was made under a different web address; publish again instead");
    const pages = await this.db.select({ path: publishedPages.path }).from(publishedPages).where(eq(publishedPages.publicationId, publicationId)).limit(1);
    if (!pages[0]) throw badRequest("The files for this publication are no longer available");
    await this.verify(site.slug, publicationId);
    const previousLive = site.livePublicationId;
    await this.adapter.activate({ publicationId, siteId, slug: site.slug });
    await this.db.update(publications).set({ state: "live", endedAt: null, verifiedAt: new Date(), error: null }).where(eq(publications.id, publicationId));
    if (previousLive && previousLive !== publicationId) await this.db.update(publications).set({ state: "superseded", endedAt: new Date() }).where(eq(publications.id, previousLive));
    await audit(this.db, { actorId: ownerId, siteId, action: "publish.rolled_back", details: { publicationId, previousLive }, ip });
    return (await this.getById(publicationId))!;
  }

  async getById(id: string): Promise<PublicationSummary | null> {
    const rows = await this.db.select({ pub: publications, live: sites.livePublicationId }).from(publications).innerJoin(sites, eq(sites.id, publications.siteId)).where(eq(publications.id, id)).limit(1);
    return rows[0] ? this.toSummary(rows[0].pub, rows[0].live) : null;
  }

  async latest(siteId: string): Promise<PublicationSummary | null> {
    const rows = await this.db.select({ pub: publications, live: sites.livePublicationId }).from(publications).innerJoin(sites, eq(sites.id, publications.siteId)).where(eq(publications.siteId, siteId)).orderBy(desc(publications.createdAt)).limit(1);
    return rows[0] ? this.toSummary(rows[0].pub, rows[0].live) : null;
  }

  async latestForSites(siteIds: string[]): Promise<Map<string, PublicationSummary>> {
    const out = new Map<string, PublicationSummary>();
    if (!siteIds.length) return out;
    const rows = await this.db.select({ pub: publications, live: sites.livePublicationId }).from(publications).innerJoin(sites, eq(sites.id, publications.siteId)).where(inArray(publications.siteId, siteIds)).orderBy(desc(publications.createdAt));
    for (const r of rows) if (!out.has(r.pub.siteId)) out.set(r.pub.siteId, this.toSummary(r.pub, r.live));
    return out;
  }

  async history(ownerId: string, siteId: string): Promise<PublicationSummary[]> {
    const site = await this.ownedSite(ownerId, siteId);
    const rows = await this.db.select().from(publications).where(eq(publications.siteId, siteId)).orderBy(desc(publications.createdAt)).limit(50);
    return rows.map((r) => this.toSummary(r, site.livePublicationId));
  }

  /** Resolve what to serve for a public request. */
  async resolvePublic(slug: string, verifyId?: string): Promise<{ siteId: string; publicationId: string; revisionId: string } | null> {
    const rows = await this.db.select({ id: sites.id, live: sites.livePublicationId }).from(sites).where(and(eq(sites.slug, slug), isNull(sites.deletedAt))).limit(1);
    const site = rows[0];
    if (!site) return null;
    const pubId = verifyId ?? site.live;
    if (!pubId) return null;
    const pub = await this.db.select({ id: publications.id, revisionId: publications.revisionId, siteId: publications.siteId }).from(publications).where(and(eq(publications.id, pubId), eq(publications.siteId, site.id))).limit(1);
    if (!pub[0]) return null;
    return { siteId: site.id, publicationId: pub[0].id, revisionId: pub[0].revisionId };
  }

  async readPage(publicationId: string, path: string): Promise<string | null> {
    const rows = await this.db.select({ html: publishedPages.html }).from(publishedPages).where(and(eq(publishedPages.publicationId, publicationId), eq(publishedPages.path, path))).limit(1);
    return rows[0]?.html ?? null;
  }

  async publishedDocument(revisionId: string): Promise<SiteDocument | null> {
    const rows = await this.db.select({ document: siteRevisions.document }).from(siteRevisions).where(eq(siteRevisions.id, revisionId)).limit(1);
    return (rows[0]?.document as SiteDocument) ?? null;
  }
}
