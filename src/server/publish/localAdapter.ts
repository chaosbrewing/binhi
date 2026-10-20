import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { publishedPages, sites } from "../db/schema.js";
import type { RenderedPage } from "../../core/index.js";
import type { PublishingAdapter, PublishTarget } from "./adapter.js";

/**
 * Standalone adapter: published HTML is stored in Postgres and served by
 * BINHI itself at /s/<slug>/. No external provider, no wildcard DNS needed.
 */
export class LocalPublishingAdapter implements PublishingAdapter {
  readonly name = "local";
  constructor(
    private readonly db: Db,
    private readonly publicUrl = "",
  ) {}

  siteUrl(slug: string): string {
    return `${this.publicUrl}/s/${slug}/`;
  }

  async deploy(target: PublishTarget, pages: RenderedPage[]): Promise<{ url: string }> {
    await this.db.transaction(async (tx) => {
      await tx.delete(publishedPages).where(eq(publishedPages.publicationId, target.publicationId));
      for (const p of pages) {
        await tx.insert(publishedPages).values({ publicationId: target.publicationId, path: p.path, pageId: p.pageId, html: p.html });
      }
    });
    return { url: this.siteUrl(target.slug) };
  }

  async activate(target: PublishTarget): Promise<void> {
    await this.db.update(sites).set({ livePublicationId: target.publicationId }).where(eq(sites.id, target.siteId));
  }

  async retract(target: PublishTarget): Promise<void> {
    await this.db.update(sites).set({ livePublicationId: null }).where(eq(sites.id, target.siteId));
  }
}
