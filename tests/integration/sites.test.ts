import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, batch, createSite, signup, testApp, type Session } from "../helpers.js";

let b: BinhiApp;
let s: Session;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
});
afterAll(async () => b.close());

describe("sites and the editing contract", () => {
  it("lists templates and creates a site from one", async () => {
    const t = await api(b.app, s).get("/api/templates");
    expect(t.json().templates.length).toBeGreaterThanOrEqual(5);
    const site = await createSite(b.app, s, "portfolio", "Ana Reyes Photography");
    expect(site.slug).toBe("ana-reyes-photography");
    expect(site.revision).toBe(0);
    expect(site.document.pages.length).toBe(4);
    const list = await api(b.app, s).get("/api/sites");
    expect(list.json().sites.map((x: { id: string }) => x.id)).toContain(site.id);
  });

  it("applies validated batches, bumps the revision and records history", async () => {
    const site = await createSite(b.app, s);
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const r1 = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "button", props: { label: "Hello" } }]));
    expect(r1.statusCode).toBe(200);
    expect(r1.json().revision).toBe(1);
    const buttonId = r1.json().createdIds[0];
    const r2 = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "updateProps", nodeId: buttonId, props: { label: "Changed" } }]));
    expect(r2.json().revision).toBe(2);
    const got = await api(b.app, s).get(`/api/sites/${site.id}`);
    const doc = got.json().site.document;
    expect(JSON.stringify(doc)).toContain('"label":"Changed"');
    const revs = await api(b.app, s).get(`/api/sites/${site.id}/revisions`);
    expect(revs.json().revisions.map((r: { revision: number }) => r.revision)).toEqual([2, 1, 0]);
    expect(revs.json().revisions[0].summary).toEqual(["updateProps"]);
  });

  it("rejects stale revisions with the server document, acknowledges replayed batches, and refuses invalid ops", async () => {
    const site = await createSite(b.app, s);
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const first = batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "divider" }], "same-batch");
    expect((await api(b.app, s).post(`/api/sites/${site.id}/ops`, first)).statusCode).toBe(200);
    const replay = await api(b.app, s).post(`/api/sites/${site.id}/ops`, first);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().replayed).toBe(true);
    expect(replay.json().revision).toBe(1);
    const stale = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "divider" }]));
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.details.serverRevision).toBe(1);
    expect(stale.json().error.details.document.pages).toBeTruthy();
    const invalid = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "deleteNode", nodeId: "node_missing12" }]));
    expect(invalid.statusCode).toBe(422);
    const malformed = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "explode" }]));
    expect(malformed.statusCode).toBe(400);
    // Nothing from the failed batches leaked into the document
    const got = await api(b.app, s).get(`/api/sites/${site.id}`);
    expect(got.json().site.revision).toBe(1);
  });

  it("a batch is all-or-nothing", async () => {
    const site = await createSite(b.app, s);
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const res = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [
      { type: "insertComponent", target: { parentId: sectionId }, componentType: "divider" },
      { type: "deleteNode", nodeId: "node_missing12" },
    ]));
    expect(res.statusCode).toBe(422);
    const got = await api(b.app, s).get(`/api/sites/${site.id}`);
    expect(got.json().site.revision).toBe(0);
    expect(got.json().site.document.pages[0].sections[0].children.length).toBe(site.document.pages[0]!.sections[0]!.children!.length);
  });

  it("restores an earlier revision as a new revision", async () => {
    const site = await createSite(b.app, s);
    const headingId = site.document.pages[0]!.sections[0]!.children![0]!.id;
    await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "updateProps", nodeId: headingId, props: { text: "Version two" } }]));
    await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "updateProps", nodeId: headingId, props: { text: "Version three" } }]));
    const old = await api(b.app, s).get(`/api/sites/${site.id}/revisions/1`);
    expect(JSON.stringify(old.json().document)).toContain("Version two");
    const restored = await api(b.app, s).post(`/api/sites/${site.id}/revisions/1/restore`, { baseRevision: 2 });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().revision).toBe(3);
    expect(JSON.stringify(restored.json().document)).toContain("Version two");
    const revs = await api(b.app, s).get(`/api/sites/${site.id}/revisions`);
    expect(revs.json().revisions[0]).toMatchObject({ revision: 3, kind: "restore", label: "Restored revision 1" });
  });

  it("serves an authenticated preview using the shared renderer", async () => {
    const site = await createSite(b.app, s, "portfolio", "Preview Me");
    const home = await api(b.app, s).get(`/api/sites/${site.id}/preview/`);
    expect(home.statusCode).toBe(200);
    expect(home.headers["content-type"]).toContain("text/html");
    expect(home.body).toContain(`href="/api/sites/${site.id}/preview/work/"`);
    expect(home.headers["content-security-policy"]).toContain("script-src 'none'");
    const work = await api(b.app, s).get(`/api/sites/${site.id}/preview/work/`);
    expect(work.statusCode).toBe(200);
    expect((await api(b.app, s).get(`/api/sites/${site.id}/preview/nope/`)).statusCode).toBe(404);
    const stranger = await signup(b.app);
    expect((await api(b.app, stranger).get(`/api/sites/${site.id}/preview/`)).statusCode).toBe(404);
  });

  it("enforces ownership on every site operation (404, never 403)", async () => {
    const site = await createSite(b.app, s);
    const other = await signup(b.app);
    const o = api(b.app, other);
    expect((await o.get(`/api/sites/${site.id}`)).statusCode).toBe(404);
    expect((await o.post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "renameSite", name: "Hijacked" }]))).statusCode).toBe(404);
    expect((await o.patch(`/api/sites/${site.id}`, { name: "Hijacked" })).statusCode).toBe(404);
    expect((await o.get(`/api/sites/${site.id}/revisions`)).statusCode).toBe(404);
    expect((await o.del(`/api/sites/${site.id}`)).statusCode).toBe(404);
    const mine = await api(b.app, s).get(`/api/sites/${site.id}`);
    expect(mine.json().site.name).toBe("Test Site");
  });

  it("renames and re-addresses a site with validation", async () => {
    const site = await createSite(b.app, s, "blank", "Addressable");
    const bad = await api(b.app, s).patch(`/api/sites/${site.id}`, { slug: "api" });
    expect(bad.statusCode).toBe(400);
    const ok = await api(b.app, s).patch(`/api/sites/${site.id}`, { slug: "my-new-home", name: "Renamed" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().site).toMatchObject({ slug: "my-new-home", name: "Renamed" });
    const other = await createSite(b.app, s, "blank", "Other");
    const taken = await api(b.app, s).patch(`/api/sites/${other.id}`, { slug: "my-new-home" });
    expect(taken.statusCode).toBe(409);
  });

  it("deletes a site so it disappears from the list", async () => {
    const site = await createSite(b.app, s);
    expect((await api(b.app, s).del(`/api/sites/${site.id}`)).statusCode).toBe(200);
    expect((await api(b.app, s).get(`/api/sites/${site.id}`)).statusCode).toBe(404);
  });
});
