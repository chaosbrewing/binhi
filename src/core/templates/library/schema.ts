/**
 * The canonical, versioned template record. A manifest is the small,
 * serialisable description used for discovery, filtering and governance. It
 * never contains the document itself: list endpoints return manifests only,
 * and the document is loaded by id when a template is previewed or used.
 *
 * Manifests are strict. Unknown fields are rejected so an imported or
 * hand-edited record cannot smuggle executable or unreviewed content.
 */
import { z } from "zod";
import { FontName } from "../../schema/document.js";
import { DOCUMENT_KINDS, EDITOR_IDS, FEATURES, OUTPUT_FORMATS } from "./editors.js";
import { FORMAT_IDS, ORIENTATIONS, STYLE_IDS } from "./taxonomy.js";

export const TEMPLATE_MANIFEST_VERSION = 1;

export const TEMPLATE_ID_PATTERN = /^tpl\.[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TemplateId = z.string().max(80).regex(TEMPLATE_ID_PATTERN, "Template ids look like tpl.design.quote-card");

export const LIFECYCLE_STATES = ["draft", "ready-for-review", "approved", "published", "archived", "deprecated"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Brand roles a template may bind to. Applying a kit rewrites only layers that declare these. */
export const BRAND_TOKENS = ["brand.primary", "brand.accent", "brand.ink", "brand.paper", "brand.heading-font", "brand.body-font", "brand.logo"] as const;
export type BrandToken = (typeof BRAND_TOKENS)[number];

const Text = (max: number) => z.string().trim().min(1).max(max);
const Slug = z.string().min(1).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HexSwatch = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const Size = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), width: z.number().int().min(64).max(4096), height: z.number().int().min(64).max(4096), presetId: Slug.optional() }).strict(),
  z.object({ kind: z.literal("responsive"), breakpoints: z.array(z.enum(["desktop", "tablet", "mobile"])).min(1) }).strict(),
]);
export type TemplateSize = z.infer<typeof Size>;

const Dependencies = z
  .object({
    fonts: z.array(FontName).max(9).default([]),
    /** Essential 250 icon ids. Empty until the icon library is on main. */
    icons: z.array(z.string().max(80)).max(50).default([]),
    /** Elements 300 ids. Empty until that collection exists. */
    elements: z.array(z.string().max(80)).max(50).default([]),
    /** Assets bundled with BINHI. A template never references a user's private library asset. */
    bundledAssets: z.array(z.string().max(120)).max(20).default([]),
    brandTokens: z.array(z.enum(BRAND_TOKENS)).max(BRAND_TOKENS.length).default([]),
    components: z.array(z.string().max(60)).max(30).default([]),
  })
  .strict();
export type TemplateDependencies = z.infer<typeof Dependencies>;

const Creator = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("binhi") }).strict(),
  z.object({ kind: z.literal("user"), ownerId: z.string().max(40) }).strict(),
  z.object({ kind: z.literal("community"), handle: Text(40) }).strict(),
]);

const ContentRef = z.discriminatedUnion("type", [
  z.object({ type: z.literal("builtin-site"), builder: Slug }).strict(),
  z.object({ type: z.literal("builtin-design"), key: Slug }).strict(),
  z.object({ type: z.literal("project"), projectId: z.string().max(40) }).strict(),
]);
export type TemplateContentRef = z.infer<typeof ContentRef>;

export const TemplateManifest = z
  .object({
    manifestVersion: z.literal(TEMPLATE_MANIFEST_VERSION),

    /* identity */
    id: TemplateId,
    /** Monotonic content version. A published (id, version) pair is immutable. */
    version: z.number().int().min(1).max(10_000),
    name: Text(60),
    description: Text(240),
    /** Earlier ids that resolve to this template (for example `portfolio` for website starters). */
    legacyIds: z.array(Slug).max(5).default([]),
    creator: Creator,
    provenance: z.object({ source: z.enum(["authored", "migrated", "user-saved", "imported"]), note: Text(240) }).strict(),

    /* classification */
    primaryCategory: z.string().max(60),
    subcategory: z.string().max(100).optional(),
    secondaryCategories: z.array(z.string().max(60)).max(4).default([]),
    tags: z.array(Slug).max(12).default([]),
    format: z.enum(FORMAT_IDS),

    /* document compatibility */
    editor: z.enum(EDITOR_IDS),
    documentKind: z.enum(DOCUMENT_KINDS),
    documentSchemaVersion: z.number().int().min(1),
    requiredFeatures: z.array(z.enum(FEATURES)).max(FEATURES.length).default([]),
    outputFormats: z.array(z.enum(OUTPUT_FORMATS)).min(1),
    size: Size,
    orientation: z.enum(ORIENTATIONS),
    content: ContentRef,

    /* dependencies */
    dependencies: Dependencies.default({}),

    /* discovery */
    keywords: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    aliases: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    styles: z.array(z.enum(STYLE_IDS)).min(1).max(3),
    palette: z.array(HexSwatch).min(2).max(6),
    preview: z.object({ thumbnail: z.string().max(160).nullable(), alt: Text(160) }).strict(),
    publishedAt: DateOnly.nullable().default(null),
    /** Only "free" exists: there are no entitlements, so no premium tier is representable. */
    access: z.literal("free").default("free"),

    /* governance */
    visibility: z.enum(["public", "private", "unlisted"]),
    license: z.object({ id: z.enum(["binhi-original", "user-owned"]), attribution: z.string().max(160).nullable(), notes: z.string().max(240).default("") }).strict(),
    moderation: z.enum(["not-required", "pending", "approved", "rejected"]),
    deprecation: z.object({ since: DateOnly, reason: Text(200), replacedBy: TemplateId.optional() }).strict().nullable().default(null),
    /** Plain-language conditions the UI shows when the template is not yet usable. */
    availabilityNotes: z.string().max(240).default(""),

    /* lifecycle */
    lifecycle: z.enum(LIFECYCLE_STATES),
  })
  .strict();

export type TemplateManifest = z.infer<typeof TemplateManifest>;
export type TemplateManifestInput = z.input<typeof TemplateManifest>;

export function parseManifest(value: unknown): TemplateManifest {
  return TemplateManifest.parse(value);
}
