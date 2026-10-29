import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import type { AuthMethods, OAuthIntent, ProviderStatus, SocialProvider } from "../../core/auth.js";
import { newId } from "../../core/ids.js";
import type { Config } from "../config.js";
import { forbidden, HttpError, unauthorized } from "../security/errors.js";
import { verifyPassword } from "./password.js";
import { ISSUERS, OidcClient, OAuthFailure, randomToken, sha } from "./oidc.js";

type Transaction = {
  provider: SocialProvider; intent: OAuthIntent; nonce_hash: string; verifier_ciphertext: string | null;
  user_id: string | null; session_id: string | null;
};
export const GRANT_COOKIE = "binhi_reauth";
export const callbackPath = (p: SocialProvider) => `/api/auth/${p}/callback`;
export const bindingCookie = (p: SocialProvider) => `binhi_oauth_${p}`;

export class SocialAuth {
  readonly oidc: OidcClient;
  private readonly key: Buffer;
  constructor(private readonly sql: Sql, private readonly config: Config, fetchImpl?: typeof fetch) {
    this.oidc = new OidcClient(fetchImpl);
    this.key = Buffer.from(hkdfSync("sha256", config.sessionSecret, "binhi", "oauth-pkce-v1", 32));
  }
  hash(value: string): string { return createHmac("sha256", this.config.sessionSecret).update(`auth-v1:${value}`).digest("hex"); }
  private encrypt(value: string): string {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
  }
  private decrypt(value: string): string {
    const bytes = Buffer.from(value, "base64url"), decipher = createDecipheriv("aes-256-gcm", this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString();
  }
  providers(): ProviderStatus[] {
    return (["google", "apple"] as const).map(id => ({ id, label: id === "google" ? "Google" : "Apple",
      available: Boolean(this.config.oauth[id]), reason: this.config.oauth[id] ? null : "Provider setup is required" }));
  }
  async hasGrant(userId: string, sessionId: string, token: string | undefined): Promise<boolean> {
    if (!token || token.length > 200) return false;
    return (await this.sql`select 1 from binhi_auth_grants where token_hash=${this.hash(token)} and user_id=${userId} and session_id=${sessionId} and expires_at>now()`).length > 0;
  }
  async consumeGrant(userId: string, sessionId: string, token: string | undefined): Promise<void> {
    if (!token || token.length > 200) throw unauthorized("Verify your identity again before changing login methods");
    const rows = await this.sql`delete from binhi_auth_grants where token_hash=${this.hash(token)} and user_id=${userId} and session_id=${sessionId} and expires_at>now() returning token_hash`;
    if (!rows.length) throw unauthorized("Verify your identity again before changing login methods");
  }
  async grant(userId: string, sessionId: string): Promise<string> {
    const token = randomToken();
    await this.sql.begin(async sql => {
      await sql`delete from binhi_auth_grants where session_id=${sessionId} or expires_at<=now()`;
      await sql`insert into binhi_auth_grants(token_hash,user_id,session_id,expires_at) values(${this.hash(token)},${userId},${sessionId},now()+interval '5 minutes')`;
    });
    return token;
  }
  async reauthenticate(userId: string, sessionId: string, password: string): Promise<string> {
    const [user] = await this.sql`select password_hash,password_enabled from binhi_users where id=${userId} and deleted_at is null`;
    if (!user?.password_enabled || !(await verifyPassword(password, user.password_hash))) throw unauthorized("That password is not correct");
    return this.grant(userId, sessionId);
  }
  async methods(userId: string, sessionId: string, token?: string): Promise<AuthMethods> {
    const [user] = await this.sql`select password_enabled from binhi_users where id=${userId} and deleted_at is null`;
    const identities = await this.sql`select id,provider,email from binhi_auth_identities where user_id=${userId} order by provider`;
    return { hasPassword: Boolean(user?.password_enabled), reauthenticated: await this.hasGrant(userId, sessionId, token),
      identities: identities.map(i => ({ id: String(i.id), provider: i.provider as SocialProvider, email: i.email as string | null,
        canUnlink: Boolean(user?.password_enabled) || identities.some(other => other.id !== i.id && Boolean(this.config.oauth[other.provider as SocialProvider])) })), providers: this.providers() };
  }
  async start(provider: SocialProvider, intent: OAuthIntent, userId: string | null, sessionId: string | null, grant?: string) {
    const c = this.config.oauth[provider];
    if (!c) throw new HttpError(503, "PROVIDER_UNAVAILABLE", "This provider has not been configured");
    if (intent !== "login" && (!userId || !sessionId)) throw unauthorized();
    if (intent === "login" && userId) throw forbidden("Use account settings to link a provider");
    if (intent === "link") await this.consumeGrant(userId!, sessionId!, grant);
    if (intent === "reauth" && !(await this.sql`select 1 from binhi_auth_identities where user_id=${userId!} and provider=${provider}`).length) throw forbidden("Use an already-linked provider to verify your identity");
    const state = randomToken(), binding = randomToken(), nonce = randomToken(), verifier = randomToken();
    await this.sql.begin(async sql => {
      await sql`delete from binhi_oauth_transactions where expires_at<=now()`;
      await sql`delete from binhi_auth_grants where expires_at<=now()`;
      await sql`insert into binhi_oauth_transactions(state_hash,binding_hash,provider,intent,nonce_hash,verifier_ciphertext,user_id,session_id,expires_at)
        values(${this.hash(state)},${this.hash(binding)},${provider},${intent},${sha(nonce)},${provider === "google" ? this.encrypt(verifier) : null},${intent === "login" ? null : userId},${intent === "login" ? null : sessionId},now()+interval '10 minutes')`;
    });
    return { redirectUrl: this.oidc.authorize(c, state, nonce, verifier), binding };
  }
  async callback(provider: SocialProvider, state: string, binding: string, code?: string, cancelled?: boolean) {
    const c = this.config.oauth[provider];
    if (!c) throw new OAuthFailure("provider_unavailable");
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(binding)) throw new OAuthFailure("invalid_state");
    // Atomic consumption before network exchange. A callback, including a cancelled/invalid response, is single use.
    const rows = await this.sql<Transaction[]>`delete from binhi_oauth_transactions
      where state_hash=${this.hash(state)} and binding_hash=${this.hash(binding)} and provider=${provider} and expires_at>now() returning *`;
    const tx = rows[0];
    if (!tx) throw new OAuthFailure("invalid_state");
    try {
    if (cancelled) throw new OAuthFailure("cancelled");
    if (!code) throw new OAuthFailure("invalid_response");
    const issued = await this.oidc.exchange(c, code, tx.verifier_ciphertext ? this.decrypt(tx.verifier_ciphertext) : null);
    const claims = await this.oidc.validate(c, issued.idToken, tx.nonce_hash);
    const revocation = issued.refreshToken ? this.encrypt(issued.refreshToken) : null;
    return await this.sql.begin(async sql => {
      if (tx.intent !== "login") {
        // Main SameSite=Lax session cookie may be absent on Apple's cross-site form_post.
        // The browser-bound transaction carries the initiating session id, which must STILL be live.
        const active = await sql`select s.id from binhi_sessions s join binhi_users u on u.id=s.user_id
          where s.id=${tx.session_id} and s.user_id=${tx.user_id} and s.expires_at>now() and u.deleted_at is null for update of u`;
        if (!active.length) throw new OAuthFailure("reauth_required");
      }
      let [identity] = await sql`select i.id,i.user_id from binhi_auth_identities i join binhi_users u on u.id=i.user_id
        where i.issuer=${claims.issuer} and i.subject=${claims.subject} and u.deleted_at is null`;
      if (identity && revocation) await sql`update binhi_auth_identities set revocation_ciphertext=${revocation} where id=${identity.id}`;
      if (tx.intent === "reauth") {
        if (!identity || identity.user_id !== tx.user_id) throw new OAuthFailure("identity_conflict");
        return { userId: String(tx.user_id), sessionId: tx.session_id!, intent: tx.intent };
      }
      if (tx.intent === "link") {
        if (identity && identity.user_id !== tx.user_id) throw new OAuthFailure("identity_conflict");
        const existing = await sql`select subject from binhi_auth_identities where user_id=${tx.user_id} and issuer=${claims.issuer}`;
        if (existing.length && existing[0]!.subject !== claims.subject) throw new OAuthFailure("identity_conflict");
        if (!identity) await sql`insert into binhi_auth_identities(id,user_id,provider,issuer,subject,email,revocation_ciphertext)
          values(${newId("aid")},${tx.user_id},${provider},${claims.issuer},${claims.subject},${claims.email},${revocation})`;
        return { userId: String(tx.user_id), sessionId: tx.session_id!, intent: tx.intent };
      }
      if (identity) return { userId: String(identity.user_id), sessionId: null, intent: tx.intent };
      if (!this.config.allowSignup) throw new OAuthFailure("signup_disabled");
      if (!claims.email) throw new OAuthFailure("email_required");
      // Even a verified provider email is NOT permission to take over an existing BINHI account.
      if ((await sql`select id from binhi_users where email=${claims.email}`).length) throw new OAuthFailure("account_exists");
      const id = newId("usr");
      await sql`insert into binhi_users(id,email,password_hash,password_enabled,display_name)
        values(${id},${claims.email},'!oauth-only!',false,${claims.name ?? claims.email.split("@")[0]!.slice(0, 80)})`;
      await sql`insert into binhi_auth_identities(id,user_id,provider,issuer,subject,email,revocation_ciphertext)
        values(${newId("aid")},${id},${provider},${claims.issuer},${claims.subject},${claims.email},${revocation})`;
      return { userId: id, sessionId: null, intent: tx.intent };
    });
    } catch (e) {
      const failure = e instanceof OAuthFailure ? e : new OAuthFailure("invalid_response");
      failure.returnTo = tx.intent === "login" ? "/signin" : "/account";
      throw failure;
    }
  }
  async unlink(userId: string, sessionId: string, id: string, grant?: string): Promise<void> {
    await this.consumeGrant(userId, sessionId, grant);
    await this.sql.begin(async sql => {
      const [user] = await sql`select password_enabled from binhi_users where id=${userId} and deleted_at is null for update`;
      const methods = await sql`select id,provider,revocation_ciphertext from binhi_auth_identities where user_id=${userId}`;
      if (!methods.some(m => m.id === id)) throw new HttpError(404, "NOT_FOUND", "Login method not found");
      if (!user || (!user.password_enabled && !methods.some(m => m.id !== id && Boolean(this.config.oauth[m.provider as SocialProvider])))) throw forbidden("You cannot remove your last available login method");
      const removed = methods.find(m => m.id === id)!;
      if (removed.provider === "apple") await this.revokeApple(removed.revocation_ciphertext as string | null);
      await sql`delete from binhi_auth_identities where user_id=${userId} and id=${id}`;
      await sql`insert into binhi_audit_log(id,actor_id,action,details) values(${newId("aud")},${userId},'auth.identity.disconnected','{}'::jsonb)`;
    });
  }
  async removeIdentities(userId: string) {
    await this.sql`delete from binhi_auth_identities where user_id=${userId}`;
    await this.sql`delete from binhi_oauth_transactions where user_id=${userId}`;
    await this.sql`delete from binhi_auth_grants where user_id=${userId}`;
  }
  private async revokeApple(ciphertext: string | null) {
    const c = this.config.oauth.apple;
    if (!c || !ciphertext) throw new HttpError(503, "APPLE_UNAVAILABLE", "Apple authorization could not be revoked. Your account has not been removed; try again when Apple setup is available.");
    try { await this.oidc.revokeApple(c, this.decrypt(ciphertext)); }
    catch { throw new HttpError(503, "APPLE_UNAVAILABLE", "Apple authorization could not be revoked. Please try again."); }
  }
  async revokeForDeletion(userId: string) {
    const rows = await this.sql`select revocation_ciphertext from binhi_auth_identities where user_id=${userId} and provider='apple'`;
    for (const row of rows) await this.revokeApple(row.revocation_ciphertext as string | null);
  }
  async record(userId: string, action: string, provider?: SocialProvider) {
    await this.sql`insert into binhi_audit_log(id,actor_id,action,details)
      values(${newId("aud")},${userId},${action},${JSON.stringify(provider ? { provider } : {})}::jsonb)`;
  }
}
