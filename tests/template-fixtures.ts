import { DESIGN_SCHEMA_VERSION } from "../src/core/creative/design.js";
import { SCHEMA_VERSION } from "../src/core/schema/document.js";
import type { TemplateManifestInput } from "../src/core/templates/library/index.js";

/** Valid catalog records for tests. Not shipped content. */
export function designTemplate(over: Partial<TemplateManifestInput> = {}): TemplateManifestInput {
  return {
    manifestVersion: 1,
    id: "tpl.design.quote-card",
    version: 1,
    name: "Quote card",
    description: "A calm square quote post with room for a name.",
    creator: { kind: "binhi" },
    provenance: { source: "authored", note: "Authored for the v1.0 seed catalog." },
    primaryCategory: "social-media",
    subcategory: "social-media/instagram-posts",
    secondaryCategories: [],
    tags: ["quote"],
    format: "social",
    editor: "design",
    documentKind: "design",
    documentSchemaVersion: DESIGN_SCHEMA_VERSION,
    requiredFeatures: ["design.text", "design.shapes"],
    outputFormats: ["png", "jpeg"],
    size: { kind: "fixed", width: 1080, height: 1080 },
    orientation: "square",
    content: { type: "builtin-design", key: "quote-card" },
    keywords: ["quote"],
    styles: ["minimal"],
    palette: ["#111111", "#f4f1ea"],
    preview: { thumbnail: "/template-previews/tpl.design.quote-card.png", alt: "Quote card preview" },
    publishedAt: "2026-10-28",
    visibility: "public",
    license: { id: "binhi-original", attribution: null },
    moderation: "not-required",
    lifecycle: "published",
    ...over,
  };
}

export function siteTemplate(over: Partial<TemplateManifestInput> = {}): TemplateManifestInput {
  return designTemplate({
    id: "tpl.site.portfolio",
    name: "Personal portfolio",
    primaryCategory: "websites-landing-pages",
    subcategory: "websites-landing-pages/personal-websites",
    format: "websites",
    editor: "website",
    documentKind: "site",
    documentSchemaVersion: SCHEMA_VERSION,
    requiredFeatures: ["site.pages", "site.navigation"],
    outputFormats: ["website"],
    size: { kind: "responsive", breakpoints: ["desktop", "tablet", "mobile"] },
    orientation: "responsive",
    content: { type: "builtin-site", builder: "portfolio" },
    legacyIds: ["portfolio"],
    ...over,
  });
}
