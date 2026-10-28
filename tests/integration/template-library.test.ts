import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import type { BinhiApp } from "../../src/server/app.js";
import { api, signup, testApp, TINY_PNG, type Session } from "../helpers.js";
import { Design } from "../../src/core/templates/library/catalog/designs/dsl.js";
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

/** A fixture design with brand bindings and a logo slot (not shipped content). */
function brandedContent() {
  const d = new Design(1080, 1080, "#ffffff", "branded", "paper");
  d.rect(0, 0, 1080, 540, "#1f4e79", { name: "Band", bind: { fill: "primary" } });
  d.text("Headline", 60, 100, 700, 120, { size: 90, color: "#ffffff", name: "Headline", bind: { color: "paper", font: "heading" } });
  d.text("Untouched note", 60, 700, 700, 60, { size: 40, color: "#333333", name: "Untouched note" });
  d.logoSlot(800, 40, 200, 100);
  return d.toContent();
}

const catalog = [
  designTemplate({ id: "tpl.design.branded", name: "Branded fixture", description: "A fixture with brand bindings and a logo slot.", content: { type: "builtin-design", key: "branded" }, keywords: ["branded"], tags: [], dependencies: { fonts: ["DM Sans"], icons: [], elements: [], bundledAssets: [], brandTokens: ["brand.primary", "brand.paper", "brand.heading-font", "brand.logo"], components: [] } }),
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
  b = await testApp({}, { templates: { catalog, designs: { "quote-card": { document: quoteDoc(), brand: { colors: [], fonts: [] } }, branded: brandedContent() }, collections: [{ id: "starter", title: "Starter", description: "x", templateIds: ["tpl.design.quote-card", "tpl.missing"] }] } });
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
    expect(total).toBe(4);
    expect(items.map((t: { id: string }) => t.id).sort()).toEqual(["tpl.design.branded", "tpl.design.quote-card", "tpl.design.story-sale", "tpl.site.portfolio"]);
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
    expect((await get("format=social")).total).toBe(3);
    expect((await get("format=forms")).total).toBe(0);
    expect((await get("style=playful")).items[0].id).toBe("tpl.design.story-sale");
    expect((await get("orientation=portrait")).total).toBe(1);
    const page1 = await get("pageSize=2&page=1");
    const page2 = await get("pageSize=2&page=2");
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.total).toBe(4);
    expect((await get("editor=website")).total).toBe(1);
    expect((await get("editor=design")).total).toBe(3);
    expect((await get("color=neutral")).total).toBe(4); // fixture palettes are black and cream
    expect((await get("color=blue")).total).toBe(0);
    expect((await api(b.app, alice).get("/api/template-library/templates?color=nope")).statusCode).toBe(400);
    expect((await api(b.app, alice).get("/api/template-library/templates?editor=nope")).statusCode).toBe(400);
    expect((await api(b.app, alice).get("/api/template-library/templates?format=nope")).statusCode).toBe(400);
    expect((await api(b.app, alice).get("/api/template-library/templates?pageSize=500")).statusCode).toBe(400);
  });

  it("describes the taxonomy honestly: 30 categories, unavailable editors explained", async () => {
    const t = (await api(b.app, alice).get("/api/template-library/taxonomy")).json();
    expect(t.categories).toHaveLength(30);
    expect(t.total).toBe(4);
    const fmt = Object.fromEntries(t.formats.map((f: { id: string }) => [f.id, f]));
    expect(fmt.social.available).toBe(true);
    expect(fmt.websites.available).toBe(true);
    for (const id of ["presentations", "forms", "video", "documents"]) {
      expect(fmt[id].available).toBe(false);
      expect(fmt[id].note).toBeTruthy();
    }
    // Secondary categories are discoverable without a second record.
    expect(t.categories.find((c: { id: string }) => c.id === "social-media").count).toBe(3);
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

describe("template library API: brand kits", () => {
  const kitDoc = (logoAssetId: string | null = null) => ({ schemaVersion: 1, colors: [{ name: "Primary", value: "#7c3aed" }, { name: "Accent", value: "#f97316" }, { name: "Ink", value: "#111827" }, { name: "Paper", value: "#fafaf9" }], fonts: { heading: "Lora", body: "Lora" }, logoAssetId, tagline: "" });
  let kitId = "";
  let logoKitId = "";
  let logoAssetId = "";
  beforeAll(async () => {
    kitId = (await api(b.app, alice).post("/api/brand-kits", { name: "Violet", document: kitDoc() })).json().kit.id;
    const up = await api(b.app, alice).post("/api/library", TINY_PNG, { headers: { "content-type": "image/png", "x-binhi-filename": "logo.png" } });
    logoAssetId = up.json().asset.id;
    logoKitId = (await api(b.app, alice).post("/api/brand-kits", { name: "Violet with logo", document: kitDoc(logoAssetId) })).json().kit.id;
  });

  it("applies the kit to a design on creation, only to bound layers, and leaves the template untouched", async () => {
    const before = (await api(b.app, alice).get("/api/template-library/templates/tpl.design.branded/document")).json();
    expect(before.brand.colors.length).toBe(2);
    const res = await api(b.app, alice).post("/api/template-library/templates/tpl.design.branded/use", { name: "Branded", brandKitId: kitId });
    expect(res.statusCode).toBe(200);
    const { result } = res.json();
    expect(result.brand).toMatchObject({ kitName: "Violet", logoPlaced: false });
    expect(result.brand.changes).toBeGreaterThanOrEqual(4);
    const project = (await api(b.app, alice).get(`/api/projects/${result.id}`)).json().project;
    expect(project.revision).toBe(0);
    const layer = (n: string) => project.document.layers.find((l: { name: string }) => l.name === n);
    expect(project.document.background).toBe("#fafaf9");
    expect(layer("Band").fill).toBe("#7c3aed");
    expect(layer("Headline")).toMatchObject({ color: "#fafaf9", font: "Lora" });
    expect(layer("Untouched note")).toMatchObject({ color: "#333333", font: "DM Sans" });
    const after = (await api(b.app, alice).get("/api/template-library/templates/tpl.design.branded/document")).json();
    expect(after).toEqual(before);
  });

  it("places the owner's logo only in the reserved slot and tracks the asset as used", async () => {
    const { result } = (await api(b.app, alice).post("/api/template-library/templates/tpl.design.branded/use", { brandKitId: logoKitId })).json();
    expect(result.brand.logoPlaced).toBe(true);
    const project = (await api(b.app, alice).get(`/api/projects/${result.id}`)).json().project;
    expect(project.document.layers.at(-1)).toMatchObject({ type: "image", assetId: logoAssetId, x: 800, y: 40, width: 200, height: 100 });
    const asset = (await api(b.app, alice).get(`/api/library/${logoAssetId}`)).json().asset;
    expect(asset.usedBy.some((u: { id: string }) => u.id === result.id)).toBe(true);
  });

  it("never lets one account use another account's kit or logo", async () => {
    const before = (await api(b.app, bob).get("/api/projects")).json().projects.length;
    for (const id of [kitId, logoKitId]) {
      expect((await api(b.app, bob).post("/api/template-library/templates/tpl.design.branded/use", { brandKitId: id })).statusCode).toBe(404);
      expect((await api(b.app, bob).post("/api/template-library/templates/tpl.site.portfolio/use", { brandKitId: id })).statusCode).toBe(404);
      expect((await api(b.app, bob).get(`/api/template-library/templates/tpl.site.portfolio/preview/?kit=${id}`)).statusCode).toBe(404);
    }
    expect((await api(b.app, bob).get("/api/projects")).json().projects.length).toBe(before);
    expect((await api(b.app, bob).get("/api/sites")).json().sites.length).toBe(0);
  });

  it("applies a kit to a website as revision 1, so revision 0 (the template) can be restored", async () => {
    const { result } = (await api(b.app, alice).post("/api/template-library/templates/tpl.site.portfolio/use", { name: "Kit site", brandKitId: kitId })).json();
    expect(result.brand.kitName).toBe("Violet");
    const site = (await api(b.app, alice).get(`/api/sites/${result.id}`)).json().site;
    expect(site.revision).toBe(1);
    expect(site.document.theme.colors.primary).toBe("#7c3aed");
    expect(site.document.theme.fonts.heading).toBe("Lora");
    const original = (await api(b.app, alice).get(`/api/sites/${result.id}/revisions/0`)).json().document;
    expect(original.theme.colors.primary).toBe("#c2410c"); // the template's own colour
    const restored = await api(b.app, alice).post(`/api/sites/${result.id}/revisions/0/restore`, { baseRevision: 1 });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().document.theme.colors.primary).toBe("#c2410c");
    // A restore is itself a new revision; nothing was destroyed.
    expect((await api(b.app, alice).get(`/api/sites/${result.id}`)).json().site.revision).toBe(2);
    const revisions = (await api(b.app, alice).get(`/api/sites/${result.id}/revisions`)).json().revisions;
    expect(revisions.length).toBe(3);
  });

  it("previews a website with a kit in memory only and saves nothing", async () => {
    const sitesBefore = (await api(b.app, alice).get("/api/sites")).json().sites.length;
    const plain = (await api(b.app, alice).get("/api/template-library/templates/tpl.site.portfolio/preview/")).body;
    const withKit = await api(b.app, alice).get(`/api/template-library/templates/tpl.site.portfolio/preview/?kit=${kitId}`);
    expect(withKit.statusCode).toBe(200);
    expect(withKit.body).toContain("#7c3aed");
    expect(plain).not.toContain("#7c3aed");
    expect(String(withKit.headers["content-security-policy"])).toMatch(/;\s*sandbox$/);
    expect((await api(b.app, alice).get("/api/sites")).json().sites.length).toBe(sitesBefore);
  });

  it("the audit log records which kit was applied", async () => {
    const rows = await b.db.select().from(auditLog).where(eq(auditLog.action, "template.used"));
    expect(rows.some((r) => (r.details as { brandKitId?: string }).brandKitId === kitId)).toBe(true);
  });
});

describe("template library API: personal templates", () => {
  let templateId = "";
  beforeAll(async () => {
    templateId = (await api(b.app, alice).post("/api/projects", { kind: "design-template", name: "My layout", document: quoteDoc() })).json().project.id;
  });

  it("creates an independent project from the owner's own template and records the use", async () => {
    const res = await api(b.app, alice).post(`/api/template-library/mine/${templateId}/use`, { name: "From my template" });
    expect(res.statusCode).toBe(200);
    const { result } = res.json();
    expect(result).toMatchObject({ kind: "design", path: expect.stringMatching(/^\/studio\/design\/prj_/) });
    const project = (await api(b.app, alice).get(`/api/projects/${result.id}`)).json().project;
    expect(project).toMatchObject({ kind: "design", name: "From my template", revision: 0 });
    // Editing the project leaves the template as it was.
    const template = (await api(b.app, alice).get(`/api/projects/${templateId}`)).json().project;
    const edited = structuredClone(project.document);
    edited.layers[1].text = "Changed";
    expect((await api(b.app, alice).patch(`/api/projects/${result.id}`, { document: edited, baseRevision: 0 })).statusCode).toBe(200);
    const templateAfter = (await api(b.app, alice).get(`/api/projects/${templateId}`)).json().project;
    expect(templateAfter.document).toEqual(template.document);
    expect(templateAfter.revision).toBe(template.revision);
    const audit = (await b.db.select().from(auditLog).where(eq(auditLog.action, "template.used"))).filter((r) => (r.details as { personal?: boolean }).personal);
    expect(audit.some((r) => (r.details as { templateId?: string }).templateId === `personal:${templateId}` && r.actorId === alice.user.id)).toBe(true);
  });

  it("isolates templates between accounts for use, rename, duplicate and delete", async () => {
    expect((await api(b.app, bob).post(`/api/template-library/mine/${templateId}/use`, {})).statusCode).toBe(404);
    expect((await api(b.app, bob).get(`/api/projects/${templateId}`)).statusCode).toBe(404);
    expect((await api(b.app, bob).patch(`/api/projects/${templateId}`, { name: "Mine now", baseRevision: 0 })).statusCode).toBe(404);
    expect((await api(b.app, bob).post(`/api/projects/${templateId}/duplicate`, { kind: "design-template" })).statusCode).toBe(404);
    expect((await api(b.app, bob).del(`/api/projects/${templateId}`)).statusCode).toBe(404);
    expect((await api(b.app, bob).get("/api/projects?kind=design-template")).json().projects).toEqual([]);
  });

  it("only treats design templates as templates", async () => {
    const plain = (await api(b.app, alice).post("/api/projects", { kind: "design", name: "Plain design", document: quoteDoc() })).json().project.id;
    expect((await api(b.app, alice).post(`/api/template-library/mine/${plain}/use`, {})).statusCode).toBe(404);
  });

  it("supports rename, duplicate and delete, and a deleted template can no longer be used", async () => {
    const t = (await api(b.app, alice).get(`/api/projects/${templateId}`)).json().project;
    const renamed = await api(b.app, alice).patch(`/api/projects/${templateId}`, { name: "Renamed layout", baseRevision: t.revision });
    expect(renamed.json().project.name).toBe("Renamed layout");
    const copy = (await api(b.app, alice).post(`/api/projects/${templateId}/duplicate`, { kind: "design-template", name: "Layout copy" })).json().project;
    expect(copy).toMatchObject({ kind: "design-template", name: "Layout copy" });
    expect(copy.id).not.toBe(templateId);
    expect((await api(b.app, alice).del(`/api/projects/${copy.id}`)).statusCode).toBe(200);
    expect((await api(b.app, alice).post(`/api/template-library/mine/${copy.id}/use`, {})).statusCode).toBe(404);
    expect((await api(b.app, alice).post(`/api/template-library/mine/${templateId}/use`, {})).statusCode).toBe(200);
  });

  it("requires sign-in", async () => {
    expect((await api(b.app, null).post(`/api/template-library/mine/${templateId}/use`, {})).statusCode).toBe(401);
  });
});

describe("template library service: failing closed", () => {
  it("reports every invalid record and serves none of them", () => {
    const log: string[] = [];
    const svc = new TemplateLibraryService({ db: b.db, projects: b.services.projects, sites: b.services.sites, brandKits: b.services.brandKits, catalog: [...catalog, { id: "tpl.design.junk", not: "a manifest" }], designs: { "quote-card": { document: quoteDoc(), brand: { colors: [], fonts: [] } } }, log: (m) => log.push(m) });
    expect(svc.list({}, undefined).total).toBe(4);
    expect(log.some((l) => l.includes("tpl.design.junk"))).toBe(true);
    expect(log.some((l) => l.includes("tpl.design.pitch-deck"))).toBe(true);
  });

  it("rejects a design template whose content is not a valid Design Studio document", () => {
    const svc = new TemplateLibraryService({ db: b.db, projects: b.services.projects, sites: b.services.sites, brandKits: b.services.brandKits, catalog: [catalog[0]], designs: { "quote-card": { document: { schemaVersion: 1, width: 10, height: 10, layers: [] }, brand: { colors: [], fonts: [] } } } });
    expect(() => svc.designDocument("tpl.design.quote-card")).toThrow();
  });
});
