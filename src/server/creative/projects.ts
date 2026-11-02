import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { projects } from "../db/schema.js";
import { newId } from "../../core/ids.js";
import { parseProjectDocument, projectAssetIds, type ProjectKind } from "../../core/creative/index.js";
import { badRequest, conflict, notFound } from "../security/errors.js";
import { audit } from "../audit.js";
import type { LibraryService } from "./library.js";

export interface ProjectSummary {
  id: string;
  kind: ProjectKind;
  name: string;
  revision: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  /** Small, kind-specific facts for list cards (no document payload). */
  meta: { width?: number; height?: number; sourceAssetId?: string; layers?: number };
  /** Personal-template details; empty for every other kind. They are not part of the document or its revision. */
  description: string | null;
  category: string | null;
  tags: string[];
  archived: boolean;
}

export interface ProjectDetail extends ProjectSummary {
  document: unknown;
}

const MAX_PROJECTS_PER_OWNER = 500;

function metaOf(kind: ProjectKind, document: unknown): ProjectSummary["meta"] {
  const d = document as Record<string, unknown>;
  if (kind === "photo") {
    const recipe = d.recipe as { width?: number; height?: number } | undefined;
    return { width: recipe?.width, height: recipe?.height, sourceAssetId: d.sourceAssetId as string };
  }
  return { width: d.width as number, height: d.height as number, layers: Array.isArray(d.layers) ? d.layers.length : 0 };
}

function toSummary(row: typeof projects.$inferSelect): ProjectSummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    revision: row.revision,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    meta: metaOf(row.kind, row.document),
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    archived: row.archivedAt !== null,
  };
}

/** Where a project came from, recorded when it is created from a template. */
export interface ProjectSource {
  templateId: string;
  version: number | null;
}

/**
 * One list, one ownership rule and one revision model for every creative
 * project kind. Documents are validated per kind on every write; the server
 * never trusts a client document. Website projects stay in SiteService.
 */
export class ProjectService {
  constructor(
    private readonly db: Db,
    private readonly library: LibraryService,
  ) {}

  async list(ownerId: string, kind?: ProjectKind): Promise<ProjectSummary[]> {
    const where = kind ? and(eq(projects.ownerId, ownerId), eq(projects.kind, kind), isNull(projects.deletedAt)) : and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt));
    const rows = await this.db.select().from(projects).where(where).orderBy(desc(projects.updatedAt));
    return rows.map(toSummary);
  }

  async getOwned(ownerId: string, projectId: string): Promise<typeof projects.$inferSelect> {
    const rows = await this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.deletedAt))).limit(1);
    if (!rows[0]) throw notFound("Project not found");
    return rows[0];
  }

  async summary(ownerId: string, projectId: string): Promise<ProjectSummary> {
    return toSummary(await this.getOwned(ownerId, projectId));
  }

  async get(ownerId: string, projectId: string): Promise<ProjectDetail> {
    const row = await this.getOwned(ownerId, projectId);
    return { ...toSummary(row), document: row.document };
  }

  async create(ownerId: string, input: { kind: ProjectKind; name: string; document: unknown; source?: ProjectSource; details?: { description: string | null; category: string | null; tags: string[] } }, ip?: string): Promise<ProjectDetail> {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw badRequest("Give your project a name");
    const document = parseProjectDocument(input.kind, input.document);
    const count = await this.db.select({ n: sql<number>`count(*)::int` }).from(projects).where(and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)));
    if ((count[0]?.n ?? 0) >= MAX_PROJECTS_PER_OWNER) throw badRequest(`You can have up to ${MAX_PROJECTS_PER_OWNER} projects`);
    const id = newId("prj");
    const now = new Date();
    await this.db.insert(projects).values({ id, ownerId, kind: input.kind, name, document, schemaVersion: document.schemaVersion, revision: 0, ...(input.source ? { sourceTemplateId: input.source.templateId, sourceTemplateVersion: input.source.version } : {}), ...(input.details && input.kind === "design-template" ? { description: input.details.description, category: input.details.category, tags: input.details.tags } : {}), createdAt: now, updatedAt: now });
    await this.library.setUsages(ownerId, id, projectAssetIds(input.kind, document));
    await audit(this.db, { actorId: ownerId, action: "project.created", details: { id, kind: input.kind }, ip });
    return this.get(ownerId, id);
  }

  /** Copy a project (used for "use template" and "duplicate"); the copy starts at revision 0 with the requested kind. */
  async duplicate(ownerId: string, projectId: string, input: { name?: string; kind?: ProjectKind; source?: ProjectSource }, ip?: string): Promise<ProjectDetail> {
    const source = await this.getOwned(ownerId, projectId);
    const kind = input.kind ?? source.kind;
    if ((kind === "photo") !== (source.kind === "photo")) throw badRequest("A photo project cannot become a design");
    // A copy of a personal template keeps its description, category and tags (but starts un-archived).
    const details = kind === "design-template" ? { description: source.description, category: source.category, tags: source.tags ?? [] } : undefined;
    return this.create(ownerId, { kind, name: input.name ?? `${source.name} copy`, document: source.document, ...(input.source ? { source: input.source } : {}), ...(details ? { details } : {}) }, ip);
  }

  /**
   * Save a new document and/or name. `baseRevision` must equal the stored
   * revision, otherwise the caller gets a 409 carrying the server copy, the
   * same contract the website editor uses.
   */
  async update(ownerId: string, projectId: string, input: { name?: string; document?: unknown; baseRevision: number }, ip?: string): Promise<ProjectDetail> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.deletedAt))).for("update").limit(1);
      const row = rows[0];
      if (!row) throw notFound("Project not found");
      if (input.baseRevision !== row.revision) throw conflict("Your copy of this project is out of date.", { serverRevision: row.revision, document: row.document });
      const set: Partial<typeof projects.$inferInsert> = { updatedAt: new Date(), revision: row.revision + 1 };
      if (input.name !== undefined) {
        const name = input.name.trim().slice(0, 80);
        if (!name) throw badRequest("Give your project a name");
        set.name = name;
      }
      if (input.document !== undefined) {
        const document = parseProjectDocument(row.kind, input.document);
        set.document = document;
        set.schemaVersion = document.schemaVersion;
      }
      await tx.update(projects).set(set).where(eq(projects.id, projectId));
      const after = (await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0]!;
      return { ...toSummary(after), document: after.document };
    }).then(async (detail) => {
      if (input.document !== undefined) await this.library.setUsages(ownerId, projectId, projectAssetIds(detail.kind, detail.document));
      await audit(this.db, { actorId: ownerId, action: "project.updated", details: { id: projectId, revision: detail.revision }, ip });
      return detail;
    });
  }

  async softDelete(ownerId: string, projectId: string, ip?: string): Promise<void> {
    await this.getOwned(ownerId, projectId);
    await this.db.update(projects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId));
    await this.library.setUsages(ownerId, projectId, []);
    await audit(this.db, { actorId: ownerId, action: "project.deleted", details: { id: projectId }, ip });
  }
}
