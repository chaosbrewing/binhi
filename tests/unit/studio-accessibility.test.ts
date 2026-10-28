import { describe, expect, it } from "vitest";
import { nextProjectFilter, projectResultsLiveMessage } from "../../src/client/studio/ProjectsPage.js";
import { libraryResultsLiveMessage } from "../../src/client/studio/LibraryPage.js";
import { libraryPickerLiveMessage } from "../../src/client/studio/LibraryPicker.js";
import { navigationItems, navigationOwner, STUDIO_NAVIGATION } from "../../src/client/studio/navigation.js";

describe("DIR-002 navigation contract", () => {
  it("exposes the approved groups and labels without the shelved video editor", () => {
    expect(STUDIO_NAVIGATION.map((section) => section.label)).toEqual(["Workspace", "Create", "Resources"]);
    expect(STUDIO_NAVIGATION[0]?.items.map((item) => item.label)).toEqual(["Today", "Projects", "Recent"]);
    expect(STUDIO_NAVIGATION[1]?.items.map((item) => item.label)).toEqual([
      "Website Builder", "Design Studio", "Photo Editor", "Form Creator", "PDF Editor",
      "File Converter", "Image Compressor", "Templates",
    ]);
    expect(STUDIO_NAVIGATION[2]?.items.map((item) => item.label)).toEqual(["Brand Kits", "Assets", "Settings"]);
    expect(navigationItems.some((item) => /video/i.test(item.label))).toBe(false);
  });

  it("owns deep links and marks unfinished capabilities as planned", () => {
    expect(navigationOwner("/sites/site_123/edit")?.label).toBe("Website Builder");
    expect(navigationOwner("/studio/design/prj_123")?.label).toBe("Design Studio");
    expect(navigationOwner("/studio/compress")?.label).toBe("Image Compressor");
    expect(navigationItems.filter((item) => item.availability === "planned").map((item) => item.label)).toEqual([
      "Form Creator", "PDF Editor", "File Converter",
    ]);
  });
});

describe("project filter keyboard navigation", () => {
  it("moves to adjacent filters and wraps at both ends", () => {
    expect(nextProjectFilter("all", "ArrowRight")).toBe("website");
    expect(nextProjectFilter("design-template", "ArrowRight")).toBe("all");
    expect(nextProjectFilter("all", "ArrowLeft")).toBe("design-template");
    expect(nextProjectFilter("website", "ArrowUp")).toBe("all");
    expect(nextProjectFilter("website", "ArrowDown")).toBe("photo");
  });

  it("supports home/end and ignores unrelated keys", () => {
    expect(nextProjectFilter("design", "Home")).toBe("all");
    expect(nextProjectFilter("all", "End")).toBe("design-template");
    expect(nextProjectFilter("all", "Enter")).toBeNull();
  });
});

describe("projects page live messages", () => {
  it("announces loading, errors, empty states and result counts", () => {
    const loading = projectResultsLiveMessage({ loading: true, error: null, filter: "all", count: 0 });
    const errored = projectResultsLiveMessage({ loading: false, error: "boom", filter: "all", count: 0 });
    const emptyDesign = projectResultsLiveMessage({ loading: false, error: null, filter: "design", count: 0 });
    const populated = projectResultsLiveMessage({ loading: false, error: null, filter: "photo", count: 2 });

    expect(loading).toContain("Loading");
    expect(errored).toContain("Could not load");
    expect(emptyDesign).toContain("No design projects");
    expect(populated).toBe("Showing 2 photo projects.");
  });
});

describe("library live messages", () => {
  it("announces page states for screen readers", () => {
    const oneAsset = [{ id: "asset-1" }] as any;
    expect(libraryResultsLiveMessage({ assets: null, error: null, busy: false })).toContain("Loading");
    expect(libraryResultsLiveMessage({ assets: null, error: "bad", busy: false })).toContain("Could not load");
    expect(libraryResultsLiveMessage({ assets: [], error: null, busy: false })).toContain("No images");
    expect(libraryResultsLiveMessage({ assets: oneAsset, error: null, busy: false })).toContain("1 image");
  });

  it("announces picker states for screen readers", () => {
    const oneAsset = [{ id: "asset-1" }] as any;
    expect(libraryPickerLiveMessage({ assets: null, error: null, busy: false })).toContain("Loading");
    expect(libraryPickerLiveMessage({ assets: null, error: "bad", busy: false })).toContain("Could not load");
    expect(libraryPickerLiveMessage({ assets: [], error: null, busy: false })).toContain("No images");
    expect(libraryPickerLiveMessage({ assets: oneAsset, error: null, busy: false })).toContain("1 image");
  });
});

