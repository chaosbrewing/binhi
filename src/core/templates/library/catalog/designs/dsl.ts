/**
 * A tiny authoring DSL for design templates. It only ever produces what the
 * Design Studio schema allows (text, rectangles, ellipses), with stable
 * layer ids so a template's content is deterministic and fingerprintable.
 * Photo areas are labelled frames: the Design Studio has no image slots yet.
 */
import type { FontName } from "../../../../schema/document.js";
import type { BrandBindings, ColorToken, DesignTemplateContent, FontToken } from "./types.js";

interface Common {
  name?: string;
  rotation?: number;
  opacity?: number;
}
export interface ShapeOpts extends Common {
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  bind?: { fill?: ColorToken; stroke?: ColorToken };
}
export interface TextOpts extends Common {
  size: number;
  weight?: 400 | 500 | 600 | 700 | 800;
  font?: FontName;
  color?: string;
  align?: "left" | "center" | "right";
  /** Line height multiplier. */
  lh?: number;
  bind?: { color?: ColorToken; font?: FontToken };
}

export class Design {
  readonly layers: Record<string, unknown>[] = [];
  private readonly brand: BrandBindings = { colors: [], fonts: [] };
  private n = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    private background: string,
    private readonly key: string,
    bgBind?: ColorToken,
  ) {
    if (bgBind) this.brand.background = bgBind;
  }

  private id(): string {
    this.n += 1;
    return `lyr_${this.key.replace(/[^a-z0-9]/g, "").slice(0, 8)}${String(this.n).padStart(3, "0")}`;
  }

  private base(x: number, y: number, w: number, h: number, o: Common, fallback: string) {
    return { id: this.id(), name: o.name ?? fallback, x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), rotation: o.rotation ?? 0, opacity: o.opacity ?? 1, locked: false, hidden: false };
  }

  rect(x: number, y: number, w: number, h: number, fill: string, o: ShapeOpts = {}): this {
    return this.shape("rect", x, y, w, h, fill, o);
  }
  ellipse(x: number, y: number, w: number, h: number, fill: string, o: ShapeOpts = {}): this {
    return this.shape("ellipse", x, y, w, h, fill, o);
  }
  private shape(type: "rect" | "ellipse", x: number, y: number, w: number, h: number, fill: string, o: ShapeOpts): this {
    const layer = { ...this.base(x, y, w, h, o, type === "rect" ? "Shape" : "Circle"), type, fill, stroke: o.stroke ?? "transparent", strokeWidth: o.strokeWidth ?? 0, radius: o.radius ?? 0 };
    this.layers.push(layer);
    if (o.bind?.fill) this.brand.colors.push({ layerId: layer.id, prop: "fill", token: o.bind.fill });
    if (o.bind?.stroke) this.brand.colors.push({ layerId: layer.id, prop: "stroke", token: o.bind.stroke });
    return this;
  }

  text(str: string, x: number, y: number, w: number, h: number, o: TextOpts): this {
    // A box is never shorter than one line of its own text.
    const layer = { ...this.base(x, y, w, Math.max(h, Math.ceil(o.size * (o.lh ?? 1.15))), o, "Text"), type: "text", text: str, font: o.font ?? "DM Sans", fontSize: o.size, fontWeight: o.weight ?? 600, lineHeight: o.lh ?? 1.15, align: o.align ?? "left", color: o.color ?? "#111111" };
    this.layers.push(layer);
    if (o.bind?.color) this.brand.colors.push({ layerId: layer.id, prop: "color", token: o.bind.color });
    if (o.bind?.font) this.brand.fonts.push({ layerId: layer.id, token: o.bind.font });
    return this;
  }

  /** A labelled frame where the owner's photo goes (add the image on top, then delete or keep the frame). */
  photo(x: number, y: number, w: number, h: number, o: { fill?: string; label?: string; labelColor?: string; radius?: number; size?: number; name?: string } = {}): this {
    this.rect(x, y, w, h, o.fill ?? "#d9d9d6", { name: o.name ?? "Photo frame", radius: o.radius ?? 0 });
    const size = o.size ?? Math.max(18, Math.round(Math.min(w, h) * 0.07));
    this.text(o.label ?? "Your photo here", x, y + h / 2 - size * 0.6, w, size * 1.4, { size, weight: 500, color: o.labelColor ?? "#6b6b66", align: "center", name: "Photo label" });
    return this;
  }

  /** Reserve the place where a Brand Kit logo is inserted when one is applied. */
  logoSlot(x: number, y: number, w: number, h: number): this {
    this.brand.logoSlot = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
    return this;
  }

  toContent(): DesignTemplateContent {
    return {
      document: { schemaVersion: 1, width: this.width, height: this.height, background: this.background, layers: this.layers },
      brand: { colors: [...this.brand.colors], fonts: [...this.brand.fonts], ...(this.brand.background ? { background: this.brand.background } : {}), ...(this.brand.logoSlot ? { logoSlot: this.brand.logoSlot } : {}) },
    };
  }
}
