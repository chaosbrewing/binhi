import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { formSubmissions } from "../db/schema.js";
import type { SiteService } from "../sites/service.js";
import type { PublishService } from "./service.js";
import type { AuthUser } from "../auth/session.js";
import { RateLimiter } from "../security/rateLimit.js";
import { tooMany } from "../security/errors.js";

interface Deps {
  requireUser: (req: FastifyRequest) => AuthUser;
  sites: SiteService;
  publish: PublishService;
  db: Db;
}

const SiteId = z.object({ siteId: z.string().min(1).max(40) });

export function registerPublishRoutes(app: FastifyInstance, deps: Deps): void {
  const publishLimiter = new RateLimiter(20, 10 * 60 * 1000);

  app.get("/api/sites/:siteId/validate", async (req) => {
    const user = deps.requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    return { report: await deps.publish.validate(user.id, siteId) };
  });

  app.post("/api/sites/:siteId/publish", async (req) => {
    const user = deps.requireUser(req);
    if (!publishLimiter.check(`publish:${user.id}`)) throw tooMany("You're publishing very often. Please wait a few minutes.");
    const { siteId } = SiteId.parse(req.params);
    const result = await deps.publish.publish(user.id, siteId, req.ip);
    return result;
  });

  app.post("/api/sites/:siteId/unpublish", async (req) => {
    const user = deps.requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    return { publication: await deps.publish.unpublish(user.id, siteId, req.ip) };
  });

  app.get("/api/sites/:siteId/publications", async (req) => {
    const user = deps.requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    return { publications: await deps.publish.history(user.id, siteId) };
  });

  app.post("/api/sites/:siteId/publications/:publicationId/rollback", async (req) => {
    const user = deps.requireUser(req);
    const { siteId, publicationId } = SiteId.extend({ publicationId: z.string().min(1).max(40) }).parse(req.params);
    return { publication: await deps.publish.rollback(user.id, siteId, publicationId, req.ip) };
  });

  app.get("/api/sites/:siteId/submissions", async (req) => {
    const user = deps.requireUser(req);
    const { siteId } = SiteId.parse(req.params);
    await deps.sites.getOwned(user.id, siteId);
    const rows = await deps.db.select().from(formSubmissions).where(eq(formSubmissions.siteId, siteId)).orderBy(desc(formSubmissions.createdAt)).limit(200);
    return { submissions: rows.map((r) => ({ id: r.id, formNodeId: r.formNodeId, pagePath: r.pagePath, fields: r.fields, createdAt: r.createdAt.toISOString(), readAt: r.readAt?.toISOString() ?? null })) };
  });

  app.delete("/api/sites/:siteId/submissions/:submissionId", async (req) => {
    const user = deps.requireUser(req);
    const { siteId, submissionId } = SiteId.extend({ submissionId: z.string().min(1).max(40) }).parse(req.params);
    await deps.sites.getOwned(user.id, siteId);
    await deps.db.delete(formSubmissions).where(and(eq(formSubmissions.siteId, siteId), eq(formSubmissions.id, submissionId)));
    return { ok: true };
  });
}
