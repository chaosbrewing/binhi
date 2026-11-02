/**
 * The small, JSON-safe projection of a manifest used by list endpoints and
 * cards. It deliberately carries no document content, so a page of results
 * never loads full template documents.
 */
import { EDITORS } from "./editors.js";
import { evaluateAvailability } from "./lifecycle.js";
import type { TemplateManifest } from "./schema.js";
import { getCategory, getSubcategory, type FormatId, type Orientation, type StyleId } from "./taxonomy.js";

export interface TemplateCard {
  id: string;
  version: number;
  name: string;
  description: string;
  format: FormatId;
  editor: string;
  editorLabel: string;
  primaryCategory: string;
  categoryName: string;
  subcategory: string | null;
  subcategoryName: string | null;
  secondaryCategories: string[];
  styles: StyleId[];
  palette: string[];
  orientation: Orientation;
  size: TemplateManifest["size"];
  outputs: string[];
  thumbnail: string | null;
  thumbnailAlt: string;
  featured: boolean;
  publishedAt: string | null;
  creator: "binhi" | "you";
  usable: boolean;
  reasons: string[];
}

export function toCard(m: TemplateManifest, viewerId?: string): TemplateCard {
  const availability = evaluateAvailability(m);
  const sub = m.subcategory ? getSubcategory(m.subcategory) : undefined;
  return {
    id: m.id,
    version: m.version,
    name: m.name,
    description: m.description,
    format: m.format,
    editor: m.editor,
    editorLabel: EDITORS[m.editor].label,
    primaryCategory: m.primaryCategory,
    categoryName: getCategory(m.primaryCategory)?.name ?? m.primaryCategory,
    subcategory: m.subcategory ?? null,
    subcategoryName: sub?.name ?? null,
    secondaryCategories: m.secondaryCategories,
    styles: m.styles,
    palette: m.palette,
    orientation: m.orientation,
    size: m.size,
    outputs: m.outputFormats,
    thumbnail: m.preview.thumbnail,
    thumbnailAlt: m.preview.alt,
    featured: m.featured,
    publishedAt: m.publishedAt,
    creator: m.creator.kind === "user" && m.creator.ownerId === viewerId ? "you" : "binhi",
    usable: availability.usable,
    reasons: availability.reasons.map((r) => r.message),
  };
}
