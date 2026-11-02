/**
 * Lifecycle and availability rules. Pure functions, no I/O.
 *
 * Lifecycle: draft -> ready-for-review -> approved -> published, then
 * archived or deprecated. Published versions are immutable: a change creates
 * a new version (a new manifest with version + 1), never an edit in place.
 */
import { AVAILABLE_FEATURES, editorCanOpenTemplates, getEditor } from "./editors.js";
import type { LifecycleState, TemplateManifest } from "./schema.js";

const TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  draft: ["ready-for-review", "archived"],
  "ready-for-review": ["draft", "approved", "archived"],
  approved: ["draft", "published", "archived"],
  published: ["deprecated", "archived"],
  deprecated: ["archived", "published"],
  archived: ["draft"],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: LifecycleState): readonly LifecycleState[] {
  return TRANSITIONS[from];
}

export type UnavailableReason =
  | { code: "editor-unavailable"; message: string }
  | { code: "editor-no-templates"; message: string }
  | { code: "feature-missing"; message: string; features: string[] }
  | { code: "not-published"; message: string }
  | { code: "deprecated"; message: string };

export interface Availability {
  usable: boolean;
  reasons: UnavailableReason[];
}

/**
 * Whether a template can be shown as usable right now. This is the single
 * rule the API and UI use: published, not deprecated, the editor exists and
 * accepts templates, and every required feature exists on this build.
 */
export function evaluateAvailability(t: Pick<TemplateManifest, "editor" | "requiredFeatures" | "lifecycle">): Availability {
  const reasons: UnavailableReason[] = [];
  const editor = getEditor(t.editor);
  if (!editor.available) reasons.push({ code: "editor-unavailable", message: editor.unavailableReason ?? `${editor.label} is not available yet.` });
  else if (!editorCanOpenTemplates(t.editor)) reasons.push({ code: "editor-no-templates", message: editor.unavailableReason ?? `${editor.label} does not open templates yet.` });
  const missing = t.requiredFeatures.filter((f) => !AVAILABLE_FEATURES.has(f));
  if (missing.length) reasons.push({ code: "feature-missing", message: `Needs ${missing.join(", ")}, which BINHI does not support yet.`, features: missing });
  if (t.lifecycle === "deprecated") reasons.push({ code: "deprecated", message: "This template is deprecated and is no longer offered for new projects." });
  else if (t.lifecycle !== "published") reasons.push({ code: "not-published", message: "This template is not published." });
  return { usable: reasons.length === 0, reasons };
}
