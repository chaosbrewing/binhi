import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, createSite, signup, testApp, TINY_PNG, type Session } from "../helpers.js";

let b: BinhiApp;
let s: Session;
let siteId: string;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
  siteId = (await createSite(b.app, s)).id;
});
afterAll(async () => b.close());

const upload = (session: Session, site: string, body: Buffer, type = "image/png", name = "photo.png") =>
  api(b.app, session).post(`/api/sites/${site}/assets`, body, { headers: { "content-type": type, "x-binhi-filename": name } });

describe("media library", () => {
  it("uploads a real image, lists it and serves it publicly with immutable caching", async () => {
    const res = await upload(s, siteId, TINY_PNG);
    expect(res.statusCode).toBe(200);
    const asset = res.json().asset;
    expect(asset).toMatchObject({ mimeType: "image/png", width: 2, height: 2, filename: "photo.png" });
    expect(asset.url).toMatch(/^\/media\/ast_[a-z0-9]+\/photo\.png$/);
    const list = await api(b.app, s).get(`/api/sites/${siteId}/assets`);
    expect(list.json().assets).toHaveLength(1);
    const pub = await b.app.inject({ method: "GET", url: asset.url });
    expect(pub.statusCode).toBe(200);
    expect(pub.headers["content-type"]).toBe("image/png");
    expect(pub.headers["cache-control"]).toContain("immutable");
    expect(pub.rawPayload.equals(TINY_PNG)).toBe(true);
  });

  it("rejects non-images, SVG, mislabelled files and oversized uploads", async () => {
    expect((await upload(s, siteId, Buffer.from("<svg onload=alert(1)></svg>"), "image/png", "x.svg")).statusCode).toBe(400);
    expect((await upload(s, siteId, Buffer.from("<svg></svg>"), "image/svg+xml", "x.svg")).statusCode).toBe(415);
    expect((await upload(s, siteId, Buffer.from("hello world, not an image"), "image/jpeg", "x.jpg")).statusCode).toBe(400);
    const big = Buffer.alloc(9 * 1024 * 1024, 1);
    expect((await upload(s, siteId, big)).statusCode).toBe(413);
  });

  it("sanitises file names", async () => {
    const res = await upload(s, siteId, TINY_PNG, "image/png", "../../etc/passwd");
    expect(res.statusCode).toBe(200);
    expect(res.json().asset.filename).toBe("passwd.png");
  });

  it("keeps assets inside their owner's site", async () => {
    const other = await signup(b.app);
    expect((await upload(other, siteId, TINY_PNG)).statusCode).toBe(404);
    expect((await api(b.app, other).get(`/api/sites/${siteId}/assets`)).statusCode).toBe(404);
    const mine = (await upload(s, siteId, TINY_PNG)).json().asset;
    expect((await api(b.app, other).del(`/api/sites/${siteId}/assets/${mine.id}`)).statusCode).toBe(404);
  });

  it("stops serving media once its site is deleted", async () => {
    const other = await signup(b.app);
    const site = await createSite(b.app, other);
    const asset = (await upload(other, site.id, TINY_PNG)).json().asset;
    expect((await b.app.inject({ method: "GET", url: asset.url })).statusCode).toBe(200);
    await api(b.app, other).del(`/api/sites/${site.id}`);
    expect((await b.app.inject({ method: "GET", url: asset.url })).statusCode).toBe(404);
  });

  it("updates alt text and deletes assets (public URL stops working)", async () => {
    const asset = (await upload(s, siteId, TINY_PNG)).json().asset;
    const patched = await api(b.app, s).patch(`/api/sites/${siteId}/assets/${asset.id}`, { alt: "A tiny square" });
    expect(patched.json().asset.alt).toBe("A tiny square");
    expect((await api(b.app, s).del(`/api/sites/${siteId}/assets/${asset.id}`)).statusCode).toBe(200);
    expect((await b.app.inject({ method: "GET", url: asset.url })).statusCode).toBe(404);
  });
});
