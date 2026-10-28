import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import type { BinhiApp } from "../../src/server/app.js";
import { api, signup, testApp, type Session } from "../helpers.js";
import { designTemplate, siteTemplate } from "../template-fixtures.js";
import { DesignDocument, createDesignDocument, makeLayer } from "../../src/core/creative/index.js";
import { auditLog, projects, sites, siteRevisions } from "../../src/server/db/schema.js";
import { TemplateLibraryService } from "../../src/server/templates/library.js";

/** A complete, valid fixture design (not shipped content). */
function quoteDoc(): DesignDocument {
  const doc = createDesignDocument(1080, 1080);
  doc.background = "#f4f1ea";
  doc.layers.push(makeLayer("rect", doc, { x: 80, y: 80, width: 920, height: 920, fill: "#111111", radius: 24, name: "Frame" }));
  doc.layers.push(makeLayer("text", doc, { text: "Say it plainly.", color: "#f4f1ea", fontSize: 96, name: "Quote" }));
  return DesignDocument.parse(doc);
}

const catalog = [
  designTemplate({ id: "tpl.design.quote-card", name: "Quote card", keywords: ["quote"], styles: ["minimal"] }),
  designTemplate({ id: "tpl.design.story-sale", name: "Story sale", description: "A vertical story about a sale.", tags: [], keywords: ["discount"], subcategory: "social-media/instagram-stories", size: { kind: "fixed", width: 1080, height: 1920 }, orientation: "portrait", styles: ["playful"], content: { type: "builtin-design", key: "quote-card" }, publishedAt: "2026-10-20" }),
  siteTemplate({ id: "tpl.site.portfolio", name: "Personal portfolio", description: "Introduce yourself and show your work.", tags: [], keywords: ["cv"], styles: ["elegant"], content: { type: "builtin-site", builder: "portfolio" } }),
  // Never served: wrong editor/kind, needs a feature that does not exist, not published.
  designTemplate({ id: "tpl.design.pitch-deck", name: "Pitch deck", primaryCategory: "presentations-pitch-decks", subcategory: "presentations-pitch-decks/startup-pitch-decks", format: "presentations", editor: "presentation" }),
  designTemplate({ id: "tpl.design.icon-badge", name: "Icon badge", requiredFeatures: ["design.icons"] }),
  designTemplate({ id: "tpl.design.draft-one", name: "Draft one", lifecycle: "draft", publishedAt: null, preview: { thumbnail: null, alt: "x" } }),
];

let b: BinhiApp;
let alice: Session;
let bob: Session;
beforeAll(async () => {
  b = await testApp({}, { templates: { catalog, designs: { "quote-card": quoteDoc() }, collections: [{ id: "starter", title: "Starter", description: "x", templateIds: ["tpl.design.quote-card", "tpl.missing"] }] } });
  alice = await signup(b.app);
  bob = await signup(b.app);
});
afterAll(async () => b.close());

describe("template library API: discovery", () => {
  it("requires a signed-in user", async () => {
    expect((await api(b.app, null).get("/api/template-library/templates")).statusCode).toBe(401);
    expect((await api(b.app, null).get("/api/template-library/taxonomy")).statusCode).toBe(401);
    expect((await api(b.app, null).post("/api/template-library/templates/tpl.design.quote-card/use", {})).statusCode).toBe(401);
  });

  it("serves only valid, published, usable templates (the catalog fails closed)", async () => {
    const res = await api(b.app, alice).get("/api/template-library/templates");
    expect(res.statusCode).toBe(200);
    const { items, total } = res.json();
    expect(total).toBe(3);
    expect(items.map((t: { id: string }) => t.id).sort()).toEqual(["tpl.design.quote-card", "tpl.design.story-sale", "tpl.site.portfolio"]);
    // Cards never carry documents.
    for (const card of items) {
      expect(card).not.toHaveProperty("document");
      expect(card.usable).toBe(true);
    }
  });

  it("searches, filters and paginates on the server", async () => {
    const get = async (qs: string) => (await api(b.app, alice).get(`/api/template-library/templates?${qs}`)).json();
    expect((await get("q=quote")).items.map((t: { id: string }) => t.id)).toEqual(["tpl.design.quote-card"]);
    expect((await get("q=cv")).items.map((t: { id: string }) => t.id)).toEqual(["tpl.site.portfolio"]);
    expect((await get("format=websites")).total).toBe(1);
    expect((await get("format=social")).total).toBe(2);
    expect((await get("format=forms")).total).toBe(0);
    expect((await get("style=playful")).items[0].id).toBe("tpl.design.story-sale");
    expect((await get("orientation=portrait")).total).toBe(1);
    const page1 = await get("pageSize=2&page=1");
    const page2 = await get("pageSize=2&page=2");
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
    expect(page1.total).toBe(3);
    expect((await api(b.app, alice).get("/api/template-library/templates?format=nope")).statusCode).toBe(400);
    expect((await api(b.app, alice).get("/api/template-library/templates?pageSize=500")).statusCode).toBe(400);
  });

  it("describes the taxonomy honestly: 30 categories, unavailable editors explained", async () => {
    const t = (await api(b.app, alice).get("/api/template-library/taxonomy")).json();
    expect(t.categories).toHaveLength(30);
    expect(t.total).toBe(3);
    const fmt = Object.fromEntries(t.formats.map((f: { id: string }) => [f.id, f]));
    expect(fmt.social.available).toBe(true);
    expect(fmt.websites.available).toBe(true);
    for (const id of ["presentations", "forms", "video", "documents"]) {
      expect(fmt[id].available).toBe(false);
      expect(fmt[id].note).toBeTruthy();
    }
    // Secondary categories are discoverable without a second record.
    expect(t.categories.find((c: { id: string }) => c.id === "social-media").count).toBe(2);
    expect(t.collections).toEqual([{ id: "starter", title: "Starter", description: "x", templateIds: ["tpl.design.quote-card"] }]);
  });

  it("resolves cards by id for favorites, drops unknown or unusable ids and keeps order", async () => {
    const res = await api(b.app, alice).post("/api/template-library/cards", { ids: ["tpl.site.portfolio", "tpl.nope", "tpl.design.pitch-deck", "tpl.design.quote-card"] });
    expect(res.json().items.map((t: { id: string }) => t.id)).toEqual(["tpl.site.portfolio", "tpl.design.quote-card"]);
  });

  it("returns detail, resolves legacy ids and 404s unknown templates", async () => {
    const d = (await api(b.app, alice).get("/api/template-library/templates/tpl.site.portfolio")).json().template;
    expect(d).toMatchObject({ id: "tpl.site.portfolio", editorLabel: "Website Builder", hasDocument: false, license: { id: "binhi-original" } });
    expect((await api(b.app, alice).get("/api/template-library/templates/portfolio")).json().template.id).toBe("tpl.site.portfolio");
    expect((await api(b.app, alice).get("/api/template-library/templates/tpl.design.pitch-deck")).statusCode).toBe(404);
    expect((await api(b.app, alice).get("/api/template-library/templates/tpl.design.draft-one")).statusCode).toBe(404);
  });
});

describe("template library API: previews", () => {
  it("returns a validated design document for design templates only", async () => {
    const res = await api(b.app, alice).get("/api/template-library/templates/tpl.design.quote-card/document");
    expect(res.statusCode).toBe(200);
    expect(DesignDocument.safeParse(res.json().document).success).toBe(true);
    expect((await api(b.app, alice).get("/api/template-library/templates/tpl.site.portfolio/document")).statusCode).toBe(404);
  });

  it("renders website previews script-free and sandboxed", async () => {
    const res = await api(b.app, alice).get("/api/template-library/templates/tpl.site.portfolio/preview/");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("script-src 'none'");
    expect(csp).toMatch(/;\s*sandbox$/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body).not.toMatch(/<script/i);
    expect((await api(b.app, alice).get("/api/template-library/templates/tpl.design.quote-card/preview/")).statusCode).toBe(404);
    expect((await api(b.app, null).get("/api/template-library/templates/tpl.site.portfolio/preview/")).statusCode).toBe(401);
  });
});

describe("template library API: create from template", () => {
  it("creates an independent, owned design project and leaves the template untouched", async () => {
    const before = (await api(b.app, alice).get("/api/template-library/templates/tpl.design.quote-card/document")).json().document;
    const res = await api(b.app, alice).post("/api/template-library/templates/tpl.design.quote-card/use", { name: "  My quote  " });
    expect(res.statusCode).toBe(200);
    const result = res.json().result;
    expect(result).toMatchObject({ kind: "design", path: expect.stringMatching(/^\/studio\/design\/prj_/) });

    const project = (await api(b.app, alice).get(`/api/projects/${result.id}`)).json().project;
    expect(project).toMatchObject({ kind: "design", name: "My quote", revision: 0 });
    expect(project.document).toEqual(before);

    // Editing the project never changes the shared template.
    const edited = structuredClone(project.document) as DesignDocument;
    edited.layers[1] = { ...edited.layers[1]!, text: "Changed" } as never;
    const saved = await api(b.app, alice).patch(`/api/projects/${project.id}`, { document: edited, baseRevision: 0 });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().project.revision).toBe(1);
    const after = (await api(b.app, bob).get("/api/template-library/templates/tpl.design.quote-card/document")).json().document;
    expect(after).toEqual(before);

    // Ownership: another account cannot see or change it.
    expect((await api(b.app, bob).get(`/api/projects/${project.id}`)).statusCode).toBe(404);
    expect((await api(b.app, bob).patch(`/api/projects/${project.id}`, { name: "x", baseRevision: 1 })).statusCode).toBe(404);
  });

  it("gives each use its own project with its own identity", async () => {
    const a = (await api(b.app, alice).post("/api/template-library/templates/tpl.design.quote-card/use", {})).json().result;
    const c = (await api(b.app, alice).post("/api/template-library/templates/tpl.design.quote-card/use", {})).json().result;
    expect(a.id).not.toBe(c.id);
    const p = (await api(b.app, alice).get(`/api/projects/${a.id}`)).json().project;
    expect(p.name).toBe("Quote card");
  });

  it("creates a website through the Website Builder's own path, with a template revision and a legacy template id", async () => {
    const res = await api(b.app, alice).post("/api/template-library/templates/tpl.site.portfolio/use", { name: "Ada Studio" });
    expect(res.statusCode).toBe(200);
    const result = res.json().result;
    expect(result).toMatchObject({ kind: "website", path: expect.stringMatching(/^\/sites\/site_.+\/edit$/) });
    const [row] = await b.db.select().from(sites).where(eq(sites.id, result.id));
    expect(row).toMatchObject({ ownerId: alice.user.id, templateId: "portfolio", name: "Ada Studio", revision: 0 });
    const revisions = await b.db.select().from(siteRevisions).where(eq(siteRevisions.siteId, result.id));
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ kind: "template", revision: 0 });
    expect((await api(b.app, bob).get(`/api/sites/${result.id}`)).statusCode).toBe(404);
    // The legacy id works as an alias for the same canonical template.
    expect((await api(b.app, alice).post("/api/template-library/templates/portfolio/use", {})).statusCode).toBe(200);
  });

  it("records provenance (template id and version) in the audit log", async () => {
    const rows = await b.db.select().from(auditLog).where(eq(auditLog.action, "template.used"));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const design = rows.find((r) => (r.details as { kind?: string }).kind === "design");
    expect(design?.details).toMatchObject({ templateId: "tpl.design.quote-card", version: 1, kind: "design", projectId: expect.stringMatching(/^prj_/) });
    expect(design?.actorId).toBe(alice.user.id);
    const created = await b.db.select().from(auditLog).where(eq(auditLog.action, "site.created"));
    expect(created.some((r) => (r.details as { source?: { canonicalId?: string } }).source?.canonicalId === "tpl.site.portfolio")).toBe(true);
  });

  it("refuses unknown, unavailable and unpublished templates", async () => {
    for (const id of ["tpl.nope", "tpl.design.pitch-deck", "tpl.design.icon-badge", "tpl.design.draft-one"]) {
      expect((await api(b.app, alice).post(`/api/template-library/templates/${id}/use`, {})).statusCode, id).toBe(404);
    }
    expect((await api(b.app, alice).post("/api/template-library/templates/tpl.design.quote-card/use", { name: "x".repeat(81) })).statusCode).toBe(400);
  });

  it("never lets a client supply template content", async () => {
    const res = await api(b.app, alice).post("/api/template-library/templates/tpl.design.quote-card/use", { name: "ok", document: { evil: true } });
    expect(res.statusCode).toBe(200);
    const project = (await api(b.app, alice).get(`/api/projects/${res.json().result.id}`)).json().project;
    expect(project.document.layers).toHaveLength(2);
    const rows = await b.db.select().from(projects).where(eq(projects.id, project.id));
    expect(JSON.stringify(rows[0]!.document)).not.toContain("evil");
  });
});

describe("template library service: failing closed", () => {
  it("reports every invalid record and serves none of them", () => {
    const log: string[] = [];
    const svc = new TemplateLibraryService({ db: b.db, projects: b.services.projects, sites: b.services.sites, catalog: [...catalog, { id: "tpl.design.junk", not: "a manifest" }], designs: { "quote-card": quoteDoc() }, log: (m) => log.push(m) });
    expect(svc.list({}, undefined).total).toBe(3);
    expect(log.some((l) => l.includes("tpl.design.junk"))).toBe(true);
    expect(log.some((l) => l.includes("tpl.design.pitch-deck"))).toBe(true);
  });

  it("rejects a design template whose content is not a valid Design Studio document", () => {
    const svc = new TemplateLibraryService({ db: b.db, projects: b.services.projects, sites: b.services.sites, catalog: [catalog[0]], designs: { "quote-card": { schemaVersion: 1, width: 10, height: 10, layers: [] } } });
    expect(() => svc.designDocument("tpl.design.quote-card")).toThrow();
  });
});
