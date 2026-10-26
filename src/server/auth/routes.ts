import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import type { AuthUser, SessionService } from "./session.js";
import { GRANT_COOKIE, bindingCookie, callbackPath, SocialAuth } from "./social.js";
import { OAuthFailure } from "./oidc.js";
import { unauthorized, tooMany } from "../security/errors.js";
import { RateLimiter } from "../security/rateLimit.js";
import type { SocialProvider } from "../../core/auth.js";
const Provider = z.enum(["google", "apple"]);
const Intent = z.enum(["login", "link", "reauth"]);
export function setGrantCookie(reply: FastifyReply, token: string, config: Config) {
  reply.setCookie(GRANT_COOKIE, token, { path: "/api/auth", httpOnly: true, sameSite: "strict", secure: config.env === "production" || config.publicUrl.startsWith("https:"), maxAge: 300 });
}
export function registerSocialRoutes(app: FastifyInstance, social: SocialAuth, sessions: SessionService, config: Config,
  requireUser: (req: FastifyRequest) => AuthUser, setSession: (reply: FastifyReply, token: string) => void) {
  const limiter = new RateLimiter(20, 10 * 60 * 1000);
  app.get("/api/auth/providers", async () => ({ providers: social.providers() }));
  app.get("/api/auth/methods", async req => social.methods(requireUser(req).id, req.authSessionId!, req.cookies[GRANT_COOKIE]));
  app.post("/api/auth/reauth", async (req, reply) => {
    if (!limiter.check(req.ip)) throw tooMany();
    const user = requireUser(req);
    if (!limiter.check(`reauth:${user.id}`)) throw tooMany();
    const body = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    const token = await social.reauthenticate(user.id, req.authSessionId!, body.password);
    await social.record(user.id, "auth.password.reauthenticated");
    setGrantCookie(reply, token, config);
    return { ok: true };
  });
  app.post("/api/auth/:provider/start", async (req, reply) => {
    if (!limiter.check(req.ip)) throw tooMany();
    const provider = Provider.parse((req.params as { provider: string }).provider);
    const { intent } = z.object({ intent: Intent }).parse(req.body);
    const result = await social.start(provider, intent, req.user?.id ?? null, req.authSessionId, req.cookies[GRANT_COOKIE]);
    reply.header("Cache-Control", "no-store");
    reply.setCookie(bindingCookie(provider), result.binding, {
      path: callbackPath(provider), maxAge: 600, httpOnly: true,
      sameSite: provider === "apple" ? "none" : "lax",
      secure: provider === "apple" || config.env === "production" || config.publicUrl.startsWith("https:"),
    });
    return { redirectUrl: result.redirectUrl };
  });
  app.delete("/api/auth/identities/:id", async req => {
    const user = requireUser(req);
    const id = z.string().regex(/^aid_[a-z0-9]+$/).max(80).parse((req.params as { id: string }).id);
    await social.unlink(user.id, req.authSessionId!, id, req.cookies[GRANT_COOKIE]);
    return { ok: true };
  });
  // This parser is registered for these auth routes only, not for arbitrary API endpoints.
  app.register(async callbacks => {
    callbacks.removeContentTypeParser("application/x-www-form-urlencoded");
    callbacks.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 16384 }, (_req, body, done) => {
      try {
        const params = new URLSearchParams(String(body)), result: Record<string, string> = Object.create(null);
        for (const [key, value] of params) {
          if (Object.hasOwn(result, key)) throw new Error("Duplicate callback parameter");
          result[key] = value;
        }
        done(null, result);
      } catch { done(Object.assign(new Error("Invalid callback form"), { statusCode: 400 })); }
    });
    const callback = (provider: SocialProvider) => async (req: FastifyRequest, reply: FastifyReply) => {
      reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
      reply.clearCookie(bindingCookie(provider), { path: callbackPath(provider), secure: provider === "apple" || config.publicUrl.startsWith("https:"), sameSite: provider === "apple" ? "none" : "lax" });
      try {
        const data = z.object({ state: z.string().max(100), code: z.string().max(4096).optional(), error: z.string().max(200).optional() }).parse(provider === "apple" ? req.body : req.query);
        const result = await social.callback(provider, data.state, req.cookies[bindingCookie(provider)] ?? "", data.code, Boolean(data.error));
        await social.record(result.userId, `auth.oauth.${result.intent}`, provider);
        if (result.intent === "reauth") setGrantCookie(reply, await social.grant(result.userId, result.sessionId!), config);
        else {
          const session = await sessions.create(result.userId, req.headers["user-agent"]);
          setSession(reply, session.token);
        }
        return reply.code(303).redirect(result.intent === "login" ? "/" : "/account");
      } catch (e) {
        const error = e instanceof OAuthFailure ? e.code : "invalid_response";
        // Fixed-origin, fixed-path redirect; no provider text, auth code, token, returnTo or arbitrary URL reflected.
        return reply.code(303).redirect(`${e instanceof OAuthFailure ? e.returnTo : "/signin"}?oauth_error=${error}`);
      }
    };
    // Disable request logging on callbacks so authorization codes/Apple form data never enter access logs.
    callbacks.get(callbackPath("google"), { logLevel: "silent", bodyLimit: 16384 }, callback("google"));
    callbacks.post(callbackPath("apple"), { logLevel: "silent", bodyLimit: 16384, config: { appleOAuthCallback: true } }, callback("apple"));
  });
}
