import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, signup, testApp, createSite } from "../helpers.js";

let b: BinhiApp;
beforeAll(async () => {
  b = await testApp();
});
afterAll(async () => b.close());

describe("authentication", () => {
  it("signs up, reports the session, signs out", async () => {
    const s = await signup(b.app, "ana@example.com");
    const me = await api(b.app, s).get("/api/auth/me");
    expect(me.json().user.email).toBe("ana@example.com");
    const out = await api(b.app, s).post("/api/auth/logout");
    expect(out.statusCode).toBe(200);
    const after = await api(b.app, s).get("/api/auth/me");
    expect(after.json().user).toBeNull();
  });

  it("rejects duplicate emails, short passwords and wrong credentials without revealing which part failed", async () => {
    await signup(b.app, "ben@example.com", "a-long-enough-password");
    const dup = await api(b.app, null).post("/api/auth/signup", { email: "Ben@example.com", password: "another-long-password", displayName: "B" });
    expect(dup.statusCode).toBe(409);
    const short = await api(b.app, null).post("/api/auth/signup", { email: "c@example.com", password: "short", displayName: "C" });
    expect(short.statusCode).toBe(400);
    const wrong = await api(b.app, null).post("/api/auth/login", { email: "ben@example.com", password: "not-the-password" });
    expect(wrong.statusCode).toBe(401);
    const unknown = await api(b.app, null).post("/api/auth/login", { email: "nobody@example.com", password: "not-the-password" });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.message).toBe(wrong.json().error.message);
    const ok = await api(b.app, null).post("/api/auth/login", { email: "ben@example.com", password: "a-long-enough-password" });
    expect(ok.statusCode).toBe(200);
    expect(ok.cookies.find((c) => c.name === "binhi_session")?.httpOnly).toBe(true);
  });

  it("blocks state-changing API calls without the editor header (CSRF guard)", async () => {
    const s = await signup(b.app);
    const res = await b.app.inject({ method: "POST", url: "/api/sites", headers: { cookie: s.cookie }, payload: { name: "x", templateId: "blank" } });
    expect(res.statusCode).toBe(403);
  });

  it("requires sign-in for site APIs", async () => {
    const res = await api(b.app, null).get("/api/sites");
    expect(res.statusCode).toBe(401);
  });

  it("deletes an account with its sites and sessions", async () => {
    const s = await signup(b.app, "del@example.com", "delete-me-please-now");
    const site = await createSite(b.app, s);
    const wrongPw = await api(b.app, s).del("/api/auth/account", { password: "nope-nope-nope" });
    expect(wrongPw.statusCode).toBe(401);
    const res = await api(b.app, s).del("/api/auth/account", { password: "delete-me-please-now" });
    expect(res.statusCode).toBe(200);
    expect((await api(b.app, s).get("/api/auth/me")).json().user).toBeNull();
    const login = await api(b.app, null).post("/api/auth/login", { email: "del@example.com", password: "delete-me-please-now" });
    expect(login.statusCode).toBe(401);
    const other = await signup(b.app);
    expect((await api(b.app, other).get(`/api/sites/${site.id}`)).statusCode).toBe(404);
  });

  it("rate limits repeated sign-in attempts", async () => {
    let limited = false;
    for (let i = 0; i < 30; i++) {
      const res = await b.app.inject({ method: "POST", url: "/api/auth/login", headers: { "x-binhi-request": "editor", "x-forwarded-for": "203.0.113.9" }, payload: { email: "x@example.com", password: "whatever-whatever" } });
      if (res.statusCode === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
