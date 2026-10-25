import type { IconNode, IconTag } from "./types.js";

/**
 * Geometry gatekeeper. Icon markup is never stored or accepted as text: it is rebuilt from node lists whose tags,
 * attributes and values pass this allowlist (no scripts, foreignObject, event handlers, external references, styles).
 */
const ATTRS: Readonly<Record<IconTag, readonly string[]>> = {
  path: ["d"],
  circle: ["cx", "cy", "r"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
  ellipse: ["cx", "cy", "rx", "ry"],
};

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/;
const POINTS = /^[0-9eE+\-.,\s]*$/;

export function isIconTag(tag: unknown): tag is IconTag {
  return typeof tag === "string" && Object.prototype.hasOwnProperty.call(ATTRS, tag);
}

/** Returns a description of the first problem found, or null when the node is safe to render. */
export function iconNodeProblem(node: unknown): string | null {
  if (!Array.isArray(node) || node.length !== 2) return "node must be [tag, attrs]";
  const [tag, attrs] = node as [unknown, unknown];
  if (!isIconTag(tag)) return `tag ${String(tag)} is not allowed`;
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return "attrs must be an object";
  const entries = Object.entries(attrs as Record<string, unknown>);
  if (!entries.length) return "node has no geometry";
  for (const [key, value] of entries) {
    if (key === "fill") {
      if (value !== "currentColor") return "fill may only be currentColor";
      continue;
    }
    if (!ATTRS[tag].includes(key)) return `attribute ${key} is not allowed on <${tag}>`;
    const text = String(value);
    if (text.length > 4000) return `${key} is too long`;
    if (tag === "path") {
      if (key === "d" && !PATH_DATA.test(text)) return "path data contains illegal characters";
    } else if (key === "points") {
      if (!POINTS.test(text)) return "points contain illegal characters";
    } else if (!NUMBER.test(text)) {
      return `${key} must be a number`;
    }
  }
  return null;
}

/** Every node of an icon must pass; empty icons are invalid. */
export function iconProblem(nodes: unknown): string | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return "icon has no nodes";
  if (nodes.length > 24) return "icon has too many nodes";
  for (const node of nodes) {
    const problem = iconNodeProblem(node);
    if (problem) return problem;
  }
  return null;
}

/** A path/polygon-like node whose fill is meaningful: it draws only closed outlines. */
export function isClosedNode(node: IconNode): boolean {
  const [tag, attrs] = node;
  if (tag === "circle" || tag === "rect" || tag === "ellipse" || tag === "polygon") return true;
  if (tag === "path") {
    const subpaths = String(attrs.d).split(/(?=[Mm])/).filter((s) => s.trim());
    return subpaths.length > 0 && subpaths.every((s) => /[zZ]\s*$/.test(s.trim()));
  }
  return false;
}
