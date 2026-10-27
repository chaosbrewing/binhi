import type { LibraryAsset } from "../api.js";

export type LibraryUsageFilter = "all" | "used" | "unused";
export type LibrarySort = "newest" | "oldest" | "name-asc" | "name-desc" | "size-desc" | "size-asc";

const textSort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

function assetSearchText(asset: LibraryAsset): string {
  return [
    asset.filename,
    asset.alt,
    asset.tags,
    asset.mimeType,
    ...asset.usedBy.map((use) => use.name),
  ].join(" ");
}

export function filterAndSortLibraryAssets(
  assets: LibraryAsset[],
  options: { query: string; usage: LibraryUsageFilter; sort: LibrarySort },
): LibraryAsset[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const filtered = assets
    .filter((asset) => {
      if (options.usage === "used") return asset.usedBy.length > 0;
      if (options.usage === "unused") return asset.usedBy.length === 0;
      return true;
    })
    .filter((asset) => normalizedQuery.length === 0 || assetSearchText(asset).toLowerCase().includes(normalizedQuery));
  return [...filtered].sort((a, b) => {
    if (options.sort === "oldest") return a.createdAt.localeCompare(b.createdAt) || textSort(a.filename, b.filename);
    if (options.sort === "name-asc") return textSort(a.filename, b.filename) || b.createdAt.localeCompare(a.createdAt);
    if (options.sort === "name-desc") return textSort(b.filename, a.filename) || b.createdAt.localeCompare(a.createdAt);
    if (options.sort === "size-desc") return b.byteSize - a.byteSize || textSort(a.filename, b.filename);
    if (options.sort === "size-asc") return a.byteSize - b.byteSize || textSort(a.filename, b.filename);
    return b.createdAt.localeCompare(a.createdAt) || textSort(a.filename, b.filename);
  });
}
