import type { ProjectSummary } from "../api.js";

export function projectHref(p: ProjectSummary): string {
  if (p.kind === "photo") return `/studio/photo/${p.id}`;
  return `/studio/design/${p.id}`;
}
