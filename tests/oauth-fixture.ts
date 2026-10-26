/** Synthetic issuer keys and transport only. Never uses provider consoles or real credentials. */
import { generateKeyPairSync, sign } from "node:crypto";
import { ISSUERS } from "../src/server/auth/oidc.js";
import type { SocialProvider } from "../src/core/auth.js";
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
export const jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "synthetic-key", use: "sig", alg: "RS256" };
export const appleKey = ec.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
export function syntheticToken(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid, ...header })).toString("base64url");
  const b = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${h}.${b}.${sign("RSA-SHA256", Buffer.from(`${h}.${b}`), rsa.privateKey).toString("base64url")}`;
}
export function fixtureEnv(base = "https://binhi.test"): Record<string, string> {
  return { BINHI_PUBLIC_URL: base, BINHI_OAUTH_ENVIRONMENT: "development",
    BINHI_GOOGLE_ENABLED: "true", BINHI_GOOGLE_DEVELOPMENT_CLIENT_ID: "synthetic-google", BINHI_GOOGLE_DEVELOPMENT_CLIENT_SECRET: "synthetic-secret",
    BINHI_APPLE_ENABLED: "true", BINHI_APPLE_ELIGIBILITY_CONFIRMED: "true", BINHI_APPLE_DEVELOPMENT_CLIENT_ID: "test.binhi.web", BINHI_APPLE_DEVELOPMENT_TEAM_ID: "TEAM123456",
    BINHI_APPLE_DEVELOPMENT_KEY_ID: "KEY1234567", BINHI_APPLE_DEVELOPMENT_PRIVATE_KEY: appleKey };
}
export function claimsFor(provider: SocialProvider, nonce: string, extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { iss: ISSUERS[provider], sub: `${provider}-subject`, aud: provider === "google" ? "synthetic-google" : "test.binhi.web",
    iat: now, exp: now + 300, nonce, email: `${provider}@example.invalid`, email_verified: true, ...extra };
}
export class SyntheticIssuer {
  tokens = new Map<string, string>();
  exchanges: URLSearchParams[] = [];
  requests: string[] = [];
  revocations: URLSearchParams[] = [];
  revokeFails = false;
  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    this.requests.push(url);
    if (url === "https://appleid.apple.com/auth/revoke") {
      this.revocations.push(new URLSearchParams(String(init?.body)));
      return new Response(null, { status: this.revokeFails ? 503 : 200 });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs" || url === "https://appleid.apple.com/auth/keys") return Response.json({ keys: [jwk] });
    if (url !== "https://oauth2.googleapis.com/token" && url !== "https://appleid.apple.com/auth/token") throw new Error("Unexpected issuer endpoint");
    const body = new URLSearchParams(String(init?.body)); this.exchanges.push(body);
    const token = this.tokens.get(body.get("code")!);
    return token ? Response.json({ id_token: token, ...(url.includes("appleid") ? { refresh_token: `synthetic-refresh-${body.get("code")}` } : {}) }) : Response.json({ error: "invalid_grant" }, { status: 400 });
  };
  authorize(url: string, extra: Record<string, unknown> = {}) {
    const params = new URL(url).searchParams;
    const provider: SocialProvider = new URL(url).hostname === "appleid.apple.com" ? "apple" : "google";
    const code = `synthetic-${this.tokens.size}`;
    this.tokens.set(code, syntheticToken(claimsFor(provider, params.get("nonce")!, extra)));
    return { code, state: params.get("state")! };
  }
}
