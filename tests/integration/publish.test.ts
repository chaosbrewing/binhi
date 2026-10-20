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

const pub = (url: string, headers: Record<string, string> = {}) => b.app.inject({ method: "GET", url, headers });

describe("publishing", () => {
  it("publishes a real, independently reachable site and verifies it before calling it live", async () => {
    const site = await createSite(b.app, s, "portfolio", "Live Portfolio");
    expect((await pub(`/s/${site.slug}/`)).statusCode).toBe(410);
    const res = await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    expect(res.statusCode).toBe(200);
    const publication = res.json().publication;
    expect(publication.state).toBe("live");
    expect(publication.isLive).toBe(true);
    expect(publication.url).toBe(`https://binhi.test/s/${site.slug}/`);
    expect(publication.pageCount).toBe(4);
    expect(publication.verifiedAt).toBeTruthy();
    expect(Array.isArray(res.json().warnings)).toBe(true);

    const home = await pub(`/s/${site.slug}/`);
    expect(home.statusCode).toBe(200);
    expect(home.headers["content-type"]).toContain("text/html");
    expect(home.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(home.body).toContain(`<meta name="binhi-publication" content="${publication.id}">`);
    expect(home.body).toContain("Live Portfolio");
    expect(home.body).not.toContain("data-b-id");
    const work = await pub(`/s/${site.slug}/work/`);
    expect(work.statusCode).toBe(200);
    const redirect = await pub(`/s/${site.slug}/work`);
    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location).toBe(`/s/${site.slug}/work/`);
    expect((await pub(`/s/${site.slug}/missing/`)).statusCode).toBe(404);
    expect((await pub(`/s/_binhi/runtime.js`)).statusCode).toBe(200);
    const detail = await api(b.app, s).get(`/api/sites/${site.id}`);
    expect(detail.json().site.liveUrl).toBe(`https://binhi.test/s/${site.slug}/`);
  });

  it("new publications supersede old ones without downtime; unpublish takes the site down; rollback restores it", async () => {
    const site = await createSite(b.app, s, "blank", "Roll Back");
    const headingId = site.document.pages[0]!.sections[0]!.children![0]!.id;
    const p1 = (await api(b.app, s).post(`/api/sites/${site.id}/publish`)).json().publication;
    await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "updateProps", nodeId: headingId, props: { text: "Second edition" } }]));
    const p2 = (await api(b.app, s).post(`/api/sites/${site.id}/publish`)).json().publication;
    expect(p2.state).toBe("live");
    expect((await pub(`/s/${site.slug}/`)).body).toContain("Second edition");
    const history = (await api(b.app, s).get(`/api/sites/${site.id}/publications`)).json().publications;
    expect(history.map((p: { id: string; state: string }) => [p.id, p.state])).toEqual([[p2.id, "live"], [p1.id, "superseded"]]);

    const un = await api(b.app, s).post(`/api/sites/${site.id}/unpublish`);
    expect(un.json().publication.state).toBe("unpublished");
    expect((await pub(`/s/${site.slug}/`)).statusCode).toBe(410);

    const rb = await api(b.app, s).post(`/api/sites/${site.id}/publications/${p1.id}/rollback`);
    expect(rb.statusCode).toBe(200);
    expect(rb.json().publication.state).toBe("live");
    const body = (await pub(`/s/${site.slug}/`)).body;
    expect(body).toContain("Welcome");
    expect(body).not.toContain("Second edition");
    expect((await api(b.app, s).post(`/api/sites/${site.id}/publications/${p1.id}/rollback`)).statusCode).toBe(400);
  });

  it("blocks publishing when the document is invalid and reports accessibility warnings", async () => {
    const site = await createSite(b.app, s, "blank", "Warnings");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [
      { type: "insertComponent", target: { parentId: sectionId }, componentType: "image", props: { src: "/media/ast_abc123/x.png", alt: "" } },
      { type: "insertComponent", target: { parentId: sectionId }, componentType: "button", props: { label: "Nowhere" } },
    ]));
    const report = (await api(b.app, s).get(`/api/sites/${site.id}/validate`)).json().report;
    expect(report.ok).toBe(true);
    expect(report.warnings.map((w: { code: string }) => w.code)).toEqual(expect.arrayContaining(["MISSING_ALT", "BUTTON_NO_LINK"]));
    // duplicate anchors are an error
    const ids = (await api(b.app, s).get(`/api/sites/${site.id}`)).json().site.document.pages[0].sections[0].children.map((c: { id: string }) => c.id);
    await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "setAnchor", nodeId: ids[0], anchorId: "top" }, { type: "setAnchor", nodeId: ids[1], anchorId: "top" }]));
    const blocked = await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error.message).toContain("anchor");
  });

  it("records a failed publication honestly when verification fails", async () => {
    const broken = await testApp({ BINHI_VERIFY_BASE_URL: "https://nowhere.invalid" }, {
      truncate: false,
      fetchImpl: async () => {
        throw new Error("getaddrinfo ENOTFOUND nowhere.invalid");
      },
    });
    try {
      const sess = await signup(broken.app);
      const site = await createSite(broken.app, sess, "blank", "Broken");
      const res = await api(broken.app, sess).post(`/api/sites/${site.id}/publish`);
      expect(res.statusCode).toBe(200);
      expect(res.json().publication.state).toBe("failed");
      expect(res.json().publication.error).toContain("Could not reach");
      expect((await broken.app.inject({ method: "GET", url: `/s/${site.slug}/` })).statusCode).toBe(410);
    } finally {
      await broken.close();
    }
  });

  it("refuses to change the address of a live site and hides publishing from strangers", async () => {
    const site = await createSite(b.app, s, "blank", "Locked Slug");
    await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    expect((await api(b.app, s).patch(`/api/sites/${site.id}`, { slug: "something-else" })).statusCode).toBe(400);
    const other = await signup(b.app);
    expect((await api(b.app, other).post(`/api/sites/${site.id}/publish`)).statusCode).toBe(404);
    expect((await api(b.app, other).post(`/api/sites/${site.id}/unpublish`)).statusCode).toBe(404);
    expect((await api(b.app, other).get(`/api/sites/${site.id}/publications`)).statusCode).toBe(404);
  });

  it("accepts form submissions from the published site, validates them, ignores bots and lets the owner read them", async () => {
    const site = await createSite(b.app, s, "landing", "Waitlist");
    await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    const html = (await pub(`/s/${site.slug}/`)).body;
    const m = /action="\/s\/[a-z0-9-]+\/__form\/(form_[a-z0-9]+)"/.exec(html)!;
    const formId = m[1]!;
    const fieldId = /name="(fld_[a-z0-9]+)"/.exec(html)![1]!;
    const post = (payload: string, extra: Record<string, string> = {}) =>
      b.app.inject({ method: "POST", url: `/s/${site.slug}/__form/${formId}`, headers: { "content-type": "application/x-www-form-urlencoded", referer: `https://binhi.test/s/${site.slug}/`, ...extra }, payload });
    const ok = await post(`${fieldId}=person%40example.com`);
    expect(ok.statusCode).toBe(303);
    expect(ok.headers.location).toBe(`/s/${site.slug}/#${formId}-sent`);
    const invalid = await post(`${fieldId}=not-an-email`);
    expect(invalid.statusCode).toBe(400);
    const bot = await post(`${fieldId}=bot%40example.com&website=http://spam`);
    expect(bot.statusCode).toBe(303);
    const subs = (await api(b.app, s).get(`/api/sites/${site.id}/submissions`)).json().submissions;
    expect(subs).toHaveLength(1);
    expect(subs[0].fields).toEqual({ Email: "person@example.com" });
    const other = await signup(b.app);
    expect((await api(b.app, other).get(`/api/sites/${site.id}/submissions`)).statusCode).toBe(404);
    expect((await api(b.app, s).del(`/api/sites/${site.id}/submissions/${subs[0].id}`)).statusCode).toBe(200);
  });

  it("deleting a site takes its published pages offline", async () => {
    const site = await createSite(b.app, s, "blank", "Gone Soon");
    await api(b.app, s).post(`/api/sites/${site.id}/publish`);
    expect((await pub(`/s/${site.slug}/`)).statusCode).toBe(200);
    await api(b.app, s).del(`/api/sites/${site.id}`);
    expect((await pub(`/s/${site.slug}/`)).statusCode).toBe(410);
  });
});
