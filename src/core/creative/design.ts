import { z } from "zod";
import { Color, FontName, FONT_STACKS } from "../schema/document.js";
import { ID_PATTERN, newId } from "../ids.js";

/**
 * Design Studio document: a fixed-size artboard with absolutely positioned
 * layers. It is deliberately separate from the website SiteDocument and from
 * the photo recipe; the three document types share identity, the asset
 * library and the project list, not reducers.
 */
export const DESIGN_SCHEMA_VERSION = 1;
export const DESIGN_LIMITS = {
  minEdge: 64,
  maxEdge: 4096,
  maxPixels: 16_000_000,
  maxLayers: 200,
  maxTextLength: 2000,
} as const;

const Px = z.number().finite();
export const LayerId = z.string().regex(ID_PATTERN);

const LayerBase = z.object({
  id: LayerId,
  name: z.string().trim().max(60).default(""),
  x: Px,
  y: Px,
  width: Px.min(1).max(DESIGN_LIMITS.maxEdge * 2),
  height: Px.min(1).max(DESIGN_LIMITS.maxEdge * 2),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

export const TextLayer = LayerBase.extend({
  type: z.literal("text"),
  text: z.string().max(DESIGN_LIMITS.maxTextLength),
  font: FontName.default("Inter"),
  fontSize: z.number().min(6).max(600).default(32),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).default(600),
  lineHeight: z.number().min(0.8).max(3).default(1.2),
  align: z.enum(["left", "center", "right"]).default("left"),
  color: Color.default("#111111"),
});

export const ShapeLayer = LayerBase.extend({
  type: z.enum(["rect", "ellipse"]),
  fill: Color.default("#1f6f4a"),
  stroke: Color.default("transparent"),
  strokeWidth: z.number().min(0).max(64).default(0),
  radius: z.number().min(0).max(1000).default(0),
});

export const ImageLayer = LayerBase.extend({
  type: z.literal("image"),
  /** Asset library id (private, owner-checked) rendered through /api/library/:id/file. */
  assetId: z.string().regex(ID_PATTERN),
  fit: z.enum(["cover", "contain"]).default("cover"),
  alt: z.string().max(200).default(""),
});

export const DesignLayer = z.discriminatedUnion("type", [TextLayer, ShapeLayer, ImageLayer]);
export type DesignLayer = z.infer<typeof DesignLayer>;
export type TextLayer = z.infer<typeof TextLayer>;
export type ShapeLayer = z.infer<typeof ShapeLayer>;
export type ImageLayer = z.infer<typeof ImageLayer>;

export const DesignDocument = z
  .object({
    schemaVersion: z.literal(DESIGN_SCHEMA_VERSION),
    width: z.number().int().min(DESIGN_LIMITS.minEdge).max(DESIGN_LIMITS.maxEdge),
    height: z.number().int().min(DESIGN_LIMITS.minEdge).max(DESIGN_LIMITS.maxEdge),
    background: Color.default("#ffffff"),
    layers: z.array(DesignLayer).max(DESIGN_LIMITS.maxLayers).default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (doc.width * doc.height > DESIGN_LIMITS.maxPixels) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Designs are limited to ${DESIGN_LIMITS.maxPixels / 1_000_000} megapixels` });
    const seen = new Set<string>();
    for (const layer of doc.layers) {
      if (seen.has(layer.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate layer id ${layer.id}` });
      seen.add(layer.id);
    }
  });
export type DesignDocument = z.infer<typeof DesignDocument>;

export interface DesignPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  group: "Social" | "Print" | "Web";
  note?: string;
}

/** Fixed-size starting points. Print sizes are 300 dpi pixel equivalents capped by DESIGN_LIMITS. */
export const DESIGN_PRESETS: DesignPreset[] = [
  { id: "ig-post", name: "Instagram post", width: 1080, height: 1080, group: "Social" },
  { id: "ig-story", name: "Story / Reel cover", width: 1080, height: 1920, group: "Social" },
  { id: "fb-cover", name: "Facebook cover", width: 1640, height: 856, group: "Social" },
  { id: "x-header", name: "X header", width: 1500, height: 500, group: "Social" },
  { id: "yt-thumb", name: "YouTube thumbnail", width: 1280, height: 720, group: "Social" },
  { id: "a4-flyer", name: "A4 flyer (300 dpi)", width: 2480, height: 3508, group: "Print", note: "Portrait" },
  { id: "a5-flyer", name: "A5 flyer (300 dpi)", width: 1748, height: 2480, group: "Print" },
  { id: "business-card", name: "Business card (300 dpi)", width: 1050, height: 600, group: "Print", note: "3.5 × 2 in" },
  { id: "presentation", name: "Presentation 16:9", width: 1920, height: 1080, group: "Web" },
  { id: "og-image", name: "Link preview (Open Graph)", width: 1200, height: 630, group: "Web" },
  { id: "web-banner", name: "Web banner", width: 1600, height: 600, group: "Web" },
];

export function createDesignDocument(width: number, height: number): DesignDocument {
  return DesignDocument.parse({ schemaVersion: DESIGN_SCHEMA_VERSION, width, height, background: "#ffffff", layers: [] });
}

export function makeLayer(type: DesignLayer["type"], doc: { width: number; height: number }, extra: Record<string, unknown> = {}): DesignLayer {
  const size = Math.round(Math.min(doc.width, doc.height) * 0.4);
  const base = { id: newId("lyr"), x: Math.round((doc.width - size) / 2), y: Math.round((doc.height - size) / 2), width: size, height: size, rotation: 0, opacity: 1, locked: false, hidden: false, name: "" };
  switch (type) {
    case "text":
      return DesignLayer.parse({ ...base, type, width: Math.round(doc.width * 0.7), height: Math.round(Math.min(doc.height, doc.width) * 0.18), x: Math.round(doc.width * 0.15), y: Math.round(doc.height * 0.4), text: "Your headline", fontSize: Math.round(Math.min(doc.width, doc.height) / 12), ...extra });
    case "rect":
    case "ellipse":
      return DesignLayer.parse({ ...base, type, ...extra });
    case "image":
      return DesignLayer.parse({ ...base, type, width: Math.round(doc.width * 0.6), height: Math.round(doc.height * 0.6), x: Math.round(doc.width * 0.2), y: Math.round(doc.height * 0.2), ...extra });
  }
}

/** Every asset library id the document references (for usage tracking). */
export function designAssetIds(doc: DesignDocument): string[] {
  return Array.from(new Set(doc.layers.flatMap((l) => (l.type === "image" ? [l.assetId] : []))));
}

export function fontStack(font: FontName): string {
  return FONT_STACKS[font];
}

export function validateDesignDocument(value: unknown): DesignDocument {
  return DesignDocument.parse(value);
}
