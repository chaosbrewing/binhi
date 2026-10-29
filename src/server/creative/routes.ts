import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthUser } from "../auth/session.js";
import type { SiteService } from "../sites/service.js";
import type { AssetService } from "../assets/service.js";
import { RateLimiter } from "../security/rateLimit.js";
import { badRequest, tooMany } from "../security/errors.js";
import { ProjectKind } from "../../core/creative/index.js";
import type { LibraryService } from "./library.js";
import type { ProjectService } from "./projects.js";
import type { BrandKitService } from "./brandKits.js";

interface Deps {
  requireUser: (req: FastifyRequest) => AuthUser;
  sites: SiteService;
  assets: AssetService;
  library: LibraryService;
  projects: ProjectService;
  brandKits: BrandKitService;
}

const Id = z.string().min(1).max(40);

/** Creative studio API: private asset library, projects (photo/design/templates) and brand kits. */
export function registerCreativeRoutes(app: FastifyInstance, deps: Deps): void {
  const uploadLimiter = new RateLimiter(60, 10 * 60 * 1000);

  /* --------------------------------------------------------------- library */
  app.get("/api/library", async (req) => {
    const user = deps.requireUser(req);
    return { assets: await deps.library.list(user.id) };
  });

  app.post("/api/library", async (req) => {
    const user = deps.requireUser(req);
    if (!uploadLimiter.check(`library:${user.id}`)) throw tooMany("Too many uploads. Please wait a moment.");
    if (!Buffer.isBuffer(req.body)) throw badRequest("Send the image bytes as the request body");
    const filename = decodeURIComponent(String(req.headers["x-binhi-filename"] ?? "upload")).slice(0, 120);
    const alt = decodeURIComponent(String(req.headers["x-binhi-alt"] ?? ""));
    const tags = decodeURIComponent(String(req.headers["x-binhi-tags"] ?? ""));
    const origin = req.headers["x-binhi-origin"] === "photo-original" ? "photo-original" : "upload";
    const asset = await deps.library.upload(user.id, { filename, data: req.body, alt, tags, origin }, req.ip);
    return { asset };
  });

  app.post("/api/library/batch", async (req) => {
    const user = deps.requireUser(req);
    const body = z.object({ action: z.literal("delete"), assetIds: z.array(Id).min(1).max(200), force: z.boolean().optional() }).parse(req.body ?? {});
    return { result: await deps.library.deleteMany(user.id, body.assetIds, { force: body.force }, req.ip) };
  });

  app.get("/api/library/:assetId", async (req) => {
    const user = deps.requireUser(req);
    const { assetId } = z.object({ assetId: Id }).parse(req.params);
    return { asset: await deps.library.get(user.id, assetId) };
  });

  // Private bytes: owner only, never cached by shared caches.
  app.get("/api/library/:assetId/file", async (req, reply) => {
    const user = deps.requireUser(req);
    const { assetId } = z.object({ assetId: Id }).parse(req.params);
    const file = await deps.library.read(user.id, assetId);
    reply.header("Cache-Control", "private, max-age=3600");
    reply.header("ETag", `"${file.sha256}"`);
    reply.header("Content-Disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`);
    if (req.headers["if-none-match"] === `"${file.sha256}"`) return reply.status(304).send();
    return reply.type(file.mimeType).send(file.data);
  });

  app.patch("/api/library/:assetId", async (req) => {
    const user = deps.requireUser(req);
    const { assetId } = z.object({ assetId: Id }).parse(req.params);
    const body = z.object({ alt: z.string().max(200).optional(), tags: z.string().max(120).optional(), filename: z.string().min(1).max(120).optional() }).parse(req.body ?? {});
    return { asset: await deps.library.update(user.id, assetId, body) };
  });

  app.delete("/api/library/:assetId", async (req) => {
    const user = deps.requireUser(req);
    const { assetId } = z.object({ assetId: Id }).parse(req.params);
    const { force } = z.object({ force: z.enum(["true", "false"]).optional() }).parse(req.query ?? {});
    await deps.library.delete(user.id, assetId, { force: force === "true" }, req.ip);
    return { ok: true };
  });

  app.post("/api/library/:assetId/copy-to-site", async (req) => {
    const user = deps.requireUser(req);
    const { assetId } = z.object({ assetId: Id }).parse(req.params);
    const { siteId } = z.object({ siteId: Id }).parse(req.body);
    await deps.sites.getOwned(user.id, siteId);
    const asset = await deps.library.copyToSite(user.id, assetId, siteId, deps.assets, req.ip);
    return { asset };
  });

  /* -------------------------------------------------------------- projects */
  app.get("/api/projects", async (req) => {
    const user = deps.requireUser(req);
    const { kind } = z.object({ kind: ProjectKind.optional() }).parse(req.query ?? {});
    return { projects: await deps.projects.list(user.id, kind) };
  });

  app.post("/api/projects", async (req) => {
    const user = deps.requireUser(req);
    const body = z.object({ kind: ProjectKind, name: z.string().min(1).max(80), document: z.unknown() }).parse(req.body);
    return { project: await deps.projects.create(user.id, { kind: body.kind, name: body.name, document: body.document ?? null }, req.ip) };
  });

  app.get("/api/projects/:projectId", async (req) => {
    const user = deps.requireUser(req);
    const { projectId } = z.object({ projectId: Id }).parse(req.params);
    return { project: await deps.projects.get(user.id, projectId) };
  });

  app.patch("/api/projects/:projectId", async (req) => {
    const user = deps.requireUser(req);
    const { projectId } = z.object({ projectId: Id }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(80).optional(), document: z.unknown().optional(), baseRevision: z.number().int().min(0) }).parse(req.body);
    return { project: await deps.projects.update(user.id, projectId, body, req.ip) };
  });

  app.post("/api/projects/:projectId/duplicate", async (req) => {
    const user = deps.requireUser(req);
    const { projectId } = z.object({ projectId: Id }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(80).optional(), kind: ProjectKind.optional() }).parse(req.body ?? {});
    return { project: await deps.projects.duplicate(user.id, projectId, body, req.ip) };
  });

  app.delete("/api/projects/:projectId", async (req) => {
    const user = deps.requireUser(req);
    const { projectId } = z.object({ projectId: Id }).parse(req.params);
    await deps.projects.softDelete(user.id, projectId, req.ip);
    return { ok: true };
  });

  /* ------------------------------------------------------------ brand kits */
  app.get("/api/brand-kits", async (req) => {
    const user = deps.requireUser(req);
    return { kits: await deps.brandKits.list(user.id) };
  });

  app.post("/api/brand-kits", async (req) => {
    const user = deps.requireUser(req);
    const body = z.object({ name: z.string().min(1).max(80), document: z.unknown() }).parse(req.body);
    return { kit: await deps.brandKits.create(user.id, { name: body.name, document: body.document ?? null }, req.ip) };
  });

  app.get("/api/brand-kits/:kitId", async (req) => {
    const user = deps.requireUser(req);
    const { kitId } = z.object({ kitId: Id }).parse(req.params);
    return { kit: await deps.brandKits.get(user.id, kitId) };
  });

  app.patch("/api/brand-kits/:kitId", async (req) => {
    const user = deps.requireUser(req);
    const { kitId } = z.object({ kitId: Id }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(80).optional(), document: z.unknown().optional() }).parse(req.body);
    return { kit: await deps.brandKits.update(user.id, kitId, body, req.ip) };
  });

  app.delete("/api/brand-kits/:kitId", async (req) => {
    const user = deps.requireUser(req);
    const { kitId } = z.object({ kitId: Id }).parse(req.params);
    await deps.brandKits.softDelete(user.id, kitId, req.ip);
    return { ok: true };
  });
}
