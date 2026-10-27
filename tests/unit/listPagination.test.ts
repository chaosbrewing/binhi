import { describe, expect, it } from "vitest";
import { clampVisibleCount, initialVisibleCount, LIST_PAGE_SIZE, nextVisibleCount, visibleSlice } from "../../src/client/studio/listPagination.js";

describe("list pagination helpers", () => {
  it("starts with one page or fewer when the list is short", () => {
    expect(initialVisibleCount(0)).toBe(0);
    expect(initialVisibleCount(5)).toBe(5);
    expect(initialVisibleCount(60)).toBe(LIST_PAGE_SIZE);
  });

  it("grows visible count in fixed pages and caps at the total", () => {
    expect(nextVisibleCount(0, 100)).toBe(LIST_PAGE_SIZE);
    expect(nextVisibleCount(LIST_PAGE_SIZE, 100)).toBe(LIST_PAGE_SIZE * 2);
    expect(nextVisibleCount(96, 100)).toBe(100);
  });

  it("clamps visible count when the list size changes", () => {
    expect(clampVisibleCount(48, 120)).toBe(48);
    expect(clampVisibleCount(3, 120)).toBe(LIST_PAGE_SIZE);
    expect(clampVisibleCount(300, 90)).toBe(90);
    expect(clampVisibleCount(17, 0)).toBe(0);
  });

  it("accepts custom page sizes and ignores invalid page sizes", () => {
    expect(initialVisibleCount(20, 10)).toBe(10);
    expect(nextVisibleCount(10, 30, 5)).toBe(15);
    expect(initialVisibleCount(20, -5)).toBe(20);
  });

  it("slices rows to the requested visible range", () => {
    const rows = ["a", "b", "c", "d"];
    expect(visibleSlice(rows, 2)).toEqual(["a", "b"]);
    expect(visibleSlice(rows, 0)).toEqual([]);
    expect(visibleSlice(rows, 99)).toEqual(rows);
  });
});
