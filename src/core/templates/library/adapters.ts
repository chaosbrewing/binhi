/**
 * Template adapters: one versioned content contract per editor.
 *
 * Website and Design adapters are active; their content is the real
 * SiteDocument / DesignDocument and is validated by the catalog tests. The
 * other contracts are prepared and tested so a future editor can adopt them
 * without redesigning the library, but they are "contract-only": their
 * editors do not exist (or do not accept templates), so the catalog
 * validator refuses to publish any template that needs them.
 *
 * Every contract is strict: unknown keys are rejected, so a hand-edited or
 * imported record cannot smuggle in behaviour the editor never reviewed.
 */
import { z } from "zod";
import { EDITORS, editorCanOpenTemplates, type EditorId } from "./editors.js";

export const ADAPTER_CONTRACT_VERSION = 1;

export interface TemplateAdapter {
  editor: EditorId;
  contract: number;
  /** "active": templates for this editor can be used today. "contract-only": prepared and tested, not usable. */
  status: "active" | "contract-only";
  summary: string;
  /** What must exist before the contract can become active. */
  requires: readonly string[];
}

const Text = (max: number) => z.string().trim().min(1).max(max);

/* ------------------------------------------------------------------ forms */
export const FormFieldContract = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, "Field ids are lowercase letters, numbers and underscores"),
    type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox", "number", "date"]),
    /** A visible label is mandatory: it is the field's accessible name. */
    label: Text(80),
    required: z.boolean(),
    helpText: z.string().max(160).optional(),
    minLength: z.number().int().min(0).max(5000).optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    options: z.array(Text(60)).max(30).optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (f.type === "select" && (f.options?.length ?? 0) < 2) bad("A choice field needs at least two options");
    if (f.type !== "select" && f.options) bad("Only choice fields have options");
    if (f.minLength !== undefined && f.maxLength !== undefined && f.minLength > f.maxLength) bad("minLength cannot exceed maxLength");
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) bad("min cannot exceed max");
    if ((f.minLength !== undefined || f.maxLength !== undefined) && !["text", "textarea", "email", "phone"].includes(f.type)) bad("Length limits apply to text fields only");
    if ((f.min !== undefined || f.max !== undefined) && f.type !== "number") bad("Value limits apply to number fields only");
  });

export const FormTemplateContract = z
  .object({
    version: z.literal(1),
    title: Text(80),
    fields: z.array(FormFieldContract).min(1).max(30),
    submission: z.object({
      /** Submissions are stored for the owner. Sending email is a separate, unavailable integration. */
      mode: z.literal("store-only"),
      successMessage: Text(160),
      maxPerDayPerIp: z.number().int().min(1).max(1000),
    }).strict(),
    ownership: z.literal("owner-only"),
  })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    for (const f of c.fields) {
      if (seen.has(f.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate field id ${f.id}` });
      seen.add(f.id);
    }
  });

/* ------------------------------------------------------------------ photo */
/** A photo template is a set of non-destructive adjustments applied to the user's own photo. No masks, frames or overlays. */
export const PhotoTemplateContract = z
  .object({
    version: z.literal(1),
    requiresSourcePhoto: z.literal(true),
    adjustments: z.object({
      brightness: z.number().min(0).max(200),
      contrast: z.number().min(0).max(200),
      saturation: z.number().min(0).max(200),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
      flipX: z.boolean(),
      flipY: z.boolean(),
    }).strict(),
  })
  .strict();

/* -------------------------------------------------------------- documents */
const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: Text(200) }).strict(),
  z.object({ type: z.literal("paragraph"), text: Text(4000) }).strict(),
  z.object({ type: z.literal("list"), ordered: z.boolean(), items: z.array(Text(300)).min(1).max(50) }).strict(),
  z.object({ type: z.literal("table"), columns: z.array(Text(60)).min(1).max(8), rows: z.number().int().min(1).max(60) }).strict(),
]);

export const DocumentTemplateContract = z
  .object({
    version: z.literal(1),
    page: z.object({ size: z.enum(["A4", "Letter"]), orientation: z.enum(["portrait", "landscape"]) }).strict(),
    blocks: z.array(Block).min(1).max(200),
    /** Export format the document editor must support before this contract can go live. */
    output: z.literal("pdf"),
  })
  .strict();

export const PresentationTemplateContract = z
  .object({
    version: z.literal(1),
    aspect: z.enum(["16:9", "4:3"]),
    slides: z.array(z.object({ layout: z.enum(["title", "content", "section", "two-column"]), blocks: z.array(Block).max(30) }).strict()).min(1).max(60),
    output: z.enum(["pdf", "pptx"]),
  })
  .strict();

export const VideoTemplateContract = z
  .object({
    version: z.literal(1),
    aspect: z.enum(["16:9", "9:16", "1:1"]),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
    durationMs: z.number().int().min(500).max(60_000),
    scenes: z.array(z.object({ startMs: z.number().int().min(0), endMs: z.number().int().min(1), blocks: z.array(Block).max(20) }).strict()).min(1).max(30),
    output: z.literal("mp4"),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const s of v.scenes) if (s.endMs <= s.startMs || s.endMs > v.durationMs) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Every scene must end after it starts and within the duration" });
  });

/** Email layouts are visual only. Sending, hosting and tracking are deliberately not part of the contract. */
export const EmailTemplateContract = z
  .object({
    version: z.literal(1),
    widthPx: z.literal(600),
    blocks: z.array(Block).min(1).max(100),
    sending: z.literal("none"),
  })
  .strict();

export const CONTRACTS = {
  form: FormTemplateContract,
  photo: PhotoTemplateContract,
  document: DocumentTemplateContract,
  presentation: PresentationTemplateContract,
  video: VideoTemplateContract,
  email: EmailTemplateContract,
} as const;
export type ContractEditor = keyof typeof CONTRACTS;

export const ADAPTERS: Record<EditorId, TemplateAdapter> = {
  website: { editor: "website", contract: ADAPTER_CONTRACT_VERSION, status: "active", summary: "Content is a SiteDocument built by a builder function; created through SiteService with a template revision.", requires: [] },
  design: { editor: "design", contract: ADAPTER_CONTRACT_VERSION, status: "active", summary: "Content is a Design Studio document plus brand bindings; created through ProjectService.", requires: [] },
  photo: { editor: "photo", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "Non-destructive adjustments applied to the user's own photo.", requires: ["a Photo Editor that loads a preset onto a chosen photo", "frames and overlays are out of scope: no masking support exists"] },
  form: { editor: "form", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "Validated field definitions with owner-only submissions.", requires: ["the standalone Form Creator", "verified submission handling"] },
  document: { editor: "document", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "Paged blocks exported as PDF.", requires: ["a document editor", "PDF export with font embedding"] },
  presentation: { editor: "presentation", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "Slides with layouts and blocks.", requires: ["a slide editor", "PDF or PPTX export"] },
  video: { editor: "video", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "Timed scenes rendered to MP4.", requires: ["a motion editor", "a video renderer and export path"] },
  email: { editor: "email", contract: ADAPTER_CONTRACT_VERSION, status: "contract-only", summary: "A 600 px visual layout; no sending or hosting.", requires: ["an email editor", "an approved sending integration (kept separate from editing)"] },
};

/** Adapter status must always agree with the editor registry. Returns the mismatches. */
export function adapterConsistencyIssues(): string[] {
  const out: string[] = [];
  for (const id of Object.keys(EDITORS) as EditorId[]) {
    const a = ADAPTERS[id];
    const open = editorCanOpenTemplates(id);
    if ((a.status === "active") !== open) out.push(`${id}: adapter is "${a.status}" but the editor ${open ? "opens" : "does not open"} templates`);
  }
  return out;
}

/** Validate a template's content against its editor's contract. Active editors validate their own documents elsewhere. */
export function validateContract(editor: ContractEditor, content: unknown): { ok: true } | { ok: false; errors: string[] } {
  const r = CONTRACTS[editor].safeParse(content);
  return r.success ? { ok: true } : { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(content)"}: ${i.message}`) };
}
