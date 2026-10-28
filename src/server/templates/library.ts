import type { Db } from "../db/client.js";
import { audit } from "../audit.js";
import { badRequest, notFound } from "../security/errors.js";
import type { DesignDocument } from "../../core/creative/design.js";
import { createSiteDocument, getTemplate } from "../../core/templates/index.js";
import { renderPage } from "../../core/render/html.js";
import { applyOperation } from "../../core/ops/apply.js";
import { brandKitToThemePatch } from "../../core/creative/brandKit.js";
import { newId } from "../../core/ids.js";
import {
  CATALOG,
  CATEGORIES,
  COLLECTIONS,
  DESIGN_CONTENT,
  parseDesignContent,
  applyBrandKitToDesign,
  type ParsedDesignContent,
  EDITORS,
  FORMAT_EDITORS,
  FORMAT_FILTERS,
  COLOR_FAMILIES,
  COLOR_LABEL,
  ORIENTATIONS,
  templateColorFamilies,
  STYLE_IDS,
  STYLE_LABEL,
  editorCanOpenTemplates,
  evaluateAvailability,
  searchTemplates,
  toCard,
  validateCatalog,
  type Collection,
  type Manifest,
  type TemplateCard,
  type TemplateQuery,
} from "../../core/templates/library/index.js";
import type { ProjectService } from "../creative/projects.js";
import type { SiteService } from "../sites/service.js";
import type { BrandKitService } from "../creative/brandKits.js";

export interface LibraryDeps {
  db: Db;
  projects: ProjectService;
  sites: SiteService;
  brandKits: BrandKitService;
  /** Injected for tests; the app uses the shipped catalog. */
  catalog?: readonly unknown[];
  collections?: readonly Collection[];
  designs?: Readonly<Record<string, unknown>>;
  log?: (message: string) => void;
}

export const PAGE_SIZE_MAX = 48;

export interface ListResult {
  items: TemplateCard[];
  total: number;
  page: number;
  pageSize: number;
  facets: ReturnType<typeof searchTemplates>["facets"];
}

export interface UseResult {
  kind: "website" | "design";
  id: string;
  /** Client route that opens the new project in its editor. */
  path: string;
  /** Present when a Brand Kit was applied: what changed, in words the UI can show. */
  brand?: { kitName: string; changes: number; adjustments: string[]; logoPlaced: boolean };
}

/**
 * Serves the built-in template catalog. Invalid records are never served
 * (the catalog fails closed), unusable templates are never listed as usable,
 * and "use" always creates a new project owned by the caller through the
 * same services the editors use, so the shared template can never be edited.
 */
export class TemplateLibraryService {
  private readonly manifests: Manifest[];
  private readonly collections: Collection[];
  private readonly designs: Readonly<Record<string, unknown>>;

  constructor(private readonly deps: LibraryDeps) {
    this.designs = deps.designs ?? DESIGN_CONTENT;
    const { issues, valid } = validateCatalog(deps.catalog ?? CATALOG);
    const bad = new Set(issues.map((i) => i.where));
    for (const i of issues) deps.log?.(`template catalog: ${i.where}: ${i.message}`);
    // Only published, public, valid templates are ever served from the built-in catalog.
    this.manifests = valid.filter((m) => !bad.has(m.id) && m.visibility === "public" && m.lifecycle === "published");
    const ids = new Set(this.manifests.map((m) => m.id));
    this.collections = (deps.collections ?? COLLECTIONS).map((c) => ({ ...c, templateIds: c.templateIds.filter((id) => ids.has(id)) })).filter((c) => c.templateIds.length > 0);
  }

  /** Taxonomy plus honest availability. Counts are of usable templates only. */
  taxonomy(): unknown {
    const usable = this.manifests.filter((m) => evaluateAvailability(m).usable);
    const countCategory = (id: string) => usable.filter((m) => m.primaryCategory === id || m.secondaryCategories.includes(id)).length;
    return {
      formats: FORMAT_FILTERS.map((f) => {
        if (f.id === "all") return { id: f.id, label: f.label, count: usable.length, available: usable.length > 0, note: null };
        const editors = FORMAT_EDITORS[f.id];
        const editorOpen = editors.some(editorCanOpenTemplates);
        const count = usable.filter((m) => m.format === f.id).length;
        const note = editorOpen ? (count === 0 ? "No templates yet" : null) : (editors.map((e) => EDITORS[e].unavailableReason).find(Boolean) ?? "Not available yet");
        return { id: f.id, label: f.label, count, available: editorOpen && count > 0, note };
      }),
      categories: CATEGORIES.map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name,
        formats: c.formats,
        count: countCategory(c.id),
        subcategories: c.subcategories.map((name) => ({ name })),
      })),
      styles: STYLE_IDS.map((id) => ({ id, label: STYLE_LABEL[id], count: usable.filter((m) => m.styles.includes(id)).length })),
      orientations: ORIENTATIONS.filter((o) => o !== "responsive"),
      colors: COLOR_FAMILIES.map((id) => ({ id, label: COLOR_LABEL[id], count: usable.filter((m) => templateColorFamilies(m).has(id)).length })),
      editors: (["website", "design"] as const).map((id) => ({ id, label: EDITORS[id].label, count: usable.filter((m) => m.editor === id).length })),
      collections: this.collections.map((c) => ({ id: c.id, title: c.title, description: c.description, templateIds: c.templateIds })),
      total: usable.length,
    };
  }

  list(query: TemplateQuery & { page?: number; pageSize?: number }, viewerId?: string): ListResult {
    const usable = this.manifests.filter((m) => evaluateAvailability(m).usable);
    const result = searchTemplates(usable, query);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 24), PAGE_SIZE_MAX);
    const page = Math.max(1, query.page ?? 1);
    const slice = result.items.slice((page - 1) * pageSize, page * pageSize);
    return { items: slice.map((m) => toCard(m, viewerId)), total: result.total, page, pageSize, facets: result.facets };
  }

  /** Cards for specific ids in the given order (favorites, recents, collections). Unknown or unusable ids are dropped. */
  byIds(ids: readonly string[], viewerId?: string): TemplateCard[] {
    const out: TemplateCard[] = [];
    for (const id of ids.slice(0, 48)) {
      const m = this.find(id);
      if (m && evaluateAvailability(m).usable) out.push(toCard(m, viewerId));
    }
    return out;
  }

  private find(id: string): Manifest | undefined {
    return this.manifests.find((m) => m.id === id) ?? this.manifests.find((m) => m.legacyIds.includes(id));
  }

  detail(id: string, viewerId?: string): TemplateCard & { keywords: string[]; license: Manifest["license"]; requiredFeatures: string[]; dependencies: Manifest["dependencies"]; brandTokens: string[]; availabilityNotes: string; hasDocument: boolean } {
    const m = this.find(id);
    if (!m) throw notFound("Template not found");
    return {
      ...toCard(m, viewerId),
      keywords: m.keywords,
      license: m.license,
      requiredFeatures: m.requiredFeatures,
      dependencies: m.dependencies,
      brandTokens: m.dependencies.brandTokens,
      availabilityNotes: m.availabilityNotes,
      hasDocument: m.documentKind === "design",
    };
  }

  /** The content of a built-in design template (document and brand bindings), validated before it leaves the server. */
  designContent(id: string): ParsedDesignContent {
    const m = this.find(id);
    if (!m || m.content.type !== "builtin-design") throw notFound("Template not found");
    const raw = this.designs[m.content.key];
    if (raw === undefined) throw notFound("Template content is missing");
    return parseDesignContent(raw);
  }

  designDocument(id: string): DesignDocument {
    return this.designContent(id).document;
  }

  /**
   * Preview HTML for a built-in website template (placeholder content, no
   * scripts). With a Brand Kit the theme patch is applied in memory only:
   * the kit must belong to the viewer and nothing is saved.
   */
  async sitePreviewHtml(id: string, slug?: string, viewer?: { ownerId: string; kitId?: string }): Promise<string> {
    const m = this.find(id);
    if (!m || m.content.type !== "builtin-site") throw notFound("Template not found");
    let doc = createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
    if (viewer?.kitId) {
      const kit = await this.deps.brandKits.get(viewer.ownerId, viewer.kitId);
      doc = applyOperation(doc, { type: "updateTheme", patch: brandKitToThemePatch(kit.document) }).document;
    }
    const page = slug ? doc.pages.find((p) => p.slug === slug) : doc.pages.find((p) => p.isHome);
    if (!page) throw notFound("Page not found");
    return renderPage(doc, page.id, { mode: "preview", baseHref: `/api/template-library/templates/${m.id}/preview/`, formAction: () => "#" });
  }

  /**
   * Create a new design from one of the caller's own saved templates. The
   * template stays untouched, the new project is independent, and the use is
   * recorded like any other. Another account's template is simply not found.
   */
  async usePersonal(ownerId: string, projectId: string, input: { name?: string }, ip?: string): Promise<UseResult> {
    const source = await this.deps.projects.getOwned(ownerId, projectId);
    if (source.kind !== "design-template") throw notFound("Template not found");
    const name = (input.name ?? source.name).trim().slice(0, 80);
    if (!name) throw badRequest("Give your project a name");
    const project = await this.deps.projects.duplicate(ownerId, projectId, { kind: "design", name }, ip);
    await audit(this.deps.db, { actorId: ownerId, action: "template.used", details: { templateId: `personal:${projectId}`, version: source.revision, kind: "design", personal: true, projectId: project.id }, ip });
    return { kind: "design", id: project.id, path: `/studio/design/${project.id}` };
  }

  /** Create a new, independent project from a template. Returns where to open it. */
  async use(ownerId: string, id: string, input: { name?: string; brandKitId?: string }, ip?: string): Promise<UseResult> {
    const m = this.find(id);
    if (!m) throw notFound("Template not found");
    const availability = evaluateAvailability(m);
    if (!availability.usable) throw badRequest(availability.reasons[0]?.message ?? "This template is not available");
    const name = (input.name ?? m.name).trim().slice(0, 80);
    if (!name) throw badRequest("Give your project a name");

    // A kit is loaded (and its ownership checked) before anything is created.
    const kit = input.brandKitId ? await this.deps.brandKits.get(ownerId, input.brandKitId) : null;

    if (m.content.type === "builtin-site") {
      const legacy = m.content.builder;
      if (!getTemplate(legacy)) throw badRequest("This template's content is missing");
      const site = await this.deps.sites.create(ownerId, { name, templateId: legacy, source: { canonicalId: m.id, version: m.version } }, ip);
      let brand: UseResult["brand"];
      if (kit) {
        // Revision 0 stays the untouched template; the kit lands as revision 1, so history can restore the original.
        const patch = brandKitToThemePatch(kit.document);
        await this.deps.sites.applyBatch(ownerId, site.id, { baseRevision: site.revision, batchId: newId("kit", 12), ops: [{ type: "updateTheme", patch }] }, ip);
        brand = { kitName: kit.name, changes: Object.keys(patch.colors).length + 2, adjustments: [], logoPlaced: false };
      }
      await audit(this.deps.db, { actorId: ownerId, siteId: site.id, action: "template.used", details: { templateId: m.id, version: m.version, kind: "website", ...(kit ? { brandKitId: kit.id } : {}) }, ip });
      return { kind: "website", id: site.id, path: `/sites/${site.id}/edit`, ...(brand ? { brand } : {}) };
    }
    if (m.content.type === "builtin-design") {
      // The project owns its own document; the shared template is never referenced or modified.
      const content = this.designContent(id);
      const applied = kit ? applyBrandKitToDesign(content, kit.document) : null;
      const document = JSON.parse(JSON.stringify(applied ? applied.document : content.document));
      const project = await this.deps.projects.create(ownerId, { kind: "design", name, document }, ip);
      await audit(this.deps.db, { actorId: ownerId, action: "template.used", details: { templateId: m.id, version: m.version, kind: "design", projectId: project.id, ...(kit ? { brandKitId: kit.id } : {}) }, ip });
      return { kind: "design", id: project.id, path: `/studio/design/${project.id}`, ...(applied && kit ? { brand: { kitName: kit.name, changes: applied.changes.length, adjustments: applied.adjustments, logoPlaced: applied.logoPlaced } } : {}) };
    }
    throw badRequest("This template cannot be used directly");
  }
}
