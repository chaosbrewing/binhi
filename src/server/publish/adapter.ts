import type { RenderedPage } from "../../core/index.js";

/**
 * Provider-independent publishing contract.
 *
 * Standalone BINHI uses the local adapter (pages served by this app under
 * /s/<slug>/). When BINHI runs inside ORIGIN, a LIYAB adapter implements the
 * same contract and performs approved deployment operations. Exactly one
 * adapter is authoritative for a given publication (publications.adapter).
 */
export interface PublishTarget {
  publicationId: string;
  siteId: string;
  slug: string;
}

export interface PublishingAdapter {
  readonly name: string;
  /** Public base URL of the site for this slug (with trailing slash). */
  siteUrl(slug: string): string;
  /** Make the rendered pages available at the target. Must be idempotent per publicationId. */
  deploy(target: PublishTarget, pages: RenderedPage[]): Promise<{ url: string }>;
  /** Point the public slug at this publication (after verification). */
  activate(target: PublishTarget): Promise<void>;
  /** Stop serving the slug (unpublish). Artifacts may be retained for rollback. */
  retract(target: PublishTarget): Promise<void>;
}
