/**
 * Which editors can honestly open a template today. The rule from the
 * directive: a template cannot be public if its required editor is
 * unavailable. Availability is declared here once and enforced by the
 * catalog validator, the API and the UI. Changing a status here is a
 * product decision that needs the editor, renderer and export path to exist.
 */
import { SCHEMA_VERSION } from "../../schema/document.js";
import { DESIGN_SCHEMA_VERSION } from "../../creative/design.js";

export const EDITOR_IDS = ["website", "design", "photo", "form", "document", "presentation", "video", "email"] as const;
export type EditorId = (typeof EDITOR_IDS)[number];

/** The persisted document a template instantiates into. */
export const DOCUMENT_KINDS = ["site", "design"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const OUTPUT_FORMATS = ["website", "png", "jpeg"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface EditorInfo {
  id: EditorId;
  label: string;
  /** The editor exists and works in this build. */
  available: boolean;
  /** Templates may be instantiated into this editor now. */
  templates: boolean;
  /** Document kinds this editor can open as a template (empty when none). */
  documentKinds: readonly DocumentKind[];
  /** Why not, in words a user can read. */
  unavailableReason?: string;
}

export const EDITORS: Record<EditorId, EditorInfo> = {
  website: { id: "website", label: "Website Builder", available: true, templates: true, documentKinds: ["site"] },
  design: { id: "design", label: "Design Studio", available: true, templates: true, documentKinds: ["design"] },
  photo: {
    id: "photo",
    label: "Photo Editor",
    available: true,
    templates: false,
    documentKinds: [],
    unavailableReason: "The Photo Editor edits one photo with non-destructive adjustments. Frames, overlays and layouts are not supported yet.",
  },
  form: { id: "form", label: "Form Creator", available: false, templates: false, documentKinds: [], unavailableReason: "The standalone Form Creator is planned. Website contact forms already work inside website templates." },
  document: { id: "document", label: "Document editor", available: false, templates: false, documentKinds: [], unavailableReason: "There is no document or PDF editor, and no PDF export, yet." },
  presentation: { id: "presentation", label: "Slide editor", available: false, templates: false, documentKinds: [], unavailableReason: "There is no slide editor or presentation export yet." },
  video: { id: "video", label: "Video editor", available: false, templates: false, documentKinds: [], unavailableReason: "There is no motion or video editor yet." },
  email: { id: "email", label: "Email editor", available: false, templates: false, documentKinds: [], unavailableReason: "Email editing, sending and hosting are not part of BINHI yet." },
};

export function getEditor(id: EditorId): EditorInfo {
  return EDITORS[id];
}

/** True when a template for this editor can be shown as usable. */
export function editorCanOpenTemplates(id: EditorId): boolean {
  const e = EDITORS[id];
  return e.available && e.templates;
}

/** Current document schema version per kind; templates must match it exactly. */
export const DOCUMENT_SCHEMA_VERSIONS: Record<DocumentKind, number> = {
  site: SCHEMA_VERSION,
  design: DESIGN_SCHEMA_VERSION,
};

/** Output formats each document kind can really produce today. */
export const KIND_OUTPUTS: Record<DocumentKind, readonly OutputFormat[]> = {
  site: ["website"],
  design: ["png", "jpeg"],
};

/** Editor feature flags a template may require. A template needing a missing feature stays unavailable. */
export const FEATURES = [
  "site.pages",
  "site.navigation",
  "site.forms",
  "site.theme-tokens",
  "design.text",
  "design.shapes",
  "design.images",
  "design.brand-colors",
  "design.icons",
  "design.gradients",
  "design.image-slots",
  "elements300",
  "commerce",
] as const;
export type FeatureId = (typeof FEATURES)[number];

/** Features that exist on this build. Everything else is rejected for public templates. */
export const AVAILABLE_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([
  "site.pages",
  "site.navigation",
  "site.forms",
  "site.theme-tokens",
  "design.text",
  "design.shapes",
  "design.images",
  "design.brand-colors",
]);
