import type { Placement } from "../../../core/index.js";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: "x" | "y";
  /** Position in design coordinates. */
  at: number;
  /** Extent of the guide line (design coordinates) for drawing. */
  from: number;
  to: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

const edgesOf = (r: Rect) => ({ xs: [r.x, r.x + r.width / 2, r.x + r.width], ys: [r.y, r.y + r.height / 2, r.y + r.height] });

/**
 * Snap a moving box to the parent's edges/centre and to sibling edges/centres.
 * Pure: returns the adjusted position and the guide lines to draw.
 */
export function snapMove(moving: Rect, parent: { width: number; height: number }, siblings: Rect[], threshold: number, enabled = true): SnapResult {
  if (!enabled) return { x: moving.x, y: moving.y, guides: [] };
  const candidatesX: { at: number; from: number; to: number }[] = [
    { at: 0, from: 0, to: parent.height },
    { at: parent.width / 2, from: 0, to: parent.height },
    { at: parent.width, from: 0, to: parent.height },
  ];
  const candidatesY: { at: number; from: number; to: number }[] = [
    { at: 0, from: 0, to: parent.width },
    { at: parent.height / 2, from: 0, to: parent.width },
    { at: parent.height, from: 0, to: parent.width },
  ];
  for (const s of siblings) {
    const e = edgesOf(s);
    e.xs.forEach((x) => candidatesX.push({ at: x, from: Math.min(s.y, moving.y), to: Math.max(s.y + s.height, moving.y + moving.height) }));
    e.ys.forEach((y) => candidatesY.push({ at: y, from: Math.min(s.x, moving.x), to: Math.max(s.x + s.width, moving.x + moving.width) }));
  }
  let bestX: { delta: number; guide: Guide } | null = null;
  let bestY: { delta: number; guide: Guide } | null = null;
  const me = edgesOf(moving);
  for (const edge of me.xs) {
    for (const c of candidatesX) {
      const d = c.at - edge;
      if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) bestX = { delta: d, guide: { axis: "x", at: c.at, from: c.from, to: c.to } };
    }
  }
  for (const edge of me.ys) {
    for (const c of candidatesY) {
      const d = c.at - edge;
      if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) bestY = { delta: d, guide: { axis: "y", at: c.at, from: c.from, to: c.to } };
    }
  }
  const guides: Guide[] = [];
  if (bestX) guides.push(bestX.guide);
  if (bestY) guides.push(bestY.guide);
  return { x: moving.x + (bestX?.delta ?? 0), y: moving.y + (bestY?.delta ?? 0), guides };
}

export type HandleName = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Resize a placement by dragging a handle; keeps the opposite edge fixed. */
export function resizePlacement(start: Placement, handle: HandleName, dx: number, dy: number, opts: { keepAspect?: boolean; minSize?: number } = {}): Placement {
  const min = opts.minSize ?? 8;
  let { x, y, width, height } = start;
  if (handle.includes("e")) width = Math.max(min, start.width + dx);
  if (handle.includes("s")) height = Math.max(min, start.height + dy);
  if (handle.includes("w")) {
    width = Math.max(min, start.width - dx);
    x = start.x + (start.width - width);
  }
  if (handle.includes("n")) {
    height = Math.max(min, start.height - dy);
    y = start.y + (start.height - height);
  }
  if (opts.keepAspect && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    const horizontal = handle === "e" || handle === "w";
    const vertical = handle === "n" || handle === "s";
    if (horizontal) height = width / ratio;
    else if (vertical) width = height * ratio;
    else {
      // corner: follow the dominant axis
      if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio;
      else width = height * ratio;
    }
    if (handle.includes("w")) x = start.x + start.width - width;
    if (handle.includes("n")) y = start.y + start.height - height;
  }
  return { ...start, x: round(x), y: round(y), width: round(width), height: round(height) };
}

export function round(n: number, step = 1): number {
  return Math.round(n / step) * step;
}

export function snapToGrid(p: { x: number; y: number }, grid: number): { x: number; y: number } {
  if (!grid) return p;
  return { x: round(p.x, grid), y: round(p.y, grid) };
}

/** Angle (degrees) from a centre to a pointer. */
export function angleFrom(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
}

export function normalizeAngle(deg: number, shiftSnap = false): number {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (shiftSnap) a = Math.round(a / 15) * 15;
  return Math.round(a * 10) / 10;
}

/** Index to insert at when dropping at point `p` among children laid out in flow. */
export function dropIndex(children: Rect[], p: { x: number; y: number }, direction: "row" | "column"): number {
  for (let i = 0; i < children.length; i++) {
    const c = children[i]!;
    const mid = direction === "column" ? c.y + c.height / 2 : c.x + c.width / 2;
    const v = direction === "column" ? p.y : p.x;
    if (v < mid) return i;
  }
  return children.length;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const r = Math.max(...rects.map((r) => r.x + r.width));
  const b = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: r - x, height: b - y };
}
