import { z } from "zod";
import { ID_SEED_PATTERN } from "../ids.js";
import {
  Accessibility,
  ComponentType,
  Identifier,
  Interactions,
  Layout,
  Navigation,
  NodeSchema,
  Page,
  PageSeo,
  Placement,
  ShortText,
  SiteDocument,
  SiteSettings,
  StyleSet,
  Theme,
  TextStyle,
  TextStyleKey,
  Visibility,
  BREAKPOINTS,
  SLUG_PATTERN,
} from "../schema/document.js";

/**
 * Every change to a website is one of these operations. The editor builds
 * them, the server validates and applies them against a known revision
 * using the same pure `applyOperation` (see apply.ts). Nothing else mutates
 * a document.
 */
const Breakpoint = z.enum(BREAKPOINTS);

export const InsertTarget = z.object({
  /** Parent node id, or a page id when inserting a root section. */
  parentId: Identifier,
  /** Insertion index; appended when omitted. */
  index: z.number().int().min(0).optional(),
  /** Freeform placement when the parent uses the free layout mode. */
  placement: Placement.optional(),
});

export const Operation = z.discriminatedUnion("type", [
  // --- nodes ---
  z.object({ type: z.literal("insertNode"), target: InsertTarget, node: NodeSchema }),
  z.object({ type: z.literal("insertComponent"), target: InsertTarget, componentType: ComponentType, props: z.record(z.unknown()).optional(), nodeId: Identifier.optional() }),
  z.object({ type: z.literal("updateProps"), nodeId: Identifier, props: z.record(z.unknown()) }),
  z.object({ type: z.literal("updateStyle"), nodeId: Identifier, breakpoint: Breakpoint.default("desktop"), style: StyleSet, /** keys to remove from the breakpoint style */ unset: z.array(z.string().max(40)).max(64).optional() }),
  z.object({ type: z.literal("updatePlacement"), nodeId: Identifier, breakpoint: Breakpoint.default("desktop"), placement: Placement.partial() }),
  z.object({ type: z.literal("clearPlacementOverride"), nodeId: Identifier, breakpoint: z.enum(["tablet", "mobile"]) }),
  z.object({ type: z.literal("setLayout"), nodeId: Identifier, layout: Layout.partial() }),
  z.object({ type: z.literal("moveNode"), nodeId: Identifier, target: InsertTarget }),
  z.object({ type: z.literal("reorderLayer"), nodeId: Identifier, direction: z.enum(["forward", "backward", "front", "back"]) }),
  z.object({ type: z.literal("groupNodes"), nodeIds: z.array(Identifier).min(2).max(100), groupId: Identifier.optional() }),
  z.object({ type: z.literal("ungroupNode"), nodeId: Identifier }),
  z.object({ type: z.literal("setLocked"), nodeId: Identifier, locked: z.boolean() }),
  z.object({ type: z.literal("setHidden"), nodeId: Identifier, hidden: z.boolean() }),
  z.object({ type: z.literal("setVisibility"), nodeId: Identifier, visibility: Visibility.partial() }),
  z.object({ type: z.literal("duplicateNode"), nodeId: Identifier, newId: Identifier.optional() }),
  z.object({ type: z.literal("deleteNode"), nodeId: Identifier }),
  z.object({ type: z.literal("pasteNodes"), target: InsertTarget, nodes: z.array(NodeSchema).min(1).max(100), offset: z.number().min(0).max(200).default(16) }),
  z.object({ type: z.literal("renameNode"), nodeId: Identifier, name: ShortText }),
  z.object({ type: z.literal("setTextStyle"), nodeId: Identifier, textStyle: TextStyleKey.nullable() }),
  z.object({ type: z.literal("updateInteractions"), nodeId: Identifier, interactions: Interactions.partial() }),
  z.object({ type: z.literal("updateA11y"), nodeId: Identifier, a11y: Accessibility.partial() }),
  z.object({ type: z.literal("setAnchor"), nodeId: Identifier, anchorId: z.string().max(80).regex(/^[A-Za-z][A-Za-z0-9_-]*$/).nullable() }),
  z.object({ type: z.literal("alignNodes"), nodeIds: z.array(Identifier).min(1).max(100), alignment: z.enum(["left", "centerX", "right", "top", "centerY", "bottom"]), breakpoint: Breakpoint.default("desktop") }),
  z.object({ type: z.literal("distributeNodes"), nodeIds: z.array(Identifier).min(3).max(100), axis: z.enum(["horizontal", "vertical"]), breakpoint: Breakpoint.default("desktop") }),
  // --- pages ---
  z.object({ type: z.literal("addPage"), page: Page.partial().extend({ name: ShortText.min(1) }), index: z.number().int().min(0).optional(), fromPageId: Identifier.optional() }),
  z.object({ type: z.literal("updatePage"), pageId: Identifier, patch: z.object({ name: ShortText.min(1).optional(), slug: z.string().regex(SLUG_PATTERN).optional(), hiddenFromNav: z.boolean().optional(), seo: PageSeo.partial().optional() }) }),
  z.object({ type: z.literal("reorderPages"), pageIds: z.array(Identifier).min(1).max(100) }),
  z.object({ type: z.literal("setHomePage"), pageId: Identifier }),
  z.object({ type: z.literal("deletePage"), pageId: Identifier }),
  // --- site ---
  z.object({ type: z.literal("updateTheme"), patch: Theme.deepPartial() }),
  z.object({ type: z.literal("updateTextStyle"), key: TextStyleKey, style: TextStyle.partial() }),
  z.object({ type: z.literal("updateNavigation"), navigation: Navigation.partial() }),
  z.object({ type: z.literal("updateSettings"), patch: SiteSettings.partial() }),
  z.object({ type: z.literal("renameSite"), name: ShortText.min(1) }),
  z.object({ type: z.literal("setHeader"), node: NodeSchema.nullable() }),
  z.object({ type: z.literal("setFooter"), node: NodeSchema.nullable() }),
  // --- reusable sections ---
  z.object({ type: z.literal("saveReusableSection"), nodeId: Identifier, name: ShortText.min(1), reusableId: Identifier.optional() }),
  z.object({ type: z.literal("insertReusableSection"), reusableId: Identifier, target: InsertTarget }),
  z.object({ type: z.literal("updateReusableSection"), reusableId: Identifier, fromNodeId: Identifier }),
  z.object({ type: z.literal("deleteReusableSection"), reusableId: Identifier }),
  z.object({ type: z.literal("detachReusable"), nodeId: Identifier }),
  // --- whole-document (undo/redo, revision restore). Fully validated. ---
  z.object({ type: z.literal("replaceDocument"), document: SiteDocument, reason: z.enum(["undo", "redo", "restore", "template"]) }),
]);
export type Operation = z.infer<typeof Operation>;
export type OperationType = Operation["type"];

export const OperationBatch = z.object({
  baseRevision: z.number().int().min(0),
  ops: z.array(Operation).min(1).max(200),
  /** Idempotency key so a retried autosave never applies twice. */
  batchId: z.string().min(8).max(64),
  /**
   * One seed per op (same order). Ops that mint ids draw them from this seed so the server creates exactly the ids
   * the editor already used. Optional: clients that send none get random ids (older builds).
   */
  idSeeds: z.array(z.string().regex(ID_SEED_PATTERN)).max(200).optional(),
}).refine((b) => !b.idSeeds || b.idSeeds.length === b.ops.length, { message: "idSeeds must have one entry per operation", path: ["idSeeds"] });
export type OperationBatch = z.infer<typeof OperationBatch>;
