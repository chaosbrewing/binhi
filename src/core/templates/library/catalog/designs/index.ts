import { DESIGN_PRESETS } from "../../../../creative/design.js";
import { SCHEMA_VERSION } from "../../../../schema/document.js";
import { DESIGN_SCHEMA_VERSION } from "../../../../creative/design.js";
import type { BrandToken, TemplateManifestInput } from "../../schema.js";
import { slugify } from "../../taxonomy.js";
import { Design } from "./dsl.js";
import type { DesignSpec, DesignTemplateContent } from "./types.js";
import { SOCIAL } from "./social.js";
import { PRINT } from "./print.js";
import { BRAND } from "./brand.js";
import { BUSINESS } from "./business.js";
import { MARKETING } from "./marketing.js";
import { PHOTO } from "./photo.js";
import { MISC } from "./misc.js";

export type { DesignTemplateContent, DesignSpec } from "./types.js";

export const DESIGN_SPECS: readonly DesignSpec[] = [...SOCIAL, ...PRINT, ...BRAND, ...BUSINESS, ...MARKETING, ...PHOTO, ...MISC];

function build(spec: DesignSpec): DesignTemplateContent {
  const d = new Design(spec.width, spec.height, spec.bg, spec.key, spec.bgBind);
  spec.build(d);
  return d.toContent();
}

/** Content by key. Built once at load from the specs; deterministic (stable layer ids, no randomness). */
export const DESIGN_CONTENT: Readonly<Record<string, DesignTemplateContent>> = Object.fromEntries(DESIGN_SPECS.map((s) => [s.key, build(s)]));

type Layer = { type: string; x: number; y: number; width: number; height: number; fill?: string; color?: string; font?: string; text?: string; fontSize?: number; opacity?: number };

const hex6 = (c: string): string | null => {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(c);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : null;
};

/** The colours people will actually see, ordered by how much of the canvas they cover. */
export function paletteOf(doc: { width: number; height: number; background: string; layers: Layer[] }): string[] {
  const area = new Map<string, number>();
  const add = (c: string | undefined, a: number) => {
    const h = c ? hex6(c) : null;
    if (h) area.set(h, (area.get(h) ?? 0) + a);
  };
  add(doc.background, doc.width * doc.height * 0.5);
  for (const l of doc.layers) {
    const w = Math.max(0, Math.min(l.x + l.width, doc.width) - Math.max(l.x, 0));
    const h = Math.max(0, Math.min(l.y + l.height, doc.height) - Math.max(l.y, 0));
    if (l.type === "text") add(l.color, Math.min(w * h * 0.12, (l.text?.length ?? 0) * (l.fontSize ?? 0) * (l.fontSize ?? 0) * 0.45));
    else add(l.fill, w * h * (l.opacity ?? 1));
  }
  const ranked = [...area.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return ranked.slice(0, 5).length >= 2 ? ranked.slice(0, 5) : [...ranked, "#ffffff", "#111111"].slice(0, 2);
}

const TOKEN_MAP = { primary: "brand.primary", accent: "brand.accent", ink: "brand.ink", paper: "brand.paper", heading: "brand.heading-font", body: "brand.body-font" } as const;

export function designManifest(spec: DesignSpec): TemplateManifestInput {
  const content = DESIGN_CONTENT[spec.key]!;
  const doc = content.document as { width: number; height: number; background: string; layers: Layer[] };
  const fonts = [...new Set(doc.layers.flatMap((l) => (l.type === "text" && l.font ? [l.font] : [])))];
  const tokens = new Set<BrandToken>();
  for (const c of content.brand.colors) tokens.add(TOKEN_MAP[c.token]);
  for (const f of content.brand.fonts) tokens.add(TOKEN_MAP[f.token]);
  if (content.brand.background) tokens.add(TOKEN_MAP[content.brand.background]);
  if (content.brand.logoSlot) tokens.add("brand.logo");
  const preset = DESIGN_PRESETS.find((p) => p.width === spec.width && p.height === spec.height);
  const orientation = spec.width === spec.height ? "square" : spec.width > spec.height ? "landscape" : "portrait";
  void SCHEMA_VERSION;
  return {
    manifestVersion: 1,
    id: `tpl.design.${spec.key}`,
    version: 1,
    name: spec.name,
    description: spec.description,
    creator: { kind: "binhi" },
    provenance: { source: "authored", note: "Authored for the v1.0 seed catalog from Design Studio text and shape layers." },
    primaryCategory: spec.category,
    subcategory: `${spec.category}/${spec.sub}`,
    secondaryCategories: spec.secondary ?? [],
    tags: (spec.tags ?? []).map(slugify),
    format: spec.format,
    editor: "design",
    documentKind: "design",
    documentSchemaVersion: DESIGN_SCHEMA_VERSION,
    requiredFeatures: ["design.text", "design.shapes", ...(tokens.size ? (["design.brand-colors"] as const) : [])],
    outputFormats: ["png", "jpeg"],
    size: { kind: "fixed", width: spec.width, height: spec.height, ...(preset ? { presetId: preset.id } : {}) },
    orientation,
    content: { type: "builtin-design", key: spec.key },
    dependencies: { fonts: fonts as never, icons: [], elements: [], bundledAssets: [], brandTokens: [...tokens], components: [] },
    keywords: spec.keywords,
    aliases: spec.aliases ?? [],
    styles: spec.styles,
    palette: paletteOf(doc),
    preview: { thumbnail: `/template-previews/tpl.design.${spec.key}@1.jpg`, alt: spec.alt },
    publishedAt: "2026-10-28",
    featured: spec.featured ?? false,
    visibility: "public",
    license: { id: "binhi-original", attribution: null, notes: "" },
    moderation: "not-required",
    lifecycle: "published",
  };
}

export const DESIGN_TEMPLATES: readonly TemplateManifestInput[] = DESIGN_SPECS.map(designManifest);
