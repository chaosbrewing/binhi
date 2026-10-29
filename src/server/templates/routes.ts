import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthUser } from "../auth/session.js";
import { RateLimiter } from "../security/rateLimit.js";
import { tooMany } from "../security/errors.js";
import { COLOR_FAMILIES, EDITOR_IDS, FORMAT_IDS, ORIENTATIONS, PersonalMetaPatch, STYLE_IDS } from "../../core/templates/library/index.js";
import type { TemplateLibraryService } from "./library.js";

interface Deps {
  requireUser: (req: FastifyRequest) => AuthUser;
  library: TemplateLibraryService;
  /** CSP for rendered sites (shared with site previews). */
  previewCsp: (allowRuntime: boolean) => string;
}

const TemplateRef = z.object({ id: z.string().min(1).max(80) });

const Query = z.object({
  q: z.string().trim().max(100).optional(),
  format: z.enum(["all", ...FORMAT_IDS]).optional(),
  category: z.string().max(60).optional(),
  subcategory: z.string().max(100).optional(),
  style: z.enum(STYLE_IDS).optional(),
  orientation: z.enum(ORIENTATIONS).optional(),
  color: z.enum(COLOR_FAMILIES).optional(),
  editor: z.enum(EDITOR_IDS).optional(),
  sort: z.enum(["relevance", "latest", "name"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

/** Template Library API. Everything requires a signed-in user; nothing here mutates a shared template. */
export function registerTemplateLibraryRoutes(app: FastifyInstance, deps: Deps): void {
  const useLimiter = new RateLimiter(30, 10 * 60 * 1000);
  const writeLimiter = new RateLimiter(120, 10 * 60 * 1000);

  app.get("/api/template-library/taxonomy", async (req, reply) => {
    deps.requireUser(req);
    reply.header("Cache-Control", "private, max-age=60");
    return deps.library.taxonomy();
  });

  app.get("/api/template-library/templates", async (req) => {
    const user = deps.requireUser(req);
    return deps.library.list(Query.parse(req.query ?? {}), user.id);
  });

  // Favorites, recents and collections are resolved by id so the browser never downloads the whole catalog.
  app.post("/api/template-library/cards", async (req) => {
    const user = deps.requireUser(req);
    const { ids } = z.object({ ids: z.array(z.string().min(1).max(80)).max(48) }).parse(req.body ?? {});
    return { items: deps.library.byIds(ids, user.id) };
  });

  // Favorites are explicit, owner-only and removed with the account. Recents and browsing are never sent here.
  app.get("/api/template-library/favorites", async (req, reply) => {
    const user = deps.requireUser(req);
    reply.header("Cache-Control", "private, no-store");
    return { ids: await deps.library.favorites(user.id) };
  });
  app.put("/api/template-library/favorites/:id", async (req) => {
    const user = deps.requireUser(req);
    if (!writeLimiter.check(`tpl-write:${user.id}`)) throw tooMany("You are changing favorites very quickly. Please wait a moment.");
    const { id } = TemplateRef.parse(req.params);
    await deps.library.addFavorite(user.id, id);
    return { ok: true };
  });
  app.delete("/api/template-library/favorites/:id", async (req) => {
    const user = deps.requireUser(req);
    if (!writeLimiter.check(`tpl-write:${user.id}`)) throw tooMany("You are changing favorites very quickly. Please wait a moment.");
    const { id } = TemplateRef.parse(req.params);
    await deps.library.removeFavorite(user.id, id);
    return { ok: true };
  });

  app.get("/api/template-library/templates/:id", async (req) => {
    const user = deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    return { template: deps.library.detail(id, user.id) };
  });

  // The document and which layers follow a Brand Kit, so the browser can preview a kit with the same rules the server applies.
  app.get("/api/template-library/templates/:id/document", async (req) => {
    deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    const { document, brand } = deps.library.designContent(id);
    return { document, brand };
  });

  // Website previews are rendered with placeholder content in a script-free, sandboxed response.
  const previewHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    const slug = (req.params as { slug?: string }).slug;
    const { kit } = z.object({ kit: z.string().min(1).max(40).optional() }).parse(req.query ?? {});
    const html = await deps.library.sitePreviewHtml(id, slug, { ownerId: user.id, kitId: kit });
    reply.header("Content-Security-Policy", `${deps.previewCsp(false)}; sandbox`);
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/api/template-library/templates/:id/preview/", previewHandler);
  app.get("/api/template-library/templates/:id/preview/:slug/", previewHandler);

  // The caller's own saved design templates (ownership is checked by the project service).
  // Description, category, tags and archive state of the caller's own saved template.
  app.patch("/api/template-library/mine/:projectId", async (req) => {
    const user = deps.requireUser(req);
    if (!writeLimiter.check(`tpl-write:${user.id}`)) throw tooMany("You are making changes very quickly. Please wait a moment.");
    const { projectId } = z.object({ projectId: z.string().min(1).max(40) }).parse(req.params);
    const patch = PersonalMetaPatch.parse(req.body ?? {});
    return { project: await deps.library.updatePersonal(user.id, projectId, patch, req.ip) };
  });

  app.post("/api/template-library/mine/:projectId/use", async (req) => {
    const user = deps.requireUser(req);
    if (!useLimiter.check(`tpl-use:${user.id}`)) throw tooMany("You are creating projects very quickly. Please wait a moment.");
    const { projectId } = z.object({ projectId: z.string().min(1).max(40) }).parse(req.params);
    const body = z.object({ name: z.string().trim().min(1).max(80).optional() }).parse(req.body ?? {});
    return { result: await deps.library.usePersonal(user.id, projectId, body, req.ip) };
  });

  app.post("/api/template-library/templates/:id/use", async (req) => {
    const user = deps.requireUser(req);
    if (!useLimiter.check(`tpl-use:${user.id}`)) throw tooMany("You are creating projects very quickly. Please wait a moment.");
    const { id } = TemplateRef.parse(req.params);
    const body = z.object({ name: z.string().trim().min(1).max(80).optional(), brandKitId: z.string().min(1).max(40).optional() }).parse(req.body ?? {});
    return { result: await deps.library.use(user.id, id, body, req.ip) };
  });
}
