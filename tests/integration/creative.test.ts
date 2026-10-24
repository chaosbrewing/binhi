import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, createSite, signup, testApp, TINY_PNG, type Session } from "../helpers.js";
import { createDesignDocument, createBrandKitDocument, makeLayer, type DesignDocument } from "../../src/core/creative/index.js";
import { initialRecipe } from "../../src/core/media/photo.js";

let b: BinhiApp;
let s: Session;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
});
afterAll(async () => b.close());

const uploadLibrary = (session: Session, body: Buffer, type = "image/png", name = "photo.png", extra: Record<string, string> = {}) =>
  api(b.app, session).post("/api/library", body, { headers: { "content-type": type, "x-binhi-filename": name, ...extra } });

describe("private asset library", () => {
  it("stores a validated raster privately, serves it only to its owner and reports usage", async () => {
    const up = await uploadLibrary(s, TINY_PNG, "image/png", "../weird name.png", { "x-binhi-alt": "Tiny", "x-binhi-tags": "test,square" });
    expect(up.statusCode).toBe(200);
    const asset = up.json().asset;
    expect(asset).toMatchObject({ mimeType: "image/png", width: 2, height: 2, filename: "weird-name.png", alt: "Tiny", tags: "test,square", usedBy: [] });
    expect(asset.url).toBe(`/api/library/${asset.id}/file`);
    const file = await api(b.app, s).get(asset.url);
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
    expect(file.headers["cache-control"]).toContain("private");
    expect(file.rawPayload.equals(TINY_PNG)).toBe(true);
    const cached = await api(b.app, s).get(asset.url, { headers: { "if-none-match": file.headers.etag as string } });
    expect(cached.statusCode).toBe(304);
    // Not public, not reachable by another account, not served via /media
    expect((await b.app.inject({ method: "GET", url: asset.url })).statusCode).toBe(401);
    const other = await signup(b.app);
    expect((await api(b.app, other).get(asset.url)).statusCode).toBe(404);
    expect((await api(b.app, other).get(`/api/library/${asset.id}`)).statusCode).toBe(404);
    expect((await api(b.app, other).del(`/api/library/${asset.id}`)).statusCode).toBe(404);
    expect((await b.app.inject({ method: "GET", url: `/media/${asset.id}` })).statusCode).toBe(404);
  });

  it("rejects SVG, GIF, mislabelled, animated and oversized files before storing anything", async () => {
    expect((await uploadLibrary(s, Buffer.from("<svg onload=alert(1)></svg>"), "image/png", "x.svg")).statusCode).toBe(400);
    expect((await uploadLibrary(s, Buffer.from("GIF89a1234567890123456789"), "image/png", "x.gif")).statusCode).toBe(400);
    expect((await uploadLibrary(s, Buffer.from("not an image at all, really"), "image/jpeg", "x.jpg")).statusCode).toBe(400);
    // animated PNG: IHDR followed by an acTL chunk
    const apng = Buffer.alloc(65);
    apng.set([137, 80, 78, 71, 13, 10, 26, 10]);
    apng.writeUInt32BE(13, 8); apng.write("IHDR", 12); apng.writeUInt32BE(640, 16); apng.writeUInt32BE(480, 20);
    apng.writeUInt32BE(8, 33); apng.write("acTL", 37); apng.write("IEND", 57);
    const animated = await uploadLibrary(s, apng, "image/png", "anim.png");
    expect(animated.statusCode).toBe(400);
    expect(animated.json().error.message).toContain("Animated");
    // header claims 20000 x 20000: refused without decoding
    const bomb = Buffer.from(TINY_PNG);
    bomb.writeUInt32BE(20000, 16); bomb.writeUInt32BE(20000, 20);
    expect((await uploadLibrary(s, bomb, "image/png", "bomb.png")).statusCode).toBe(400);
    expect((await uploadLibrary(s, Buffer.alloc(9 * 1024 * 1024, 1))).statusCode).toBe(413);
    const list = (await api(b.app, s).get("/api/library")).json().assets;
    expect(list.filter((a: { filename: string }) => /x\.|anim|bomb/.test(a.filename))).toHaveLength(0);
  });

  it("copies a private file into a website's public media only on request", async () => {
    const site = await createSite(b.app, s);
    const asset = (await uploadLibrary(s, TINY_PNG)).json().asset;
    const other = await signup(b.app);
    const theirSite = await createSite(b.app, other);
    expect((await api(b.app, s).post(`/api/library/${asset.id}/copy-to-site`, { siteId: theirSite.id })).statusCode).toBe(404);
    const copied = await api(b.app, s).post(`/api/library/${asset.id}/copy-to-site`, { siteId: site.id });
    expect(copied.statusCode).toBe(200);
    const siteAsset = copied.json().asset;
    expect(siteAsset.url).toMatch(/^\/media\/ast_/);
    expect((await b.app.inject({ method: "GET", url: siteAsset.url })).statusCode).toBe(200);
  });
});

describe("creative projects", () => {
  it("creates, lists, updates with optimistic concurrency and deletes a design project", async () => {
    const doc = createDesignDocument(1080, 1080);
    const created = await api(b.app, s).post("/api/projects", { kind: "design", name: "Launch post", document: doc });
    expect(created.statusCode).toBe(200);
    const project = created.json().project;
    expect(project).toMatchObject({ kind: "design", revision: 0, meta: { width: 1080, height: 1080, layers: 0 } });
    const listed = (await api(b.app, s).get("/api/projects?kind=design")).json().projects;
    expect(listed.map((p: { id: string }) => p.id)).toContain(project.id);
    const next: DesignDocument = { ...doc, layers: [makeLayer("text", doc, { text: "Hello" })] };
    const saved = await api(b.app, s).patch(`/api/projects/${project.id}`, { document: next, baseRevision: 0 });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().project.revision).toBe(1);
    expect(saved.json().project.meta.layers).toBe(1);
    const stale = await api(b.app, s).patch(`/api/projects/${project.id}`, { name: "Stale", baseRevision: 0 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.details.serverRevision).toBe(1);
    const invalid = await api(b.app, s).patch(`/api/projects/${project.id}`, { document: { ...next, width: 99999 }, baseRevision: 1 });
    expect(invalid.statusCode).toBe(400);
    const stranger = await signup(b.app);
    expect((await api(b.app, stranger).get(`/api/projects/${project.id}`)).statusCode).toBe(404);
    expect((await api(b.app, stranger).patch(`/api/projects/${project.id}`, { name: "Mine", baseRevision: 1 })).statusCode).toBe(404);
    expect((await api(b.app, s).del(`/api/projects/${project.id}`)).statusCode).toBe(200);
    expect((await api(b.app, s).get(`/api/projects/${project.id}`)).statusCode).toBe(404);
  });

  it("rejects documents that do not match the project kind and foreign asset references", async () => {
    const wrongKind = await api(b.app, s).post("/api/projects", { kind: "photo", name: "Nope", document: createDesignDocument(800, 600) });
    expect(wrongKind.statusCode).toBe(400);
    const other = await signup(b.app);
    const theirs = (await uploadLibrary(other, TINY_PNG)).json().asset;
    const doc = createDesignDocument(800, 600);
    const withForeign = { ...doc, layers: [makeLayer("image", doc, { assetId: theirs.id })] };
    const res = await api(b.app, s).post("/api/projects", { kind: "design", name: "Borrowed", document: withForeign });
    expect(res.statusCode).toBe(400);
  });

  it("tracks asset usage, protects used files from deletion and clears usage when the project goes", async () => {
    const asset = (await uploadLibrary(s, TINY_PNG)).json().asset;
    const doc = createDesignDocument(800, 600);
    const withImage = { ...doc, layers: [makeLayer("image", doc, { assetId: asset.id })] };
    const project = (await api(b.app, s).post("/api/projects", { kind: "design", name: "Uses image", document: withImage })).json().project;
    const info = (await api(b.app, s).get(`/api/library/${asset.id}`)).json().asset;
    expect(info.usedBy).toEqual([{ id: project.id, name: "Uses image", kind: "design" }]);
    const blocked = await api(b.app, s).del(`/api/library/${asset.id}`);
    expect(blocked.statusCode).toBe(409);
    expect((await api(b.app, s).get(asset.url)).statusCode).toBe(200);
    await api(b.app, s).patch(`/api/projects/${project.id}`, { document: doc, baseRevision: 0 });
    expect((await api(b.app, s).get(`/api/library/${asset.id}`)).json().asset.usedBy).toEqual([]);
    expect((await api(b.app, s).del(`/api/library/${asset.id}`)).statusCode).toBe(200);
    expect((await api(b.app, s).get(asset.url)).statusCode).toBe(404);
    const forced = (await uploadLibrary(s, TINY_PNG)).json().asset;
    await api(b.app, s).post("/api/projects", { kind: "design", name: "Still uses", document: { ...doc, layers: [makeLayer("image", doc, { assetId: forced.id })] } });
    expect((await api(b.app, s).del(`/api/library/${forced.id}?force=true`)).statusCode).toBe(200);
  });

  it("saves a photo project against a private original and reopens it", async () => {
    const original = (await uploadLibrary(s, TINY_PNG, "image/png", "original.png", { "x-binhi-origin": "photo-original" })).json().asset;
    expect(original.origin).toBe("photo-original");
    const info = { mimeType: "image/png" as const, width: 2, height: 2 };
    const document = { schemaVersion: 1, sourceAssetId: original.id, source: info, recipe: { ...initialRecipe(info), flipX: true } };
    const created = await api(b.app, s).post("/api/projects", { kind: "photo", name: "Holiday", document });
    expect(created.statusCode).toBe(200);
    const reopened = (await api(b.app, s).get(`/api/projects/${created.json().project.id}`)).json().project;
    expect(reopened.document.recipe.flipX).toBe(true);
    expect(reopened.meta.sourceAssetId).toBe(original.id);
    const badCrop = { ...document, recipe: { ...document.recipe, crop: { x: 0, y: 0, width: 50, height: 50 } } };
    expect((await api(b.app, s).post("/api/projects", { kind: "photo", name: "Bad", document: badCrop })).statusCode).toBe(400);
  });

  it("turns a design into a reusable template and back into a fresh design", async () => {
    const doc = createDesignDocument(1200, 630);
    const design = (await api(b.app, s).post("/api/projects", { kind: "design", name: "OG card", document: { ...doc, layers: [makeLayer("rect", doc)] } })).json().project;
    const template = (await api(b.app, s).post(`/api/projects/${design.id}/duplicate`, { kind: "design-template", name: "OG template" })).json().project;
    expect(template).toMatchObject({ kind: "design-template", name: "OG template", revision: 0, meta: { layers: 1 } });
    const fresh = (await api(b.app, s).post(`/api/projects/${template.id}/duplicate`, { kind: "design", name: "From template" })).json().project;
    expect(fresh.kind).toBe("design");
    expect(fresh.document.layers[0].type).toBe("rect");
    expect(fresh.document.layers[0].id).toBe(template.document.layers[0].id);
    expect((await api(b.app, s).get("/api/projects?kind=design-template")).json().projects.map((p: { id: string }) => p.id)).toEqual([template.id]);
    const photoDoc = { schemaVersion: 1, sourceAssetId: (await uploadLibrary(s, TINY_PNG)).json().asset.id, source: { mimeType: "image/png", width: 2, height: 2 }, recipe: initialRecipe({ mimeType: "image/png", width: 2, height: 2 }) };
    const photo = (await api(b.app, s).post("/api/projects", { kind: "photo", name: "P", document: photoDoc })).json().project;
    expect((await api(b.app, s).post(`/api/projects/${photo.id}/duplicate`, { kind: "design-template" })).statusCode).toBe(400);
  });
});

describe("brand kits", () => {
  it("creates, updates, applies ownership checks on the logo and deletes kits", async () => {
    const kitDoc = createBrandKitDocument();
    const created = await api(b.app, s).post("/api/brand-kits", { name: "Chaos Origins", document: kitDoc });
    expect(created.statusCode).toBe(200);
    const kit = created.json().kit;
    expect(kit.document.colors).toHaveLength(4);
    const logo = (await uploadLibrary(s, TINY_PNG, "image/png", "logo.png")).json().asset;
    const updated = await api(b.app, s).patch(`/api/brand-kits/${kit.id}`, { document: { ...kitDoc, logoAssetId: logo.id, tagline: "Complexity, Simplified." } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().kit.document.logoAssetId).toBe(logo.id);
    const other = await signup(b.app);
    const theirLogo = (await uploadLibrary(other, TINY_PNG)).json().asset;
    expect((await api(b.app, s).patch(`/api/brand-kits/${kit.id}`, { document: { ...kitDoc, logoAssetId: theirLogo.id } })).statusCode).toBe(404);
    expect((await api(b.app, other).get(`/api/brand-kits/${kit.id}`)).statusCode).toBe(404);
    expect((await api(b.app, s).post("/api/brand-kits", { name: "Bad", document: { ...kitDoc, colors: [{ name: "x", value: "javascript:alert(1)" }] } })).statusCode).toBe(400);
    expect((await api(b.app, s).del(`/api/brand-kits/${kit.id}`)).statusCode).toBe(200);
    expect((await api(b.app, s).get("/api/brand-kits")).json().kits.map((k: { id: string }) => k.id)).not.toContain(kit.id);
  });

  it("account deletion removes projects, kits and private files", async () => {
    const victim = await signup(b.app, "studio-del@example.com", "delete-me-studio-now");
    const asset = (await uploadLibrary(victim, TINY_PNG)).json().asset;
    const doc = createDesignDocument(640, 640);
    await api(b.app, victim).post("/api/projects", { kind: "design", name: "Gone", document: { ...doc, layers: [makeLayer("image", doc, { assetId: asset.id })] } });
    await api(b.app, victim).post("/api/brand-kits", { name: "Gone kit", document: createBrandKitDocument() });
    expect((await api(b.app, victim).del("/api/auth/account", { password: "delete-me-studio-now" })).statusCode).toBe(200);
    const rows = await b.sql`select (select count(*)::int from binhi_projects where deleted_at is null and owner_id = (select id from binhi_users where email like 'deleted-%' order by created_at desc limit 1)) as projects, (select count(*)::int from binhi_library_assets where deleted_at is null and filename = 'photo.png' and owner_id not in (select owner_id from binhi_projects)) as stray`;
    expect(rows[0]!.projects).toBe(0);
  });
});
