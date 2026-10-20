import { describe, it, expect } from "vitest";
import { snapMove, resizePlacement, dropIndex, normalizeAngle, angleFrom, unionRect } from "../../src/client/editor/canvas/geometry.js";

describe("canvas geometry", () => {
  it("snaps a moving box to the parent centre and sibling edges within the threshold", () => {
    const parent = { width: 1000, height: 600 };
    const r = snapMove({ x: 447, y: 100, width: 100, height: 50 }, parent, [], 6);
    expect(r.x).toBe(450); // centre of box at 500 = parent centre
    expect(r.guides.map((g) => g.axis)).toEqual(["x"]);
    const s = snapMove({ x: 300, y: 203, width: 100, height: 50 }, parent, [{ x: 100, y: 200, width: 80, height: 40 }], 6);
    expect(s.y).toBe(200);
    expect(s.guides.find((g) => g.axis === "y")?.at).toBe(200);
    const none = snapMove({ x: 300, y: 310, width: 100, height: 50 }, parent, [], 6);
    expect(none).toMatchObject({ x: 300, y: 310, guides: [] });
    const disabled = snapMove({ x: 447, y: 100, width: 100, height: 50 }, parent, [], 6, false);
    expect(disabled.x).toBe(447);
  });

  it("resizes from any handle keeping the opposite edge fixed, with optional aspect lock", () => {
    const start = { x: 100, y: 100, width: 200, height: 100, rotation: 0, z: 0 };
    expect(resizePlacement(start, "se", 50, 20)).toMatchObject({ x: 100, y: 100, width: 250, height: 120 });
    expect(resizePlacement(start, "nw", 50, 20)).toMatchObject({ x: 150, y: 120, width: 150, height: 80 });
    expect(resizePlacement(start, "e", -300, 0).width).toBe(8); // min size
    const locked = resizePlacement(start, "e", 100, 0, { keepAspect: true });
    expect(locked.width).toBe(300);
    expect(locked.height).toBe(150);
    const lockedCorner = resizePlacement(start, "nw", -100, 0, { keepAspect: true });
    expect(lockedCorner.width).toBe(300);
    expect(lockedCorner.height).toBe(150);
    expect(lockedCorner.x).toBe(0);
  });

  it("computes drop indices by midpoints in both directions", () => {
    const rows = [{ x: 0, y: 0, width: 100, height: 50 }, { x: 0, y: 60, width: 100, height: 50 }];
    expect(dropIndex(rows, { x: 10, y: 10 }, "column")).toBe(0);
    expect(dropIndex(rows, { x: 10, y: 40 }, "column")).toBe(1);
    expect(dropIndex(rows, { x: 10, y: 200 }, "column")).toBe(2);
    const cols = [{ x: 0, y: 0, width: 100, height: 50 }, { x: 120, y: 0, width: 100, height: 50 }];
    expect(dropIndex(cols, { x: 130, y: 10 }, "row")).toBe(1);
  });

  it("normalises angles and snaps to 15° with shift", () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(22, true)).toBe(15);
    expect(Math.round(angleFrom(0, 0, 0, -10))).toBe(0);
    expect(Math.round(angleFrom(0, 0, 10, 0))).toBe(90);
  });

  it("unions rectangles", () => {
    expect(unionRect([{ x: 10, y: 10, width: 10, height: 10 }, { x: 50, y: 0, width: 10, height: 5 }])).toEqual({ x: 10, y: 0, width: 50, height: 20 });
    expect(unionRect([])).toBeNull();
  });
});
