import type { ProjectSummary, SiteSummary } from "../api.js";

export type ProjectFilter = "all" | "website" | "photo" | "design" | "design-template";
export type ProjectSort = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";

export type ProjectRow =
  | { kind: "website"; site: SiteSummary; project: null; updatedAt: string }
  | { kind: ProjectSummary["kind"]; site: null; project: ProjectSummary; updatedAt: string };

const textSort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

function rowName(row: ProjectRow): string {
  return row.site ? row.site.name : row.project.name;
}

function rowSearchText(row: ProjectRow): string {
  if (row.site) return `${row.site.name} ${row.site.slug}`;
  return `${row.project.name} ${row.project.kind}`;
}

export function buildProjectRows(sites: SiteSummary[], projects: ProjectSummary[]): ProjectRow[] {
  return [
    ...sites.map((site) => ({ kind: "website" as const, site, project: null, updatedAt: site.updatedAt })),
    ...projects.map((project) => ({ kind: project.kind, site: null, project, updatedAt: project.updatedAt })),
  ];
}

export function projectCounts(sites: SiteSummary[], projects: ProjectSummary[]): Record<ProjectFilter, number> {
  return {
    all: sites.length + projects.length,
    website: sites.length,
    photo: projects.filter((project) => project.kind === "photo").length,
    design: projects.filter((project) => project.kind === "design").length,
    "design-template": projects.filter((project) => project.kind === "design-template").length,
  };
}

export function filterAndSortProjectRows(
  rows: ProjectRow[],
  options: { filter: ProjectFilter; query: string; sort: ProjectSort },
): ProjectRow[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const filtered = rows
    .filter((row) => options.filter === "all" || row.kind === options.filter)
    .filter((row) => normalizedQuery.length === 0 || rowSearchText(row).toLowerCase().includes(normalizedQuery));
  return [...filtered].sort((a, b) => {
    if (options.sort === "updated-asc") return a.updatedAt.localeCompare(b.updatedAt) || textSort(rowName(a), rowName(b));
    if (options.sort === "name-asc") return textSort(rowName(a), rowName(b)) || b.updatedAt.localeCompare(a.updatedAt);
    if (options.sort === "name-desc") return textSort(rowName(b), rowName(a)) || b.updatedAt.localeCompare(a.updatedAt);
    return b.updatedAt.localeCompare(a.updatedAt) || textSort(rowName(a), rowName(b));
  });
}
