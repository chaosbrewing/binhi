/** Geometry of one icon: a list of drawing nodes on a 24×24 grid. Only the allowlisted tags/attributes in `safe.ts` are ever rendered. */
export type IconTag = "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse";
export type IconNode = readonly [tag: IconTag, attrs: Readonly<Record<string, string | number>>];

export type IconSourceKind = "lucide" | "original";
