/**
 * Applying a Brand Kit to a design template. Pure and deterministic: the same
 * inputs always give the same document, so the browser can preview exactly
 * what the server will create. The server never trusts a client-applied
 * document; it runs this itself.
 *
 * Rules (from the template contract):
 *  - only layers named in the template's brand bindings change;
 *  - the shared template is never modified (the input is copied);
 *  - the kit's logo is added only where the template reserves a logo slot,
 *    and only when the kit has a logo;
 *  - a kit can never make text unreadable: if a recolour drops a text layer's
 *    contrast below 3:1 (and below what it was), that text switches to black
 *    or white and the change is reported.
 */
import { DesignDocument, type DesignLayer } from "../../creative/design.js";
import type { BrandKitDocument } from "../../creative/brandKit.js";
import type { FontName } from "../../schema/document.js";
import type { ParsedDesignContent } from "./catalog/designs/content.js";
import type { ColorToken } from "./catalog/designs/types.js";

export interface BrandRoles {
  primary: string;
  accent: string;
  ink: string;
  paper: string;
  heading: FontName;
  body: FontName;
  logoAssetId: string | null;
}

export interface BrandChange {
  layer: string;
  what: "fill" | "stroke" | "text colour" | "font" | "background" | "logo";
  from: string;
  to: string;
}

export interface BrandApplication {
  document: DesignDocument;
  changes: BrandChange[];
  /** Plain-language notes, such as a text colour adjusted for legibility. */
  adjustments: string[];
  logoPlaced: boolean;
}

function rgb(color: string): [number, number, number] | null {
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (m6) return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (m3) return [parseInt(m3[1]! + m3[1], 16), parseInt(m3[2]! + m3[2], 16), parseInt(m3[3]! + m3[3], 16)];
  return null;
}

function luminance(color: string): number | null {
  const c = rgb(color);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, or null when either colour is not a plain hex value. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The four colour roles of a kit: by name when present, otherwise by position and brightness. */
export function brandRoles(kit: BrandKitDocument): BrandRoles {
  const named = (needles: string[]) => kit.colors.find((c) => needles.some((n) => c.name.toLowerCase().includes(n)))?.value;
  const byBrightness = [...kit.colors].sort((a, b) => (luminance(a.value) ?? 0.5) - (luminance(b.value) ?? 0.5));
  const primary = named(["primary"]) ?? kit.colors[0]!.value;
  return {
    primary,
    accent: named(["accent", "secondary"]) ?? kit.colors[1]?.value ?? primary,
    ink: named(["ink", "text", "dark"]) ?? byBrightness[0]!.value,
    paper: named(["paper", "background", "light"]) ?? byBrightness[byBrightness.length - 1]!.value,
    heading: kit.fonts.heading,
    body: kit.fonts.body,
    logoAssetId: kit.logoAssetId,
  };
}

/** The colour a text layer actually sits on: the nearest opaque shape beneath its centre, else the canvas. */
function backgroundBehind(doc: DesignDocument, index: number): string {
  const text = doc.layers[index]!;
  const cx = text.x + text.width / 2;
  const cy = text.y + text.height / 2;
  for (let j = index - 1; j >= 0; j--) {
    const l: DesignLayer = doc.layers[j]!;
    if ((l.type !== "rect" && l.type !== "ellipse") || l.hidden || l.opacity < 0.85 || l.rotation !== 0 || l.fill === "transparent") continue;
    const inside = l.type === "rect" ? cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height : ((cx - (l.x + l.width / 2)) / (l.width / 2)) ** 2 + ((cy - (l.y + l.height / 2)) / (l.height / 2)) ** 2 <= 1;
    if (inside) return l.fill;
  }
  return doc.background;
}

export function applyBrandKitToDesign(content: ParsedDesignContent, kit: BrandKitDocument, opts: { placeLogo?: boolean } = {}): BrandApplication {
  const roles = brandRoles(kit);
  const doc = DesignDocument.parse(JSON.parse(JSON.stringify(content.document)));
  const before = DesignDocument.parse(JSON.parse(JSON.stringify(content.document)));
  const changes: BrandChange[] = [];
  const adjustments: string[] = [];
  const byId = new Map(doc.layers.map((l) => [l.id, l]));
  const colorOf = (t: ColorToken) => roles[t];

  const bg = content.brand.background;
  if (bg && colorOf(bg) !== doc.background) {
    changes.push({ layer: "Background", what: "background", from: doc.background, to: colorOf(bg) });
    doc.background = colorOf(bg);
  }
  for (const b of content.brand.colors) {
    const layer = byId.get(b.layerId);
    if (!layer) continue;
    const to = colorOf(b.token);
    if (b.prop === "color" && layer.type === "text" && layer.color !== to) {
      changes.push({ layer: layer.name || "Text", what: "text colour", from: layer.color, to });
      layer.color = to;
    } else if ((b.prop === "fill" || b.prop === "stroke") && (layer.type === "rect" || layer.type === "ellipse") && layer[b.prop] !== to) {
      changes.push({ layer: layer.name || "Shape", what: b.prop, from: layer[b.prop], to });
      layer[b.prop] = to;
    }
  }
  for (const f of content.brand.fonts) {
    const layer = byId.get(f.layerId);
    const to = f.token === "heading" ? roles.heading : roles.body;
    if (layer?.type === "text" && layer.font !== to) {
      changes.push({ layer: layer.name || "Text", what: "font", from: layer.font, to });
      layer.font = to;
    }
  }

  // A kit may never make text unreadable.
  doc.layers.forEach((layer, i) => {
    if (layer.type !== "text" || layer.hidden) return;
    const was = contrastRatio(before.layers[i]!.type === "text" ? (before.layers[i] as { color: string }).color : layer.color, backgroundBehind(before, i));
    const now = contrastRatio(layer.color, backgroundBehind(doc, i));
    if (now === null || was === null || now >= 3 || now >= was * 0.9) return;
    const back = backgroundBehind(doc, i);
    const dark = contrastRatio("#111111", back) ?? 0;
    const light = contrastRatio("#ffffff", back) ?? 0;
    const to = dark >= light ? "#111111" : "#ffffff";
    changes.push({ layer: layer.name || "Text", what: "text colour", from: layer.color, to });
    adjustments.push(`${layer.name || "Text"}: text colour changed to stay readable on the new background.`);
    layer.color = to;
  });

  let logoPlaced = false;
  const slot = content.brand.logoSlot;
  if (opts.placeLogo !== false && roles.logoAssetId && slot) {
    let id = "lyr_brandlogo";
    for (let n = 1; byId.has(id); n++) id = `lyr_brandlogo${n}`;
    doc.layers.push({ id, name: "Logo", type: "image", x: slot.x, y: slot.y, width: slot.width, height: slot.height, rotation: 0, opacity: 1, locked: false, hidden: false, assetId: roles.logoAssetId, fit: "contain", alt: "Logo" });
    changes.push({ layer: "Logo", what: "logo", from: "none", to: "brand kit logo" });
    logoPlaced = true;
  }
  return { document: DesignDocument.parse(doc), changes, adjustments, logoPlaced };
}
