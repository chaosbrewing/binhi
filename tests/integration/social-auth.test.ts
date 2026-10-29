import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import type { SocialProvider, OAuthIntent } from "../../src/core/auth.js";
import { api, signup, testApp, createSite, type Session } from "../helpers.js";
import { SyntheticIssuer, fixtureEnv } from "../oauth-fixture.js";
import { sha } from "../../src/server/auth/oidc.js";

let b: BinhiApp;
const issuer = new SyntheticIssuer();
let testIp = 1;
beforeAll(async () => { b = await testApp(fixtureEnv(), { oidcFetchImpl: issuer.fetch }); });
afterAll(async () => b.close());
const cookie = (r: { cookies: { name: string; value: string }[] }, name: string) => {
  const found = r.cookies.find(c => c.name === name);
  return found ? `${found.name}=${found.value}` : "";
};
async function start(p: SocialProvider, intent: OAuthIntent = "login", s: Session | null = null, grant = "") {
  const r = await api(b.app, s).post(`/api/auth/${p}/start`, { intent }, { headers: {
    "x-forwarded-for": `198.51.100.${testIp++}`, ...(grant ? { cookie: `${s!.cookie}; ${grant}` } : {}),
  } });
  expect(r.statusCode, r.body).toBe(200);
  return { url: r.json().redirectUrl as string, binding: cookie(r, `binhi_oauth_${p}`), response: r };
}
async function finish(p: SocialProvider, f: Awaited<ReturnType<typeof start>>, extra: Record<string, unknown> = {}) {
  const data = issuer.authorize(f.url, extra);
  return p === "google"
    ? b.app.inject({ method: "GET", url: `/api/auth/google/callback?${new URLSearchParams(data)}`, headers: { cookie: f.binding } })
    : b.app.inject({ method: "POST", url: "/api/auth/apple/callback", headers: { cookie: f.binding, "content-type": "application/x-www-form-urlencoded" }, payload: new URLSearchParams(data).toString() });
}
async function session(r: Awaited<ReturnType<typeof finish>>): Promise<Session> {
  expect(r.headers.location, r.body).toBe("/");
  const c = cookie(r, "binhi_session");
  const me = await b.app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: c } });
  return { cookie: c, user: me.json().user };
}
async function passwordGrant(s: Session) {
  const r = await api(b.app, s).post("/api/auth/reauth", { password: "correct horse battery" }, { headers: { "x-forwarded-for": `198.51.100.${testIp++}` } });
  expect(r.statusCode, r.body).toBe(200);
  return cookie(r, "binhi_reauth");
}
async function providerGrant(s: Session, p: SocialProvider, extra: Record<string, unknown>) {
  const r = await finish(p, await start(p, "reauth", s), extra);
  expect(r.headers.location).toBe("/account");
  return cookie(r, "binhi_reauth");
}
const methods = async (s: Session) => (await api(b.app, s).get("/api/auth/methods")).json();

describe("additive social authentication and identity safety", () => {
  it("creates an OAuth-only user and existing BINHI session; repeated subject keeps identity despite email changes", async () => {
    const flow = await start("google");
    const r = await finish("google", flow, { sub: "first", email: "first@example.invalid" });
    const s = await session(r);
    expect(r.cookies.find(c => c.name === "binhi_session")).toMatchObject({ httpOnly: true, sameSite: "Lax", maxAge: 2592000 });
    expect((await methods(s)).hasPassword).toBe(false);
    expect((await api(b.app, null).post("/api/auth/login", { email: "first@example.invalid", password: "correct horse battery" })).statusCode).toBe(401);
    const again = await session(await finish("google", await start("google"), { sub: "first", email: "changed@example.invalid" }));
    expect(again.user.id).toBe(s.user.id);
    expect(again.user.email).toBe("first@example.invalid");
    const exchange = issuer.exchanges[0]!;
    expect(sha(exchange.get("code_verifier")!)).toBe(new URL(flow.url).searchParams.get("code_challenge"));
    expect(exchange.get("redirect_uri")).toBe("https://binhi.test/api/auth/google/callback");
  });
  it("never links a matching verified email to an existing password account", async () => {
    const s = await signup(b.app, "matching@example.invalid");
    const r = await finish("google", await start("google"), { sub: "match", email: s.user.email });
    expect(r.headers.location).toBe("/signin?oauth_error=account_exists");
    expect((await methods(s)).identities).toHaveLength(0);
    expect((await api(b.app, null).post("/api/auth/login", { email: s.user.email, password: "correct horse battery" })).statusCode).toBe(200);
  });
  it("requires an authenticated, freshly reauthenticated session to link; keeps account ownership and local email", async () => {
    expect((await api(b.app, null).post("/api/auth/apple/start", { intent: "link" })).statusCode).toBe(401);
    const s = await signup(b.app, "linker@example.invalid");
    const site = await createSite(b.app, s);
    expect((await api(b.app, s).post("/api/auth/apple/start", { intent: "link" })).statusCode).toBe(401);
    const f = await start("apple", "link", s, await passwordGrant(s));
    expect(f.response.cookies.find(c => c.name === "binhi_oauth_apple")).toMatchObject({ httpOnly: true, secure: true, sameSite: "None", path: "/api/auth/apple/callback" });
    const r = await finish("apple", f, { sub: "linker-apple", email: "relay@privaterelay.appleid.com", email_verified: "true" });
    expect(r.headers.location).toBe("/account");
    const logged = await b.app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: cookie(r, "binhi_session") } });
    expect(logged.json().user).toMatchObject({ id: s.user.id, email: "linker@example.invalid" });
    expect((await api(b.app, s).get(`/api/sites/${site.id}`)).statusCode).toBe(200);
    const byApple = await session(await finish("apple", await start("apple"), { sub: "linker-apple", email: "other@privaterelay.appleid.com" }));
    expect(byApple.user.id).toBe(s.user.id);
  });
  it("rejects linking identities already owned by another account and wrong-account reauthentication", async () => {
    const owner = await session(await finish("google", await start("google"), { sub: "owned", email: "owned@example.invalid" }));
    const victim = await signup(b.app, "victim@example.invalid");
    const linked = await finish("google", await start("google", "link", victim, await passwordGrant(victim)), { sub: "owned", email: "owned@example.invalid" });
    expect(linked.headers.location).toBe("/account?oauth_error=identity_conflict");
    const wrong = await finish("google", await start("google", "reauth", owner), { sub: "first", email: "first@example.invalid" });
    expect(wrong.headers.location).toBe("/account?oauth_error=identity_conflict");
    expect((await api(b.app, owner).post("/api/auth/google/start", { intent: "login" })).statusCode).toBe(403);
  });
  it("supports verified Apple relay signup without creating a password; last login method cannot be unlinked", async () => {
    const data = { sub: "only-apple", email: "only@privaterelay.appleid.com", email_verified: "true" };
    const s = await session(await finish("apple", await start("apple"), data));
    const m = await methods(s);
    expect(m.hasPassword).toBe(false);
    expect(m.identities[0].canUnlink).toBe(false);
    const grant = await providerGrant(s, "apple", data);
    const remove = await api(b.app, s).del(`/api/auth/identities/${m.identities[0].id}`, undefined);
    expect(remove.statusCode).toBe(401);
    const rejected = await b.app.inject({ method: "DELETE", url: `/api/auth/identities/${m.identities[0].id}`, headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${grant}` } });
    expect(rejected.statusCode).toBe(403);
    expect((await methods(s)).identities).toHaveLength(1);
  });
  it("unlinks after fresh password reauthentication; grant is single-use and cannot act on another owner", async () => {
    const s = await signup(b.app, "unlinker@example.invalid");
    await finish("google", await start("google", "link", s, await passwordGrant(s)), { sub: "unlinker", email: "unlinker@example.invalid" });
    const id = (await methods(s)).identities[0].id;
    const other = await signup(b.app, "unrelated@example.invalid");
    const g = await passwordGrant(other);
    expect((await b.app.inject({ method: "DELETE", url: `/api/auth/identities/${id}`, headers: { "x-binhi-request": "editor", cookie: `${other.cookie}; ${g}` } })).statusCode).toBe(404);
    const grant = await passwordGrant(s);
    const request = () => b.app.inject({ method: "DELETE", url: `/api/auth/identities/${id}`, headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${grant}` } });
    expect((await request()).statusCode).toBe(200);
    expect((await request()).statusCode).toBe(401);
    expect((await methods(s)).identities).toHaveLength(0);
  });
  it("requires the browser binding; state and successful/failed callbacks cannot be replayed", async () => {
    const f = await start("google"), data = issuer.authorize(f.url, { sub: "replay", email: "replay@example.invalid" });
    const url = `/api/auth/google/callback?${new URLSearchParams(data)}`;
    expect((await b.app.inject({ method: "GET", url })).headers.location).toBe("/signin?oauth_error=invalid_state");
    const results = await Promise.all([1, 2].map(() => b.app.inject({ method: "GET", url, headers: { cookie: f.binding } })));
    expect(results.map(r => r.headers.location).sort()).toEqual(["/", "/signin?oauth_error=invalid_state"].sort());
    const bad = await start("google");
    expect((await finish("google", bad, { aud: "wrong" })).headers.location).toBe("/signin?oauth_error=invalid_token");
    expect((await finish("google", bad)).headers.location).toBe("/signin?oauth_error=invalid_state");
  });
  it("rejects expired state, cross-provider state, duplicate Apple form parameters and unsafe callback error text", async () => {
    const f = await start("apple"), d = issuer.authorize(f.url);
    const dupe = await b.app.inject({ method: "POST", url: "/api/auth/apple/callback", headers: { cookie: f.binding, "content-type": "application/x-www-form-urlencoded" }, payload: `${new URLSearchParams(d)}&state=another` });
    expect(dupe.statusCode).toBeGreaterThanOrEqual(400);
    const wrong = await b.app.inject({ method: "GET", url: `/api/auth/google/callback?${new URLSearchParams(d)}`, headers: { cookie: f.binding.replace("apple=", "google=") } });
    expect(wrong.headers.location).toBe("/signin?oauth_error=invalid_state");
    await b.sql`update binhi_oauth_transactions set expires_at=now()-interval '1 second'`;
    expect((await finish("apple", f)).headers.location).toBe("/signin?oauth_error=invalid_state");
    const cancelled = await start("google");
    const r = await b.app.inject({ method: "GET", url: `/api/auth/google/callback?state=${new URL(cancelled.url).searchParams.get("state")}&error=%3Cscript%3Ebad`, headers: { cookie: cancelled.binding } });
    expect(r.headers.location).toBe("/signin?oauth_error=cancelled");
    expect(r.body).not.toContain("<script>");
  });
  it("keeps CSRF header requirements on all other endpoints; callback cannot bypass transaction checks", async () => {
    expect((await b.app.inject({ method: "POST", url: "/api/auth/login", payload: {} })).statusCode).toBe(403);
    expect((await b.app.inject({ method: "POST", url: "/api/auth/google/start", payload: { intent: "login" } })).statusCode).toBe(403);
    const r = await b.app.inject({ method: "POST", url: "/api/auth/apple/callback", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "state=attacker&code=attacker" });
    expect(r.headers.location).toBe("/signin?oauth_error=invalid_state");
    expect((await api(b.app, null).get("/api/auth/methods")).statusCode).toBe(401);
  });
  it("rejects revoked initiating sessions before linking and expired reauth grants", async () => {
    const s = await signup(b.app, "revoked@example.invalid");
    const f = await start("google", "link", s, await passwordGrant(s));
    await api(b.app, s).post("/api/auth/logout");
    expect((await finish("google", f, { sub: "revoked", email: s.user.email })).headers.location).toBe("/signin?oauth_error=invalid_state");
    const other = await signup(b.app, "expired-grant@example.invalid");
    const g = await passwordGrant(other);
    await b.sql`update binhi_auth_grants set expires_at=now()-interval '1 second'`;
    const r = await api(b.app, other).post("/api/auth/google/start", { intent: "link" }, { headers: { cookie: `${other.cookie}; ${g}` } });
    expect(r.statusCode).toBe(401);
  });
});

describe("OAuth-only account deletion", () => {
  it("requires fresh provider reauth, deletes only the owner and revokes all their sessions/mappings", async () => {
    const data = { sub: "delete-only", email: "delete-only@example.invalid" };
    const s = await session(await finish("google", await start("google"), data));
    const site = await createSite(b.app, s);
    const other = await signup(b.app, "keep@example.invalid");
    const otherSite = await createSite(b.app, other);
    expect((await api(b.app, s).del("/api/auth/account", {})).statusCode).toBe(401);
    const g = await providerGrant(s, "google", data);
    const result = await b.app.inject({ method: "DELETE", url: "/api/auth/account", headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${g}` }, payload: {} });
    expect(result.statusCode, result.body).toBe(200);
    expect((await api(b.app, s).get(`/api/sites/${site.id}`)).statusCode).toBe(401);
    expect((await api(b.app, other).get(`/api/sites/${otherSite.id}`)).statusCode).toBe(200);
    expect(await b.sql`select id from binhi_auth_identities where user_id=${s.user.id}`).toHaveLength(0);
    expect(await b.sql`select id from binhi_sessions where user_id=${s.user.id}`).toHaveLength(0);
  });
  it("encrypts Apple's revocation token and preserves the account/identity if consent revocation fails", async () => {
    const apple = { sub: "revocation-owner", email: "revocation@privaterelay.appleid.com" };
    const s = await session(await finish("apple", await start("apple"), apple));
    await finish("google", await start("google", "link", s, await providerGrant(s, "apple", apple)), { sub: "revocation-google", email: "revocation-google@example.invalid" });
    const [identity] = await b.sql`select id,revocation_ciphertext from binhi_auth_identities where user_id=${s.user.id} and provider='apple'`;
    expect(identity!.revocation_ciphertext).toBeTruthy();
    expect(identity!.revocation_ciphertext).not.toContain("synthetic-refresh");
    issuer.revokeFails = true;
    try {
      let grant = await providerGrant(s, "apple", apple);
      let r = await b.app.inject({ method: "DELETE", url: `/api/auth/identities/${identity!.id}`, headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${grant}` } });
      expect(r.statusCode).toBe(503);
      expect((await methods(s)).identities).toHaveLength(2);
      grant = await providerGrant(s, "apple", apple);
      r = await b.app.inject({ method: "DELETE", url: "/api/auth/account", headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${grant}` }, payload: {} });
      expect(r.statusCode).toBe(503);
      expect(r.body).not.toContain("synthetic-refresh");
      expect((await api(b.app, s).get("/api/auth/me")).json().user.id).toBe(s.user.id);
    } finally { issuer.revokeFails = false; }
    const grant = await providerGrant(s, "apple", apple);
    const r = await b.app.inject({ method: "DELETE", url: "/api/auth/account", headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${grant}` }, payload: {} });
    expect(r.statusCode).toBe(200);
    expect(issuer.revocations.at(-1)!.get("token_type_hint")).toBe("refresh_token");
    expect(issuer.revocations.at(-1)!.get("token")).toMatch(/^synthetic-refresh-/);
    expect((await b.sql`select id from binhi_auth_identities where user_id=${s.user.id}`).length).toBe(0);
  });
});

describe("configuration, signup controls and concurrent lockout prevention", () => {
  it("defaults unavailable with no credential leakage; closed signup still permits existing linked identities", async () => {
    const off = await testApp({}, { truncate: false });
    try {
      const r = await api(off.app, null).get("/api/auth/providers");
      expect(r.json().providers.every((p: { available: boolean }) => !p.available)).toBe(true);
      expect(r.headers["cache-control"]).toBe("no-store");
      expect(JSON.stringify(r.json())).not.toMatch(/CLIENT_SECRET|PRIVATE_KEY|synthetic-secret/);
      expect((await api(off.app, null).post("/api/auth/google/start", { intent: "login" })).statusCode).toBe(503);
    } finally { await off.close(); }
    const closed = await testApp({ ...fixtureEnv(), BINHI_ALLOW_SIGNUP: "false" }, { truncate: false, oidcFetchImpl: issuer.fetch });
    try {
      for (const [sub, email, expected] of [["new-closed", "closed@example.invalid", "/signin?oauth_error=signup_disabled"], ["first", "first@example.invalid", "/"]]) {
        const f = await api(closed.app, null).post("/api/auth/google/start", { intent: "login" });
        const d = issuer.authorize(f.json().redirectUrl, { sub, email });
        const r = await closed.app.inject({ method: "GET", url: `/api/auth/google/callback?${new URLSearchParams(d)}`, headers: { cookie: cookie(f, "binhi_oauth_google") } });
        expect(r.headers.location).toBe(expected);
      }
    } finally { await closed.close(); }
  });
  it("does not sign up without verified provider email, and keeps token exchange failures generic", async () => {
    const f = await start("google");
    expect((await finish("google", f, { sub: "unverified", email_verified: false })).headers.location).toBe("/signin?oauth_error=email_required");
    const bad = await start("google");
    const r = await b.app.inject({ method: "GET", url: `/api/auth/google/callback?state=${new URL(bad.url).searchParams.get("state")}&code=unknown-secret-code`, headers: { cookie: bad.binding } });
    expect(r.headers.location).toBe("/signin?oauth_error=provider_unavailable");
    expect(r.body).not.toContain("unknown-secret-code");
    expect(r.body).not.toContain("synthetic-secret");
  });
  it("serializes concurrent unlink operations and never counts a disabled provider as a remaining usable method", async () => {
    const data = { sub: "concurrent", email: "concurrent@example.invalid" };
    const s = await session(await finish("google", await start("google"), data));
    await finish("apple", await start("apple", "link", s, await providerGrant(s, "google", data)), { sub: "concurrent-apple", email: "concurrent@privaterelay.appleid.com" });
    const m = await methods(s);
    const googleId = m.identities.find((i: { provider: string }) => i.provider === "google").id;
    const limited = await testApp({ ...fixtureEnv(), BINHI_APPLE_ENABLED: "false" }, { truncate: false, oidcFetchImpl: issuer.fetch });
    try {
      const view = (await api(limited.app, s).get("/api/auth/methods")).json();
      expect(view.identities.find((i: { provider: string }) => i.provider === "google").canUnlink).toBe(false);
      const g = await providerGrant(s, "google", data);
      expect((await limited.app.inject({ method: "DELETE", url: `/api/auth/identities/${googleId}`, headers: { "x-binhi-request": "editor", cookie: `${s.cookie}; ${g}` } })).statusCode).toBe(403);
    } finally { await limited.close(); }
    const second = await session(await finish("google", await start("google"), data));
    const grants = [await providerGrant(s, "google", data), await providerGrant(second, "google", data)];
    // A grant belongs to its initiating session, even when the other session belongs to the same user.
    expect((await api(b.app, second).post("/api/auth/apple/start", { intent: "link" }, { headers: { cookie: `${second.cookie}; ${grants[0]}` } })).statusCode).toBe(401);
    const results = await Promise.all(m.identities.map((i: { id: string }, index: number) => b.app.inject({
      method: "DELETE", url: `/api/auth/identities/${i.id}`,
      headers: { "x-binhi-request": "editor", cookie: `${[s, second][index]!.cookie}; ${grants[index]}` },
    })));
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 403]);
    expect((await methods(s)).identities).toHaveLength(1);
  });
});
