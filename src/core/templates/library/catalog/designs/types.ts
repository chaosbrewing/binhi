import type { FontName } from "../../../../schema/document.js";
import type { FormatId, StyleId } from "../../taxonomy.js";

export type ColorToken = "primary" | "accent" | "ink" | "paper";
export type FontToken = "heading" | "body";

/**
 * Which layers follow a Brand Kit. Bindings live beside the document, not in
 * it: the Design Studio schema is unchanged and a project made from a
 * template carries plain layers. Applying a kit rewrites only the layers
 * named here and never touches anything else.
 */
export interface BrandBindings {
  colors: { layerId: string; prop: "fill" | "stroke" | "color"; token: ColorToken }[];
  fonts: { layerId: string; token: FontToken }[];
  background?: ColorToken;
  /** Where the kit's logo is placed. Absent: the template has no logo slot and the logo is never added. */
  logoSlot?: { x: number; y: number; width: number; height: number };
}

export interface DesignTemplateContent {
  /** A complete Design Studio document (schema v1). */
  document: unknown;
  brand: BrandBindings;
}

export interface DesignSpec {
  key: string;
  name: string;
  description: string;
  category: string;
  sub: string;
  secondary?: string[];
  format: FormatId;
  styles: StyleId[];
  keywords: string[];
  aliases?: string[];
  tags?: string[];
  featured?: boolean;
  width: number;
  height: number;
  /** Canvas colour, and the brand role it follows when a kit is applied. */
  bg: string;
  bgBind?: ColorToken;
  /** Alt text for the generated preview. */
  alt: string;
  build: (d: import("./dsl.js").Design) => void;
}

export type { FontName };
