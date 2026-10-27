import type { SiteSummary } from "../api.js";

export function PublicationBadge({ site }: { site: { publication: SiteSummary["publication"]; livePublicationId: string | null; revision: number } }) {
  const p = site.publication;
  if (site.livePublicationId && p?.isLive) {
    const stale = p.revision < site.revision;
    return <span className={`badge ${stale ? "badge-warn" : "badge-ok"}`}>{stale ? "Live · unpublished changes" : "Live"}</span>;
  }
  if (p?.state === "failed") return <span className="badge badge-danger">Last publish failed</span>;
  if (p && ["pending", "building", "deploying"].includes(p.state)) return <span className="badge badge-warn">Publishing…</span>;
  return <span className="badge">Draft</span>;
}
