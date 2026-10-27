import { describe, expect, it } from "vitest";
import type { LibraryAsset } from "../../src/client/api.js";
import { filterAndSortLibraryAssets } from "../../src/client/studio/libraryList.js";

function asset(overrides: Partial<LibraryAsset>): LibraryAsset {
  return {
    id: "asset_1",
    filename: "hero-image.png",
    mimeType: "image/png",
    byteSize: 150_000,
    width: 1200,
    height: 800,
    alt: "Hero banner",
    tags: "homepage,green",
    origin: "upload",
    sha256: "abc",
    url: "https://example.com/hero-image.png",
    createdAt: "2026-10-20T00:00:00.000Z",
    usedBy: [],
    ...overrides,
  };
}

describe("libraryList helpers", () => {
  it("filters by query across filename, tags, alt text and usage names", () => {
    const assets = [
      asset({ id: "hero", filename: "hero.png", tags: "homepage", usedBy: [{ id: "prj_1", name: "Landing Redesign", kind: "design" }] }),
      asset({ id: "logo", filename: "logo.png", tags: "brand", alt: "Primary logo" }),
    ];

    const byTag = filterAndSortLibraryAssets(assets, { query: "home", usage: "all", sort: "newest" });
    const byUsage = filterAndSortLibraryAssets(assets, { query: "landing", usage: "all", sort: "newest" });

    expect(byTag.map((entry) => entry.id)).toEqual(["hero"]);
    expect(byUsage.map((entry) => entry.id)).toEqual(["hero"]);
  });

  it("applies usage filter for used and unused files", () => {
    const assets = [
      asset({ id: "used", usedBy: [{ id: "photo_1", name: "Profile Photo", kind: "photo" }] }),
      asset({ id: "unused", usedBy: [] }),
    ];

    const used = filterAndSortLibraryAssets(assets, { query: "", usage: "used", sort: "newest" });
    const unused = filterAndSortLibraryAssets(assets, { query: "", usage: "unused", sort: "newest" });

    expect(used.map((entry) => entry.id)).toEqual(["used"]);
    expect(unused.map((entry) => entry.id)).toEqual(["unused"]);
  });

  it("sorts by size and created date", () => {
    const assets = [
      asset({ id: "small", filename: "small.png", byteSize: 1_000, createdAt: "2026-10-20T00:00:00.000Z" }),
      asset({ id: "large", filename: "large.png", byteSize: 5_000, createdAt: "2026-10-22T00:00:00.000Z" }),
      asset({ id: "mid", filename: "mid.png", byteSize: 3_000, createdAt: "2026-10-21T00:00:00.000Z" }),
    ];

    const largestFirst = filterAndSortLibraryAssets(assets, { query: "", usage: "all", sort: "size-desc" });
    const newestFirst = filterAndSortLibraryAssets(assets, { query: "", usage: "all", sort: "newest" });

    expect(largestFirst.map((entry) => entry.id)).toEqual(["large", "mid", "small"]);
    expect(newestFirst.map((entry) => entry.id)).toEqual(["large", "mid", "small"]);
  });
});
