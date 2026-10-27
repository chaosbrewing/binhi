import { describe, expect, it } from "vitest";
import {
  applyLibraryViewState,
  applyProjectsViewState,
  parseLibraryViewState,
  parseProjectsViewState,
} from "../../src/client/studio/viewState.js";

describe("project view state query params", () => {
  it("parses valid query params and ignores invalid enum values", () => {
    const state = parseProjectsViewState(new URLSearchParams("q=%20%20summer%20campaign%20&filter=unknown&sort=name-desc"));
    expect(state).toEqual({
      search: "summer campaign",
      filter: "all",
      sort: "name-desc",
    });
  });

  it("syncs state while preserving unrelated query params", () => {
    const next = applyProjectsViewState(
      new URLSearchParams("tab=recent&filter=photo"),
      { search: "banner", filter: "design", sort: "updated-desc" },
    );
    expect(next.toString()).toBe("tab=recent&filter=design&q=banner");
  });

  it("drops default params from the URL", () => {
    const next = applyProjectsViewState(
      new URLSearchParams("q=old&filter=design&sort=name-asc"),
      { search: "", filter: "all", sort: "updated-desc" },
    );
    expect(next.toString()).toBe("");
  });
});

describe("library view state query params", () => {
  it("parses known values and falls back to defaults for unknown values", () => {
    const state = parseLibraryViewState(new URLSearchParams("q=logo&filter=weird&sort=largest"));
    expect(state).toEqual({
      search: "logo",
      filter: "all",
      sort: "largest",
    });
  });

  it("normalizes search text and keeps unrelated params when syncing", () => {
    const next = applyLibraryViewState(
      new URLSearchParams("ref=mail&q=before"),
      { search: "  hero   image ", filter: "used", sort: "name-asc" },
    );
    expect(next.toString()).toBe("ref=mail&q=hero+image&filter=used&sort=name-asc");
  });

  it("removes view params when all values are defaults", () => {
    const next = applyLibraryViewState(
      new URLSearchParams("q=logo&filter=used&sort=smallest&x=1"),
      { search: "", filter: "all", sort: "recent" },
    );
    expect(next.toString()).toBe("x=1");
  });
});
