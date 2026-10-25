import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, isNull } from "drizzle-orm";
import { z, ZodError } from "zod";
import type { Config } from "./config.js";
import { createDb, type Db, type Sql } from "./db/client.js";
import { sites, users } from "./db/schema.js";
import { SessionService, SESSION_COOKIE, SESSION_TTL_MS, type AuthUser } from "./auth/session.js";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from "./auth/password.js";
import { RateLimiter } from "./security/rateLimit.js";
import { HttpError, badRequest, forbidden, notFound, tooMany, unauthorized } from "./security/errors.js";
import { SiteService } from "./sites/service.js";
import { AssetService } from "./assets/service.js";
import { DiskStorage, PostgresBlobStorage, type ObjectStorage } from "./assets/storage.js";
import { OperationBatch, TEMPLATES, renderPage, type SiteDocument } from "../core/index.js";
import { newId } from "../core/ids.js";
import { resolveIconShapeSync } from "../core/icons/shapes-all.js";
import { audit } from "./audit.js";
import { PublishService } from "./publish/service.js";
import { LocalPublishingAdapter } from "./publish/localAdapter.js";
import { registerPublicRoutes } from "./publish/public.js";
import { registerPublishRoutes } from "./publish/routes.js";
import { LibraryService } from "./creative/library.js";
import { ProjectService } from "./creative/projects.js";
import { BrandKitService } from "./creative/brandKits.js";
import { registerCreativeRoutes } from "./creative/routes.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionToken: string | undefined;
  }
}

export interface AppDeps {
  config: Config;
  db?: Db;
  sql?: Sql;
  storage?: ObjectStorage;
  /** Override how published pages are fetched for verification (tests inject the app itself). */
  fetchImpl?: typeof fetch;
}

export interface BinhiApp {
  app: FastifyInstance;
  db: Db;
  sql: Sql;
  services: { sites: SiteService; assets: AssetService; sessions: SessionService; publish: PublishService; library: LibraryService; projects: ProjectService; brandKits: BrandKitService };
  close(): Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(deps: AppDeps): Promise<BinhiApp> {
  const { config } = deps;
  const created = deps.db ? null : createDb(config.databaseUrl);
  const db = deps.db ?? created!.db;
  const sql = deps.sql ?? created!.sql;
  const storage = deps.storage ?? (config.mediaStorage === "disk" ? new DiskStorage(config.mediaDir!) : new PostgresBlobStorage(db));

  const sessionsSvc = new SessionService(db, config.sessionSecret);
  const siteSvc = new SiteService(db);
  const assetSvc = new AssetService(db, storage, config.maxUploadBytes);
  const publishSvc = new PublishService(db, new LocalPublishingAdapter(db), { publicUrl: config.publicUrl, verifyBaseUrl: config.verifyBaseUrl, fetchImpl: deps.fetchImpl ?? fetch });
  const librarySvc = new LibraryService(db, storage, config.maxUploadBytes);
  const projectSvc = new ProjectService(db, librarySvc);
  const brandKitSvc = new BrandKitService(db, librarySvc);

  const app = Fastify({ logger: config.env !== "test", bodyLimit: 6 * 1024 * 1024, trustProxy: true, disableRequestLogging: true });
  await app.register(cookie);

  // Raw uploads: the browser sends the file body directly with its metadata in headers.
  app.addContentTypeParser(["image/png", "image/jpeg", "image/webp", "image/gif", "application/octet-stream"], { parseAs: "buffer", bodyLimit: config.maxUploadBytes + 1024 }, (_req, body, done) => done(null, body));
  // Published-site forms post as application/x-www-form-urlencoded.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 64 * 1024 }, (_req, body, done) => {
    try {
      const params = new URLSearchParams(body as string);
      const out: Record<string, string> = {};
      params.forEach((v, k) => {
        if (k.length <= 80 && Object.keys(out).length < 60) out[k] = v.slice(0, 5000);
      });
      done(null, out);
    } catch (e) {
      done(e as Error);
    }
  });

  const authLimiter = new RateLimiter(20, 10 * 60 * 1000);
  const apiLimiter = new RateLimiter(600, 60 * 1000);
  const uploadLimiter = new RateLimiter(60, 10 * 60 * 1000);

  app.decorateRequest("user", null);
  app.decorateRequest("sessionToken", undefined);

  app.addHook("onRequest", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    req.sessionToken = req.cookies[SESSION_COOKIE];
    if (req.url.startsWith("/api/")) {
      if (!apiLimiter.check(`api:${req.ip}`)) throw tooMany();
      // CSRF: every state-changing API call must carry the editor header; browsers
      // never add custom headers to cross-site form posts or simple requests.
      if (req.method !== "GET" && req.method !== "HEAD" && req.headers["x-binhi-request"] !== "editor") {
        throw forbidden("Missing request header");
      }
      const resolved = await sessionsSvc.resolve(req.sessionToken);
      req.user = resolved?.user ?? null;
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", details: err.issues.slice(0, 10) } });
    }
    const fe = err as { statusCode?: number; code?: string; message?: string };
    if (fe.statusCode === 413 || fe.code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.status(413).send({ error: { code: "TOO_LARGE", message: "That file or request is too large" } });
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) return reply.status(fe.statusCode).send({ error: { code: fe.code ?? "BAD_REQUEST", message: fe.message ?? "Bad request" } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: "INTERNAL", message: "Something went wrong on our side. Your work is saved up to the last confirmed revision." } });
  });

  const requireUser = (req: FastifyRequest): AuthUser => {
    if (!req.user) throw unauthorized();
    return req.user;
  };

  const setSessionCookie = (reply: FastifyReply, token: string) => {
    reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.env === "production", path: "/", maxAge: Math.floor(SESSION_TTL_MS / 1000) });
  };

  /* ---------------------------------------------------------------- health */
  app.get("/api/health", async () => {
    await sql`select 1`;
    return { ok: true, service: "binhi", version: "0.1.0", env: config.env, signupEnabled: config.allowSignup, iconLibrary: config.iconLibrary };
  });

  /* ------------------------------------------------------------------ auth */
  const Credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(PASSWORD_MAX) });

  app.post("/api/auth/signup", async (req, reply) => {
    if (!config.allowSignup) throw forbidden("New accounts are not being accepted on this BINHI");
    if (!authLimiter.check(`auth:${req.ip}`)) throw tooMany("Too many attempts. Try again in a few minutes.");
    const body = Credentials.extend({ displayName: z.string().trim().min(1, "Tell us what to call you").max(80) }).parse(req.body);
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (existing[0]) throw new HttpError(409, "EMAIL_TAKEN", "An account with that email already exists. Sign in instead.");
    const id = newId("usr");
    await db.insert(users).values({ id, email: body.email, passwordHash: await hashPassword(body.password), displayName: body.displayName });
    const session = await sessionsSvc.create(id, req.headers["user-agent"]);
    setSessionCookie(reply, session.token);
    await audit(db, { actorId: id, action: "account.created", ip: req.ip });
    return { user: { id, email: body.email, displayName: body.displayName } };
  });

  app.post("/api/auth/login", async (req, reply) => {
    if (!authLimiter.check(`auth:${req.ip}`)) throw tooMany("Too many attempts. Try again in a few minutes.");
    const body = Credentials.parse(req.body);
    const rows = await db.select().from(users).where(and(eq(users.email, body.email), isNull(users.deletedAt))).limit(1);
    const user = rows[0];
    const ok = user ? await verifyPassword(body.password, user.passwordHash) : await verifyPassword(body.password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    if (!user || !ok) throw unauthorized("That email and password don't match");
    const session = await sessionsSvc.create(user.id, req.headers["user-agent"]);
    setSessionCookie(reply, session.token);
    return { user: { id: user.id, email: user.email, displayName: user.displayName } };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    await sessionsSvc.revoke(req.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    return { user: req.user, signupEnabled: config.allowSignup, features: { iconLibrary: config.iconLibrary } };
  });

  app.delete("/api/auth/account", async (req, reply) => {
    const user = requireUser(req);
    const body = z.object({ password: z.string().min(1) }).parse(req.body);
    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!rows[0] || !(await verifyPassword(body.password, rows[0].passwordHash))) throw unauthorized("That password is not correct");
    const owned = await siteSvc.list(user.id);
    for (const s of owned) {
      await publishSvc.unpublish(user.id, s.id, req.ip).catch(() => undefined);
      await siteSvc.softDelete(user.id, s.id, req.ip);
    }
    for (const p of await projectSvc.list(user.id)) await projectSvc.softDelete(user.id, p.id, req.ip);
    for (const k of await brandKitSvc.list(user.id)) await brandKitSvc.softDelete(user.id, k.id, req.ip);
    for (const a of await librarySvc.list(user.id)) await librarySvc.delete(user.id, a.id, { force: true }, req.ip);
    await db.update(users).set({ deletedAt: new Date(), email: `deleted-${user.id}@deleted.invalid`, passwordHash: "deleted" }).where(eq(users.id, user.id));
    await sessionsSvc.revokeAllForUser(user.id);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    await audit(db, { actorId: user.id, action: "account.deleted", ip: req.ip });
    return { ok: true };
  });

  /* ------------------------------------------------------------- templates */
  app.get("/api/templates", async () => ({
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, swatch: t.swatch })),
  }));

  /* ----------------------------------------------------------------- sites */
  const SiteId = z.object({ siteId: z.string().min(1).max(40) });

  app.get("/api/sites", async (req) => {
    const user = requireUser(req);
    const list = await siteSvc.list(user.id);
    const publicationsBySite = await publishSvc.latestForSites(list.map((s) => s.id));
    return { sites: list.map((s) => ({ ...s, publication: publicationsBySite.get(s.id) ?? null, liveUrl: s.livePublicationId ? publishSvc.siteUrl(s.slug) : null })) };
  });

  app.post("/api/sites", async (req) => {
    const user = requireUser(req);
    const body = z.object({ name: z.string().min(1).max(80), templateId: z.string().min(1).max(40) }).parse(req.body);
    const site = await siteSvc.create(user.id, body, req.ip);
    return { site };
  });

  app.get("/api/sites/:siteId", async (req) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    const site = await siteSvc.get(user.id, siteId);
    const publication = await publishSvc.latest(siteId);
    return { site: { ...site, publication, liveUrl: site.livePublicationId ? publishSvc.siteUrl(site.slug) : null } };
  });

  app.patch("/api/sites/:siteId", async (req) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    const body = z.object({ name: z.string().min(1).max(80).optional(), slug: z.string().min(3).max(40).optional() }).parse(req.body);
    const site = await siteSvc.updateMeta(user.id, siteId, body, req.ip);
    return { site };
  });

  app.delete("/api/sites/:siteId", async (req) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    await publishSvc.unpublish(user.id, siteId, req.ip).catch((e) => {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
    });
    await siteSvc.softDelete(user.id, siteId, req.ip);
    return { ok: true };
  });

  app.post("/api/sites/:siteId/ops", async (req, reply) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    const batch = OperationBatch.parse(req.body);
    const result = await siteSvc.applyBatch(user.id, siteId, batch, req.ip);
    if (result.replayed) reply.header("X-Binhi-Replayed", "1");
    return { revision: result.revision, createdIds: result.createdIds, replayed: result.replayed, ...(result.replayed ? { document: result.document } : {}) };
  });

  app.get("/api/sites/:siteId/revisions", async (req) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    return { revisions: await siteSvc.listRevisions(user.id, siteId) };
  });

  app.get("/api/sites/:siteId/revisions/:revision", async (req) => {
    const user = requireUser(req);
    const { siteId, revision } = SiteId.extend({ revision: z.coerce.number().int().min(0) }).parse(req.params);
    return { revision, document: await siteSvc.getRevisionDocument(user.id, siteId, revision) };
  });

  app.post("/api/sites/:siteId/revisions/:revision/restore", async (req) => {
    const user = requireUser(req);
    const { siteId, revision } = SiteId.extend({ revision: z.coerce.number().int().min(0) }).parse(req.params);
    const body = z.object({ baseRevision: z.number().int().min(0) }).parse(req.body);
    const result = await siteSvc.restoreRevision(user.id, siteId, revision, body.baseRevision, req.ip);
    return { revision: result.revision, document: result.document };
  });

  /* --------------------------------------------------------------- preview */
  const previewHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    const slug = (req.params as { slug?: string }).slug;
    const site = await siteSvc.get(user.id, siteId);
    const doc = site.document as SiteDocument;
    const page = slug ? doc.pages.find((p) => p.slug === slug) : doc.pages.find((p) => p.isHome);
    if (!page) throw notFound("Page not found");
    const html = renderPage(doc, page.id, { mode: "preview", baseHref: `/api/sites/${siteId}/preview/`, formAction: () => "#", iconShape: resolveIconShapeSync });
    reply.header("Content-Security-Policy", previewCsp(false));
    reply.header("Cache-Control", "no-store");
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/api/sites/:siteId/preview/", previewHandler);
  app.get("/api/sites/:siteId/preview", (req, reply) => reply.redirect(`/api/sites/${(req.params as { siteId: string }).siteId}/preview/`));
  app.get("/api/sites/:siteId/preview/:slug/", previewHandler);
  app.get("/api/sites/:siteId/preview/:slug", (req, reply) => {
    const p = req.params as { siteId: string; slug: string };
    return reply.redirect(`/api/sites/${p.siteId}/preview/${p.slug}/`);
  });

  /* ---------------------------------------------------------------- assets */
  app.get("/api/sites/:siteId/assets", async (req) => {
    const user = requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    await siteSvc.getOwned(user.id, siteId);
    return { assets: await assetSvc.list(siteId) };
  });

  app.post("/api/sites/:siteId/assets", async (req) => {
    const user = requireUser(req);
    if (!uploadLimiter.check(`upload:${user.id}`)) throw tooMany("Too many uploads. Please wait a moment.");
    const { siteId } = SiteId.parse(req.params);
    await siteSvc.getOwned(user.id, siteId);
    if (!Buffer.isBuffer(req.body)) throw badRequest("Send the image bytes as the request body");
    const filename = decodeURIComponent(String(req.headers["x-binhi-filename"] ?? "upload")).slice(0, 120);
    const alt = decodeURIComponent(String(req.headers["x-binhi-alt"] ?? ""));
    const folder = decodeURIComponent(String(req.headers["x-binhi-folder"] ?? ""));
    const asset = await assetSvc.upload(user.id, siteId, { filename, data: req.body, alt, folder }, req.ip);
    return { asset };
  });

  app.patch("/api/sites/:siteId/assets/:assetId", async (req) => {
    const user = requireUser(req);
    const { siteId, assetId } = SiteId.extend({ assetId: z.string().min(1).max(40) }).parse(req.params);
    await siteSvc.getOwned(user.id, siteId);
    const body = z.object({ alt: z.string().max(200).optional(), folder: z.string().max(60).optional() }).parse(req.body);
    return { asset: await assetSvc.update(siteId, assetId, body) };
  });

  app.delete("/api/sites/:siteId/assets/:assetId", async (req) => {
    const user = requireUser(req);
    const { siteId, assetId } = SiteId.extend({ assetId: z.string().min(1).max(40) }).parse(req.params);
    await siteSvc.getOwned(user.id, siteId);
    await assetSvc.delete(user.id, siteId, assetId, req.ip);
    return { ok: true };
  });

  // Public media: unguessable ids, immutable caching.
  const mediaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const { assetId } = z.object({ assetId: z.string().regex(/^[a-z]+_[a-z0-9]+$/) }).parse(req.params);
    const found = await assetSvc.readPublic(assetId);
    if (!found) return reply.status(404).send("Not found");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header("Content-Disposition", `inline; filename="${found.filename.replace(/"/g, "")}"`);
    return reply.type(found.mimeType).send(found.data);
  };
  app.get("/media/:assetId", mediaHandler);
  app.get("/media/:assetId/:filename", mediaHandler);

  /* --------------------------------------------------------- publishing (M4) */
  registerPublishRoutes(app, { requireUser, sites: siteSvc, publish: publishSvc, db });
  registerPublicRoutes(app, { publish: publishSvc, db, publicUrl: config.publicUrl, runtimePath: path.join(here, "..", "..", "public", "binhi-runtime.js") });

  /* ------------------------------------------------- creative studio (Phase 1) */
  registerCreativeRoutes(app, { requireUser, sites: siteSvc, assets: assetSvc, library: librarySvc, projects: projectSvc, brandKits: brandKitSvc });

  /* ------------------------------------------------------------- client SPA */
  // Built client: dist/client next to dist/server, or (when running from source) ../../dist/client.
  const clientDir = [path.resolve(here, "..", "client"), path.resolve(here, "..", "..", "dist", "client")].find((d) => existsSync(path.join(d, "index.html")));
  if (config.serveBuiltClient && clientDir) {
    await app.register(fastifyStatic, { root: clientDir, prefix: "/", wildcard: false, index: false, decorateReply: true });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/s/") || req.url.startsWith("/media/")) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
      }
      reply.header("Cache-Control", "no-cache");
      return reply.sendFile("index.html");
    });
  }

  return {
    app,
    db,
    sql,
    services: { sites: siteSvc, assets: assetSvc, sessions: sessionsSvc, publish: publishSvc, library: librarySvc, projects: projectSvc, brandKits: brandKitSvc },
    async close() {
      await app.close();
      if (created) await created.sql.end();
    },
  };
}

/** CSP for rendered sites: our inline stylesheet, images from anywhere over https, embeds only from known players. */
export function previewCsp(allowRuntime: boolean): string {
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com data:",
    "img-src 'self' https: data:",
    "media-src 'self' https:",
    `script-src ${allowRuntime ? "'self'" : "'none'"}`,
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}
