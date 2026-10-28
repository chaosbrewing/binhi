import type { Db } from "../db/client.js";
import { audit } from "../audit.js";
import { badRequest, notFound } from "../security/errors.js";
import { DesignDocument } from "../../core/creative/design.js";
import { createSiteDocument, getTemplate } from "../../core/templates/index.js";
import { renderPage } from "../../core/render/html.js";
import {
  CATALOG,
  CATEGORIES,
  COLLECTIONS,
  DESIGN_CONTENT,
  EDITORS,
  FORMAT_EDITORS,
  FORMAT_FILTERS,
  ORIENTATIONS,
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

export interface LibraryDeps {
  db: Db;
  projects: ProjectService;
  sites: SiteService;
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

  /** The design document of a built-in design template, validated before it leaves the server. */
  designDocument(id: string): DesignDocument {
    const m = this.find(id);
    if (!m || m.content.type !== "builtin-design") throw notFound("Template not found");
    const raw = this.designs[m.content.key];
    if (raw === undefined) throw notFound("Template content is missing");
    return DesignDocument.parse(raw);
  }

  /** Preview HTML for a built-in website template (rendered with placeholder content, no scripts). */
  sitePreviewHtml(id: string, slug?: string): string {
    const m = this.find(id);
    if (!m || m.content.type !== "builtin-site") throw notFound("Template not found");
    const doc = createSiteDocument(m.content.builder, m.name);
    const page = slug ? doc.pages.find((p) => p.slug === slug) : doc.pages.find((p) => p.isHome);
    if (!page) throw notFound("Page not found");
    return renderPage(doc, page.id, { mode: "preview", baseHref: `/api/template-library/templates/${m.id}/preview/`, formAction: () => "#" });
  }

  /** Create a new, independent project from a template. Returns where to open it. */
  async use(ownerId: string, id: string, input: { name?: string }, ip?: string): Promise<UseResult> {
    const m = this.find(id);
    if (!m) throw notFound("Template not found");
    const availability = evaluateAvailability(m);
    if (!availability.usable) throw badRequest(availability.reasons[0]?.message ?? "This template is not available");
    const name = (input.name ?? m.name).trim().slice(0, 80);
    if (!name) throw badRequest("Give your project a name");

    if (m.content.type === "builtin-site") {
      const legacy = m.content.builder;
      if (!getTemplate(legacy)) throw badRequest("This template's content is missing");
      const site = await this.deps.sites.create(ownerId, { name, templateId: legacy, source: { canonicalId: m.id, version: m.version } }, ip);
      await audit(this.deps.db, { actorId: ownerId, siteId: site.id, action: "template.used", details: { templateId: m.id, version: m.version, kind: "website" }, ip });
      return { kind: "website", id: site.id, path: `/sites/${site.id}/edit` };
    }
    if (m.content.type === "builtin-design") {
      // A deep copy: the project owns its own document, the shared template is never referenced.
      const document = JSON.parse(JSON.stringify(this.designDocument(id)));
      const project = await this.deps.projects.create(ownerId, { kind: "design", name, document }, ip);
      await audit(this.deps.db, { actorId: ownerId, action: "template.used", details: { templateId: m.id, version: m.version, kind: "design", projectId: project.id }, ip });
      return { kind: "design", id: project.id, path: `/studio/design/${project.id}` };
    }
    throw badRequest("This template cannot be used directly");
  }
}
