import { describe, expect, it, vi } from "vitest";
import { createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { loadOAuthConfig, appleClientSecret, OidcClient, sha, OAuthFailure } from "../../src/server/auth/oidc.js";
import { appleKey, claimsFor, fixtureEnv, syntheticToken, SyntheticIssuer, jwk } from "../oauth-fixture.js";

const nonce = "synthetic-nonce";
const config = loadOAuthConfig(fixtureEnv(), "https://binhi.test", "test");
describe("bounded OIDC verification and provider configuration", () => {
  it("defaults disabled; enabled config must explicitly match the environment, HTTPS and required credentials", () => {
    expect(loadOAuthConfig({}, "https://binhi.test", "production")).toEqual({});
    expect(() => loadOAuthConfig(fixtureEnv(), "https://binhi.test", "production")).toThrow("environment");
    expect(() => loadOAuthConfig(fixtureEnv(), "http://binhi.test", "test")).toThrow("HTTPS");
    expect(() => loadOAuthConfig({ ...fixtureEnv(), BINHI_APPLE_DEVELOPMENT_PRIVATE_KEY: "do-not-reflect-this" }, "https://binhi.test", "test")).toThrow("P-256");
    try { loadOAuthConfig({ ...fixtureEnv(), BINHI_APPLE_DEVELOPMENT_PRIVATE_KEY: "do-not-reflect-this" }, "https://binhi.test", "test"); } catch (e) { expect(String(e)).not.toContain("do-not-reflect-this"); }
    expect(() => loadOAuthConfig({ ...fixtureEnv(), BINHI_GOOGLE_DEVELOPMENT_CLIENT_SECRET: "" }, "https://binhi.test", "test")).toThrow("CLIENT_SECRET");
    expect(() => loadOAuthConfig({ ...fixtureEnv(), BINHI_GOOGLE_ENABLED: "1" }, "https://binhi.test", "test")).toThrow("true or false");
    expect(() => loadOAuthConfig({ ...fixtureEnv(), BINHI_APPLE_ELIGIBILITY_CONFIRMED: "false" }, "https://binhi.test", "test")).toThrow("eligible Apple app");
    expect(() => loadOAuthConfig({ ...fixtureEnv(), BINHI_OAUTH_ENVIRONMENT: "production" }, "https://binhi.test", "production")).toThrow("PRODUCTION_CLIENT_ID");
  });
  it("signs a fresh five-minute Apple client JWT with the selected P-256 key and kid", () => {
    const jwt = appleClientSecret(config.apple!, 1000), [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(b!, "base64url").toString())).toMatchObject({ aud: "https://appleid.apple.com", sub: "test.binhi.web", iss: "TEAM123456", iat: 1000, exp: 1300 });
    expect(verify("sha256", Buffer.from(`${h}.${b}`), { key: createPublicKey(appleKey), dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"))).toBe(true);
    expect(appleClientSecret(config.apple!, 2000)).not.toBe(jwt);
    const replacement = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const rotated = loadOAuthConfig({ ...fixtureEnv(), BINHI_APPLE_DEVELOPMENT_KEY_ID: "ROTATE1234", BINHI_APPLE_DEVELOPMENT_PRIVATE_KEY: String(replacement.privateKey.export({ type: "pkcs8", format: "pem" })) }, "https://binhi.test", "test");
    const [rh, rb, rs] = appleClientSecret(rotated.apple!, 1000).split(".");
    expect(JSON.parse(Buffer.from(rh!, "base64url").toString()).kid).toBe("ROTATE1234");
    expect(verify("sha256", Buffer.from(`${rh}.${rb}`), { key: replacement.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(rs!, "base64url"))).toBe(true);
    expect(verify("sha256", Buffer.from(`${rh}.${rb}`), { key: createPublicKey(appleKey), dsaEncoding: "ieee-p1363" }, Buffer.from(rs!, "base64url"))).toBe(false);
  });
  it.each(["google", "apple"] as const)("verifies %s RS256/JWKS, issuer, subject and nonce without remote token introspection", async p => {
    const fixture = new SyntheticIssuer(), client = new OidcClient(fixture.fetch);
    expect(await client.validate(config[p]!, syntheticToken(claimsFor(p, nonce)), sha(nonce))).toMatchObject({ subject: `${p}-subject` });
    expect(fixture.requests).toHaveLength(1);
  });
  it.each([
    { iss: "https://attacker.invalid" }, { aud: "another-client" }, { aud: ["synthetic-google", "other"] }, { azp: "another-client" },
    { exp: 1 }, { exp: "9999999999" }, { iat: 9999999999 }, { nbf: 9999999999 }, { nonce: "other" }, { sub: "" },
  ])("rejects invalid claims %j", async extra => {
    await expect(new OidcClient(new SyntheticIssuer().fetch).validate(config.google!, syntheticToken(claimsFor("google", nonce, extra)), sha(nonce))).rejects.toMatchObject({ code: "invalid_token" });
  });
  it.each([{ alg: "none" }, { alg: "HS256" }, { kid: "unknown" }, { jku: "https://attacker.invalid/keys" }, { crit: ["b64"], b64: false }])("rejects untrusted JOSE headers %j", async header => {
    const f = new SyntheticIssuer();
    await expect(new OidcClient(f.fetch).validate(config.google!, syntheticToken(claimsFor("google", nonce), header), sha(nonce))).rejects.toBeInstanceOf(OAuthFailure);
    expect(f.requests.every(x => x.startsWith("https://www.googleapis.com/"))).toBe(true);
  });
  it("rejects tampered signatures, oversized/malformed tokens and hostile JWKS", async () => {
    const client = new OidcClient(new SyntheticIssuer().fetch);
    const token = syntheticToken(claimsFor("google", nonce));
    const [h, b] = token.split(".");
    await expect(client.validate(config.google!, `${h}.${b}.${Buffer.alloc(256).toString("base64url")}`, sha(nonce))).rejects.toBeInstanceOf(OAuthFailure);
    for (const raw of ["none", ".".repeat(20000), token + ".extra"]) await expect(client.validate(config.google!, raw, sha(nonce))).rejects.toBeInstanceOf(OAuthFailure);
    const hostile: typeof fetch = async () => Response.json({ keys: Array.from({ length: 21 }, () => ({})) });
    await expect(new OidcClient(hostile).validate(config.google!, token, sha(nonce))).rejects.toMatchObject({ code: "provider_unavailable" });
  });
  it("uses S256 for Google, form_post for Apple, and never adds unsupported Apple PKCE claims", () => {
    const client = new OidcClient();
    const google = new URL(client.authorize(config.google!, "state", nonce, "verifier"));
    expect(google.searchParams.get("code_challenge")).toBe(sha("verifier"));
    expect(google.searchParams.get("code_challenge_method")).toBe("S256");
    const apple = new URL(client.authorize(config.apple!, "state", nonce, "verifier"));
    expect(apple.searchParams.get("response_mode")).toBe("form_post");
    expect(apple.searchParams.has("code_challenge")).toBe(false);
  });
  it("refreshes cached fixed-endpoint JWKS for a rotated kid after the bounded refresh interval", async () => {
    vi.useFakeTimers();
    try {
      let current = "synthetic-key", requests = 0;
      const replacement = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const client = new OidcClient(async () => { requests++; return Response.json({ keys: [{ ...(current === "synthetic-key" ? jwk : replacement.publicKey.export({ format: "jwk" })), kid: current }] }); });
      await client.validate(config.google!, syntheticToken(claimsFor("google", nonce)), sha(nonce));
      current = "rotated-key";
      vi.setSystemTime(Date.now() + 11000);
      const data = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: current })).toString("base64url")}.${Buffer.from(JSON.stringify(claimsFor("google", nonce))).toString("base64url")}`;
      const rotatedToken = `${data}.${sign("RSA-SHA256", Buffer.from(data), replacement.privateKey).toString("base64url")}`;
      await expect(client.validate(config.google!, rotatedToken, sha(nonce))).resolves.toHaveProperty("subject");
      expect(requests).toBe(2);
    } finally { vi.useRealTimers(); }
  });
  it("normalizes Google's two documented issuer forms and accepts Apple's verified relay address", async () => {
    const client = new OidcClient(new SyntheticIssuer().fetch);
    expect((await client.validate(config.google!, syntheticToken(claimsFor("google", nonce, { iss: "accounts.google.com" })), sha(nonce))).issuer).toBe("https://accounts.google.com");
    expect((await client.validate(config.apple!, syntheticToken(claimsFor("apple", nonce, { email_verified: "true", email: "relay@privaterelay.appleid.com" })), sha(nonce))).email).toBe("relay@privaterelay.appleid.com");
    expect((await client.validate(config.google!, syntheticToken(claimsFor("google", nonce, { email_verified: false })), sha(nonce))).email).toBeNull();
  });
});
