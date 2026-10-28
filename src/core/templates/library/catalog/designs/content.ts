import { DesignDocument } from "../../../../creative/design.js";
import type { BrandBindings, DesignTemplateContent } from "./types.js";

export interface ParsedDesignContent {
  document: DesignDocument;
  brand: BrandBindings;
}

/**
 * Validate built-in design content: a real Design Studio document, and brand
 * bindings that point at layers that exist and can take that property.
 * Throws a readable Error on the first problem.
 */
export function parseDesignContent(raw: unknown): ParsedDesignContent {
  const content = raw as Partial<DesignTemplateContent> | null;
  if (!content || typeof content !== "object" || !("document" in content) || !content.brand) throw new Error("Design template content must have a document and brand bindings");
  const document = DesignDocument.parse(content.document);
  const brand = content.brand;
  const byId = new Map(document.layers.map((l) => [l.id, l]));
  for (const c of brand.colors) {
    const layer = byId.get(c.layerId);
    if (!layer) throw new Error(`Brand binding points at unknown layer ${c.layerId}`);
    if (c.prop === "color" && layer.type !== "text") throw new Error(`Layer ${c.layerId} is not text, so it cannot take a text colour`);
    if ((c.prop === "fill" || c.prop === "stroke") && layer.type !== "rect" && layer.type !== "ellipse") throw new Error(`Layer ${c.layerId} is not a shape, so it cannot take a ${c.prop}`);
  }
  for (const f of brand.fonts) {
    const layer = byId.get(f.layerId);
    if (!layer || layer.type !== "text") throw new Error(`Font binding points at ${f.layerId}, which is not a text layer`);
  }
  const slot = brand.logoSlot;
  if (slot && (slot.x < 0 || slot.y < 0 || slot.x + slot.width > document.width || slot.y + slot.height > document.height || slot.width < 16 || slot.height < 16)) throw new Error("The logo slot must lie inside the canvas");
  return { document, brand };
}
