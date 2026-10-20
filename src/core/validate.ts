import type { Node, Page, SiteDocument } from "./schema/document.js";
import { SiteDocument as SiteDocumentSchema } from "./schema/document.js";
import { walk } from "./schema/traverse.js";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  pageId?: string;
  nodeId?: string;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Pre-publication and accessibility checks. Errors block publishing;
 * warnings are shown in the editor status bar and the publish dialog.
 * Shared by the editor (live feedback) and the server (gate).
 */
export function validateForPublish(doc: SiteDocument): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const parsed = SiteDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    errors.push({ severity: "error", code: "INVALID_DOCUMENT", message: `The website document is invalid: ${first ? `${first.path.join(".")}: ${first.message}` : "unknown"}` });
    return { ok: false, errors, warnings };
  }
  for (const page of doc.pages) checkPage(doc, page, errors, warnings);
  if (doc.header) checkTree(doc.header, undefined, warnings, { h1: 0, lastLevel: 0 });
  if (doc.footer) checkTree(doc.footer, undefined, warnings, { h1: 0, lastLevel: 0 });
  return { ok: errors.length === 0, errors, warnings };
}

function checkPage(doc: SiteDocument, page: Page, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  if (page.sections.length === 0) warnings.push({ severity: "warning", code: "EMPTY_PAGE", message: `"${page.name}" has no content`, pageId: page.id });
  if (!page.seo.title && !page.isHome) warnings.push({ severity: "warning", code: "NO_SEO_TITLE", message: `"${page.name}" has no page title for search engines`, pageId: page.id });
  if (!page.seo.description && !doc.settings.defaultSeoDescription) warnings.push({ severity: "warning", code: "NO_SEO_DESCRIPTION", message: `"${page.name}" has no description for search and social previews`, pageId: page.id });
  const anchors = new Set<string>();
  const state = { h1: 0, lastLevel: 0 };
  for (const s of page.sections) {
    checkTree(s, page.id, warnings, state);
    walk(s, (n) => {
      if (n.anchorId) {
        if (anchors.has(n.anchorId)) errors.push({ severity: "error", code: "DUPLICATE_ANCHOR", message: `Two elements on "${page.name}" use the anchor "${n.anchorId}"`, pageId: page.id, nodeId: n.id });
        anchors.add(n.anchorId);
      }
    });
  }
  if (state.h1 === 0) warnings.push({ severity: "warning", code: "NO_H1", message: `"${page.name}" has no main heading (H1)`, pageId: page.id });
  if (state.h1 > 1) warnings.push({ severity: "warning", code: "MULTIPLE_H1", message: `"${page.name}" has ${state.h1} main headings; screen readers expect one`, pageId: page.id });
}

function checkTree(root: Node, pageId: string | undefined, warnings: ValidationIssue[], state: { h1: number; lastLevel: number }) {
  walk(root, (n) => {
    if (n.hidden) return;
    switch (n.type) {
      case "heading": {
        const level = Number(n.props.level ?? 2);
        if (level === 1) state.h1++;
        if (state.lastLevel && level > state.lastLevel + 1) warnings.push({ severity: "warning", code: "HEADING_SKIP", message: `Heading level jumps from H${state.lastLevel} to H${level}`, pageId, nodeId: n.id });
        state.lastLevel = level;
        if (!String(n.props.text ?? "").trim()) warnings.push({ severity: "warning", code: "EMPTY_HEADING", message: "A heading is empty", pageId, nodeId: n.id });
        break;
      }
      case "image": {
        if (!n.props.src) warnings.push({ severity: "warning", code: "PLACEHOLDER_IMAGE", message: "An image placeholder has no picture yet", pageId, nodeId: n.id });
        else if (!n.props.decorative && !String(n.props.alt ?? "").trim()) warnings.push({ severity: "warning", code: "MISSING_ALT", message: "An image has no alt text (describe it, or mark it decorative)", pageId, nodeId: n.id });
        break;
      }
      case "gallery": {
        const imgs = (n.props.images as { src?: string; alt?: string; decorative?: boolean }[]) ?? [];
        if (!imgs.length) warnings.push({ severity: "warning", code: "EMPTY_GALLERY", message: "A gallery has no images", pageId, nodeId: n.id });
        if (imgs.some((i) => i.src && !i.decorative && !i.alt?.trim())) warnings.push({ severity: "warning", code: "MISSING_ALT", message: "Some gallery images have no alt text", pageId, nodeId: n.id });
        break;
      }
      case "button": {
        const link = n.props.link as { kind: string } | undefined;
        if (!link || link.kind === "none") warnings.push({ severity: "warning", code: "BUTTON_NO_LINK", message: `The button "${String(n.props.label ?? "")}" doesn't link anywhere`, pageId, nodeId: n.id });
        if (!String(n.props.label ?? "").trim() && !n.props.ariaLabel) warnings.push({ severity: "warning", code: "BUTTON_NO_LABEL", message: "A button has no label", pageId, nodeId: n.id });
        break;
      }
      case "form": {
        if (!((n.props.fields as unknown[]) ?? []).length) warnings.push({ severity: "warning", code: "FORM_NO_FIELDS", message: "A form has no fields", pageId, nodeId: n.id });
        break;
      }
      case "video": {
        const p = n.props as { provider: string; videoId: string; src: string };
        if ((p.provider !== "file" && !p.videoId) || (p.provider === "file" && !p.src)) warnings.push({ severity: "warning", code: "VIDEO_EMPTY", message: "A video block has no video", pageId, nodeId: n.id });
        break;
      }
      case "map": {
        if (!String(n.props.address ?? "").trim()) warnings.push({ severity: "warning", code: "MAP_EMPTY", message: "A map has no address", pageId, nodeId: n.id });
        break;
      }
      case "icon": {
        if (n.props.link && !n.a11y?.label) warnings.push({ severity: "warning", code: "ICON_LINK_NO_LABEL", message: "A linked icon needs an accessibility label", pageId, nodeId: n.id });
        break;
      }
    }
  });
}
