import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import type { SocialProvider } from "../../core/auth.js";

export const ISSUERS = { google: "https://accounts.google.com", apple: "https://appleid.apple.com" } as const;
const ENDPOINTS = {
  google: { authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", jwks: "https://www.googleapis.com/oauth2/v3/certs" },
  apple: { authorize: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token", jwks: "https://appleid.apple.com/auth/keys" },
} as const;
export interface ProviderConfig {
  provider: SocialProvider; clientId: string; callback: string; clientSecret?: string;
  teamId?: string; keyId?: string; privateKey?: KeyObject;
}
export type OAuthConfig = Partial<Record<SocialProvider, ProviderConfig>>;
export class OAuthFailure extends Error {
  returnTo: "/signin" | "/account" = "/signin";
  constructor(public readonly code: string) { super("Social authentication could not be completed"); }
}
export const randomToken = () => randomBytes(32).toString("base64url");
export const sha = (s: string) => createHash("sha256").update(s).digest("base64url");

/** No credential values enter a Config error, route response, database or log. */
export function loadOAuthConfig(env: NodeJS.ProcessEnv, origin: string, mode: string): OAuthConfig {
  const config: OAuthConfig = {};
  for (const provider of ["google", "apple"] as const) {
    const runtime = mode === "production" ? "production" : "development";
    const flag = `BINHI_${provider.toUpperCase()}_ENABLED`, prefix = `BINHI_${provider.toUpperCase()}_${runtime.toUpperCase()}_`;
    if (!["true", undefined, "false"].includes(env[flag])) throw new Error(`${flag} must be true or false`);
    if (env[flag] !== "true") continue;
    if (provider === "apple" && env.BINHI_APPLE_ELIGIBILITY_CONFIRMED !== "true") {
      throw new Error("BINHI_APPLE_ELIGIBILITY_CONFIRMED is required after owner verification of the eligible Apple app association");
    }
    if (env.BINHI_OAUTH_ENVIRONMENT !== runtime) {
      throw new Error("BINHI_OAUTH_ENVIRONMENT must explicitly match the runtime environment");
    }
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(provider === "google" && mode !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("OAuth requires a trusted HTTPS BINHI_PUBLIC_URL (Google local development may use HTTP loopback)");
    }
    const required = provider === "google" ? ["CLIENT_ID", "CLIENT_SECRET"] : ["CLIENT_ID", "TEAM_ID", "KEY_ID", "PRIVATE_KEY"];
    for (const key of required) if (!env[`${prefix}${key}`]?.trim()) throw new Error(`${prefix}${key} is required when enabled`);
    const c: ProviderConfig = { provider, clientId: env[`${prefix}CLIENT_ID`]!, callback: `${url.origin}/api/auth/${provider}/callback` };
    if (provider === "google") c.clientSecret = env[`${prefix}CLIENT_SECRET`];
    else {
      c.teamId = env[`${prefix}TEAM_ID`]; c.keyId = env[`${prefix}KEY_ID`];
      try {
        c.privateKey = createPrivateKey(env[`${prefix}PRIVATE_KEY`]!.replace(/\\n/g, "\n"));
        if (c.privateKey.asymmetricKeyType !== "ec" || c.privateKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error();
      } catch { throw new Error(`${prefix}PRIVATE_KEY must be a valid P-256 private key`); }
      if (![c.teamId, c.keyId].every(v => /^[A-Z0-9]{10}$/.test(v!))) throw new Error("Apple Team ID and Key ID must be ten uppercase alphanumeric characters");
    }
    config[provider] = c;
  }
  return config;
}
export function appleClientSecret(c: ProviderConfig, now = Math.floor(Date.now() / 1000)): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: c.keyId })).toString("base64url");
  // Short-lived JWTs avoid storing a six-month Apple client secret. Key rotation is owner-controlled.
  const body = Buffer.from(JSON.stringify({ iss: c.teamId, sub: c.clientId, aud: ISSUERS.apple, iat: now, exp: now + 300 })).toString("base64url");
  return `${header}.${body}.${sign("sha256", Buffer.from(`${header}.${body}`), { key: c.privateKey!, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

async function jsonResponse(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok || Number(res.headers.get("content-length") ?? 0) > 65536) throw new OAuthFailure("provider_unavailable");
  const reader = res.body?.getReader();
  if (!reader) throw new OAuthFailure("provider_unavailable");
  let data = "", size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new OAuthFailure("provider_unavailable"); }
    data += decoder.decode(next.value, { stream: true });
  }
  try {
    const value: unknown = JSON.parse(data + decoder.decode());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new OAuthFailure("provider_unavailable"); }
}

/** Fixed issuer endpoints, bounded responses/cache and a strict RS256-only ID-token profile. */
export class OidcClient {
  private cache = new Map<SocialProvider, { at: number; keys: Map<string, KeyObject> }>();
  constructor(private readonly transport: typeof fetch = fetch) {}

  authorize(c: ProviderConfig, state: string, nonce: string, verifier: string): string {
    const url = new URL(ENDPOINTS[c.provider].authorize);
    Object.entries({ client_id: c.clientId, redirect_uri: c.callback, response_type: "code", scope: c.provider === "google" ? "openid email profile" : "name email", state, nonce }).forEach(([k, v]) => url.searchParams.set(k, v));
    if (c.provider === "apple") url.searchParams.set("response_mode", "form_post");
    else {
      url.searchParams.set("code_challenge", sha(verifier)); url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  }

  async exchange(c: ProviderConfig, code: string, verifier: string | null): Promise<{ idToken: string; refreshToken: string | null }> {
    if (!code || code.length > 4096) throw new OAuthFailure("invalid_response");
    const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: c.clientId, redirect_uri: c.callback,
      client_secret: c.provider === "apple" ? appleClientSecret(c) : c.clientSecret! });
    if (c.provider === "google") {
      if (!verifier) throw new OAuthFailure("invalid_response");
      body.set("code_verifier", verifier);
    }
    try {
      const tokens = await jsonResponse(await this.transport(ENDPOINTS[c.provider].token, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString(),
      }));
      if (typeof tokens.id_token !== "string") throw new OAuthFailure("invalid_response");
      const refreshToken = typeof tokens.refresh_token === "string" && tokens.refresh_token.length > 0 && tokens.refresh_token.length <= 4096 ? tokens.refresh_token : null;
      if (c.provider === "apple" && !refreshToken) throw new OAuthFailure("invalid_response");
      return { idToken: tokens.id_token, refreshToken: c.provider === "apple" ? refreshToken : null };
    } catch (e) { if (e instanceof OAuthFailure) throw e; throw new OAuthFailure("provider_unavailable"); }
  }
  async revokeApple(c: ProviderConfig, refreshToken: string): Promise<void> {
    try {
      const res = await this.transport("https://appleid.apple.com/auth/revoke", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: c.clientId, client_secret: appleClientSecret(c), token: refreshToken, token_type_hint: "refresh_token" }).toString(),
      });
      await res.body?.cancel();
      if (!res.ok) throw new Error();
    } catch { throw new OAuthFailure("provider_unavailable"); }
  }

  private async keys(provider: SocialProvider, kid: string): Promise<KeyObject> {
    let entry = this.cache.get(provider);
    if (!entry || Date.now() - entry.at > 300000 || (!entry.keys.has(kid) && Date.now() - entry.at > 10000)) {
      try {
        const jwks = await jsonResponse(await this.transport(ENDPOINTS[provider].jwks, { redirect: "error", signal: AbortSignal.timeout(10000) }));
        if (!Array.isArray(jwks.keys) || jwks.keys.length > 20) throw new Error();
        const keys = new Map<string, KeyObject>();
        for (const jwk of jwks.keys) {
          if (!jwk || jwk.kty !== "RSA" || typeof jwk.kid !== "string" || jwk.kid.length > 200 ||
            (jwk.use && jwk.use !== "sig") || (jwk.alg && jwk.alg !== "RS256") ||
            (jwk.key_ops && (!Array.isArray(jwk.key_ops) || !jwk.key_ops.includes("verify")))) continue;
          const key = createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" });
          if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 || keys.has(jwk.kid)) throw new Error();
          keys.set(jwk.kid, key);
        }
        entry = { at: Date.now(), keys }; this.cache.set(provider, entry);
      } catch { throw new OAuthFailure("provider_unavailable"); }
    }
    const key = entry.keys.get(kid);
    if (!key) throw new OAuthFailure("invalid_token");
    return key;
  }

  async validate(c: ProviderConfig, token: string, nonceHash: string): Promise<{ issuer: string; subject: string; email: string | null; name: string | null }> {
    if (token.length > 16384) throw new OAuthFailure("invalid_token");
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new OAuthFailure("invalid_token");
    try {
      const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
      const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
      if (!header || header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 200 ||
        (header.typ !== undefined && header.typ !== "JWT") ||
        header.crit !== undefined || header.b64 !== undefined || header.jku !== undefined || header.x5u !== undefined) throw new Error();
      const key = await this.keys(c.provider, header.kid);
      if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2]!, "base64url"))) throw new Error();
      const now = Math.floor(Date.now() / 1000);
      const issuers = c.provider === "google" ? [ISSUERS.google, "accounts.google.com"] : [ISSUERS.apple];
      if (!issuers.includes(claims.iss) || claims.aud !== c.clientId || (claims.azp !== undefined && claims.azp !== c.clientId) ||
        typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= now ||
        typeof claims.iat !== "number" || !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
        (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now)) ||
        typeof claims.sub !== "string" || !claims.sub.length || claims.sub.length > 255 ||
        typeof claims.nonce !== "string" || sha(claims.nonce) !== nonceHash) throw new Error();
      const verified = claims.email_verified === true || (c.provider === "apple" && claims.email_verified === "true");
      const email = verified && typeof claims.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) && claims.email.length <= 254 ? claims.email.toLowerCase() : null;
      return { issuer: ISSUERS[c.provider], subject: claims.sub, email,
        name: typeof claims.name === "string" ? claims.name.trim().slice(0, 80) || null : null };
    } catch (e) { if (e instanceof OAuthFailure && e.code === "provider_unavailable") throw e; throw new OAuthFailure("invalid_token"); }
  }
}
