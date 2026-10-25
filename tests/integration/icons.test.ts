import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, batch, createSite, signup, testApp, type Session } from "../helpers.js";
import { createDesignDocument, makeLayer } from "../../src/core/creative/index.js";
import { resolveIconShapeSync } from "../../src/core/icons/shapes-all.js";

let b: BinhiApp;
let s: Session;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
});
afterAll(async () => b.close());

const pub = (url: string) => b.app.inject({ method: "GET", url });

describe("icon library in the Website Builder (server side)", () => {
  it("accepts a library icon through the validated operation API and rejects invalid ones", async () => {
    const site = await createSite(b.app, s, "blank", "Icon Site");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const bad = async (props: Record<string, unknown>) =>
      api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", props }]));
    expect((await bad({ icon: "binhi.icon.nope" })).statusCode).toBe(400);
    expect((await bad({ icon: "binhi.icon.camera", variant: "filled" })).statusCode).toBe(400);
    expect((await bad({ icon: '"><script>alert(1)</script>' })).statusCode).toBe(400);
    expect((await bad({ icon: "binhi.icon.camera", gradient: { from: "#fff", to: "javascript:alert(1)", angle: 0 } })).statusCode).toBe(400);
    const ok = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", props: { icon: "binhi.icon.camera", size: 64, variant: "duotone", strokeWidth: 1.5 } }]));
    expect(ok.statusCode).toBe(200);
  });

  it("saves, reopens, previews and publishes the icon; only the used icon is embedded; account boundaries hold", async () => {
    const site = await createSite(b.app, s, "blank", "Icon Publish");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const res = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", nodeId: "icon_abc1234567", props: { icon: "binhi.icon.heart", size: 48, variant: "filled" } }, { type: "updateA11y", nodeId: "icon_abc1234567", a11y: { label: "We love our customers" } }]));
    expect(res.statusCode).toBe(200);

    // reopen: the stored document still carries the canonical id and style settings
    const reopened = (await api(b.app, s).get(`/api/sites/${site.id}`)).json().site;
    const node = reopened.document.pages[0].sections[0].children.find((n: { id: string }) => n.id === "icon_abc1234567");
    expect(node.props).toMatchObject({ icon: "binhi.icon.heart", size: 48, variant: "filled" });
    expect(node.a11y.label).toBe("We love our customers");

    const heart = String(resolveIconShapeSync("binhi.icon.heart")![0]![1].d);
    const camera = String(resolveIconShapeSync("binhi.icon.camera")![0]![1].d);

    // server-rendered preview
    const preview = await api(b.app, s).get(`/api/sites/${site.id}/preview/`);
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain(heart);
    expect(preview.body).toContain('role="img" aria-label="We love our customers"');
    expect(preview.body).not.toContain(camera);

    // publish, then read the public page without a session
    const published = await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    expect(published.statusCode).toBe(200);
    expect(published.json().publication.state).toBe("live");
    const live = await pub(`/s/${site.slug}/`);
    expect(live.statusCode).toBe(200);
    expect(live.body).toContain('data-icon="binhi.icon.heart"');
    expect(live.body).toContain(heart);
    expect(live.body).not.toContain(camera);
    expect(live.body).not.toMatch(/data-icon-pending/);
    expect(live.headers["content-security-policy"]).toContain("default-src 'none'");

    // another account cannot read or change this site
    const other = await signup(b.app);
    expect((await api(b.app, other).get(`/api/sites/${site.id}`)).statusCode).toBe(404);
    expect((await api(b.app, other).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "updateProps", nodeId: "icon_abc1234567", props: { icon: "binhi.icon.star" } }]))).statusCode).toBe(404);
  });
});

describe("icon library in the Design Studio (server side)", () => {
  const withIcon = (extra: Record<string, unknown> = {}) => {
    const doc = createDesignDocument(1080, 1080);
    // Build a valid layer first, then overlay the (possibly invalid) fields the test wants the server to judge.
    return { ...doc, layers: [{ ...makeLayer("icon", doc, { icon: "binhi.icon.publish", variant: "duotone", color: "#336699" }), ...extra }] };
  };

  it("stores, reloads, duplicates and templates a design containing icon layers", async () => {
    const created = await api(b.app, s).post("/api/projects", { kind: "design", name: "Icon card", document: withIcon() });
    expect(created.statusCode).toBe(200);
    const project = created.json().project;
    expect(project.meta.layers).toBe(1);
    const loaded = (await api(b.app, s).get(`/api/projects/${project.id}`)).json().project;
    expect(loaded.document.layers[0]).toMatchObject({ type: "icon", icon: "binhi.icon.publish", variant: "duotone", color: "#336699" });

    const updated = await api(b.app, s).patch(`/api/projects/${project.id}`, { baseRevision: loaded.revision, document: withIcon({ icon: "binhi.icon.heart", variant: "filled", flipX: true, gradient: { from: "#ff0000", to: "#0000ff", angle: 90 } }) });
    expect(updated.statusCode).toBe(200);

    const template = (await api(b.app, s).post(`/api/projects/${project.id}/duplicate`, { kind: "design-template", name: "Icon template" })).json().project;
    expect(template.document.layers[0]).toMatchObject({ icon: "binhi.icon.heart", flipX: true });
    const fresh = (await api(b.app, s).post(`/api/projects/${template.id}/duplicate`, { kind: "design", name: "From icon template" })).json().project;
    expect(fresh.document.layers[0].icon).toBe("binhi.icon.heart");
  });

  it("rejects unknown icons, unsupported styles, markup and malformed payloads", async () => {
    const reject = async (extra: Record<string, unknown>) => (await api(b.app, s).post("/api/projects", { kind: "design", name: "Bad", document: withIcon(extra) })).statusCode;
    expect(await reject({ icon: "binhi.icon.not-real" })).toBe(400);
    expect(await reject({ icon: "binhi.icon.publish", variant: "filled" })).toBe(400);
    expect(await reject({ icon: '<svg onload="x">' })).toBe(400);
    expect(await reject({ color: "url(javascript:alert(1))" })).toBe(400);
    expect(await reject({ strokeWidth: 99 })).toBe(400);
    expect(await reject({ gradient: { from: "#fff", to: "expression(alert(1))", angle: 1 } })).toBe(400);
    const doc = createDesignDocument(640, 640);
    const layer = { ...makeLayer("icon", doc), svg: "<svg><script>alert(1)</script></svg>" };
    // unknown keys are stripped, never stored as markup
    const stripped = await api(b.app, s).post("/api/projects", { kind: "design", name: "Strip", document: { ...doc, layers: [layer] } });
    expect(stripped.statusCode).toBe(200);
    expect(JSON.stringify(stripped.json().project.document)).not.toContain("<script>");
  });

  it("keeps designs with icons private to their owner", async () => {
    const project = (await api(b.app, s).post("/api/projects", { kind: "design", name: "Private icons", document: withIcon() })).json().project;
    const other = await signup(b.app);
    expect((await api(b.app, other).get(`/api/projects/${project.id}`)).statusCode).toBe(404);
    expect((await api(b.app, other).patch(`/api/projects/${project.id}`, { baseRevision: 0, document: withIcon() })).statusCode).toBe(404);
    expect((await api(b.app, other).del(`/api/projects/${project.id}`)).statusCode).toBe(404);
    expect((await b.app.inject({ method: "GET", url: `/api/projects/${project.id}` })).statusCode).toBe(401);
  });
});
