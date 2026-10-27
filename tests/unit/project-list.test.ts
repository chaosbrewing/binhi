import { describe, expect, it } from "vitest";
import type { ProjectSummary, SiteSummary } from "../../src/client/api.js";
import {
  buildProjectRows,
  filterAndSortProjectRows,
  projectCounts,
} from "../../src/client/studio/projectList.js";

function site(overrides: Partial<SiteSummary>): SiteSummary {
  return {
    id: "site_1",
    name: "Luna Studio",
    slug: "luna-studio",
    templateId: "blank",
    revision: 3,
    livePublicationId: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
    publication: null,
    liveUrl: null,
    ...overrides,
  };
}

function project(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: "prj_1",
    kind: "design",
    name: "Promo Poster",
    revision: 2,
    schemaVersion: 1,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
    meta: {},
    ...overrides,
  };
}

describe("projectList helpers", () => {
  it("filters by kind and query across site names and slugs", () => {
    const sites = [
      site({ id: "site_alpha", name: "Alpha Farm", slug: "alpha-farm" }),
      site({ id: "site_river", name: "River Homes", slug: "river-homes" }),
    ];
    const projects = [project({ id: "photo_1", kind: "photo", name: "River Sunset" })];
    const rows = buildProjectRows(sites, projects);

    const result = filterAndSortProjectRows(rows, {
      filter: "website",
      query: "river",
      sort: "updated-desc",
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.site?.slug).toBe("river-homes");
  });

  it("supports case-insensitive search and name sorting", () => {
    const rows = buildProjectRows(
      [site({ id: "site_z", name: "Zulu", slug: "zulu", updatedAt: "2026-10-22T00:00:00.000Z" })],
      [
        project({ id: "design_a", kind: "design", name: "Alpha Deck", updatedAt: "2026-10-25T00:00:00.000Z" }),
        project({ id: "design_m", kind: "design-template", name: "Mango Menu", updatedAt: "2026-10-26T00:00:00.000Z" }),
      ],
    );

    const result = filterAndSortProjectRows(rows, {
      filter: "all",
      query: "A",
      sort: "name-asc",
    });

    expect(result.map((row) => (row.site ? row.site.name : row.project.name))).toEqual([
      "Alpha Deck",
      "Mango Menu",
    ]);
  });

  it("returns accurate counts by kind", () => {
    const counts = projectCounts(
      [site({ id: "site_1" }), site({ id: "site_2" })],
      [
        project({ id: "photo_1", kind: "photo" }),
        project({ id: "design_1", kind: "design" }),
        project({ id: "template_1", kind: "design-template" }),
      ],
    );

    expect(counts).toEqual({
      all: 5,
      website: 2,
      photo: 1,
      design: 1,
      "design-template": 1,
    });
  });
});
