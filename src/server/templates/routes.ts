import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AuthUser } from "../auth/session.js";
import { RateLimiter } from "../security/rateLimit.js";
import { tooMany } from "../security/errors.js";
import { FORMAT_IDS, ORIENTATIONS, STYLE_IDS } from "../../core/templates/library/index.js";
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
  sort: z.enum(["relevance", "latest", "name"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

/** Template Library API. Everything requires a signed-in user; nothing here mutates a shared template. */
export function registerTemplateLibraryRoutes(app: FastifyInstance, deps: Deps): void {
  const useLimiter = new RateLimiter(30, 10 * 60 * 1000);

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

  app.get("/api/template-library/templates/:id", async (req) => {
    const user = deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    return { template: deps.library.detail(id, user.id) };
  });

  app.get("/api/template-library/templates/:id/document", async (req) => {
    deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    return { document: deps.library.designDocument(id) };
  });

  // Website previews are rendered with placeholder content in a script-free, sandboxed response.
  const previewHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    deps.requireUser(req);
    const { id } = TemplateRef.parse(req.params);
    const slug = (req.params as { slug?: string }).slug;
    const html = deps.library.sitePreviewHtml(id, slug);
    reply.header("Content-Security-Policy", `${deps.previewCsp(false)}; sandbox`);
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/api/template-library/templates/:id/preview/", previewHandler);
  app.get("/api/template-library/templates/:id/preview/:slug/", previewHandler);

  app.post("/api/template-library/templates/:id/use", async (req) => {
    const user = deps.requireUser(req);
    if (!useLimiter.check(`tpl-use:${user.id}`)) throw tooMany("You are creating projects very quickly. Please wait a moment.");
    const { id } = TemplateRef.parse(req.params);
    const body = z.object({ name: z.string().trim().min(1).max(80).optional() }).parse(req.body ?? {});
    return { result: await deps.library.use(user.id, id, body, req.ip) };
  });
}
