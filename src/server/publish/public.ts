import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { formSubmissions } from "../db/schema.js";
import { PublishService, VERIFY_HEADER } from "./service.js";
import { RateLimiter } from "../security/rateLimit.js";
import { previewCsp } from "../app.js";
import { findNode, esc, type SiteDocument } from "../../core/index.js";
import { newId } from "../../core/ids.js";
import { SITE_SLUG_PATTERN } from "../sites/slugs.js";

interface Deps {
  publish: PublishService;
  db: Db;
  publicUrl: string;
  runtimePath: string;
}

const FormParams = z.object({ slug: z.string().regex(SITE_SLUG_PATTERN), formId: z.string().regex(/^[a-z]+_[a-z0-9]+$/) });

function notPublishedPage(status: 404 | 410): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${status === 404 ? "Page not found" : "Site not available"}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#f6f8f6;color:#1a202c;display:grid;place-items:center;min-height:100vh}main{text-align:center;padding:32px;max-width:480px}h1{font-size:24px;margin:0 0 8px}p{color:#5f6b66;margin:0}a{color:#2f855a}</style></head><body><main><h1>${status === 404 ? "This page doesn't exist" : "This site isn't published right now"}</h1><p>${status === 404 ? "Check the address, or go back to the home page." : "The owner may be working on it. Please try again later."}</p></main></body></html>`;
}

/** Routes for visitors of published sites: /s/<slug>/... and form submissions. */
export function registerPublicRoutes(app: FastifyInstance, deps: Deps): void {
  const runtime = readFileSync(deps.runtimePath, "utf8");
  const formLimiter = new RateLimiter(10, 10 * 60 * 1000);

  app.get("/s/_binhi/runtime.js", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.type("application/javascript; charset=utf-8").send(runtime);
  });

  const serve = async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    if (!SITE_SLUG_PATTERN.test(slug)) return reply.status(404).type("text/html; charset=utf-8").send(notPublishedPage(404));
    const rawRest = ((req.params as { "*"?: string })["*"] ?? "").replace(/^\/+/, "");
    if (rawRest.includes("..") || rawRest.length > 200) return reply.status(404).type("text/html; charset=utf-8").send(notPublishedPage(404));
    // Canonical page paths end with a slash; redirect "/s/slug/about" → "/s/slug/about/".
    const url = new URL(req.url, "http://x");
    if (rawRest && !rawRest.endsWith("/")) return reply.redirect(`/s/${slug}/${rawRest}/${url.search}`, 301);
    const verifyId = typeof req.headers[VERIFY_HEADER] === "string" ? (req.headers[VERIFY_HEADER] as string) : undefined;
    const resolved = await deps.publish.resolvePublic(slug, verifyId);
    reply.header("Content-Security-Policy", previewCsp(true));
    reply.header("Cache-Control", verifyId ? "no-store" : "public, max-age=60, stale-while-revalidate=300");
    if (!resolved) return reply.status(410).type("text/html; charset=utf-8").send(notPublishedPage(410));
    const path = `/s/${slug}/${rawRest}`;
    const html = await deps.publish.readPage(resolved.publicationId, path);
    if (!html) return reply.status(404).type("text/html; charset=utf-8").send(notPublishedPage(404));
    reply.header("X-Binhi-Publication", resolved.publicationId);
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/s/:slug", (req, reply) => reply.redirect(`/s/${(req.params as { slug: string }).slug}/`, 301));
  app.get("/s/:slug/", serve);
  app.get("/s/:slug/*", serve);

  app.post("/s/:slug/__form/:formId", async (req, reply) => {
    const { slug, formId } = FormParams.parse(req.params);
    const resolved = await deps.publish.resolvePublic(slug);
    if (!resolved) return reply.status(410).type("text/html; charset=utf-8").send(notPublishedPage(410));
    if (!formLimiter.check(`form:${resolved.siteId}:${req.ip}`)) return reply.status(429).type("text/plain").send("Too many submissions. Please try again later.");
    const body = (typeof req.body === "object" && req.body ? req.body : {}) as Record<string, string>;
    if (body.website) return reply.redirect(backTo(req, slug, formId), 303); // honeypot: pretend success
    const doc = await deps.publish.publishedDocument(resolved.revisionId);
    const form = doc ? findNode(doc as SiteDocument, formId) : null;
    if (!form || form.node.type !== "form") return reply.status(404).type("text/plain").send("Form not found");
    const fields = form.node.props.fields as { id: string; type: string; label: string; required: boolean; options?: string[] }[];
    const values: Record<string, string> = {};
    const errors: string[] = [];
    for (const f of fields) {
      const raw = (body[f.id] ?? "").toString().trim().slice(0, 5000);
      if (f.required && !raw) errors.push(`${f.label} is required`);
      if (raw && f.type === "email" && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(raw)) errors.push(`${f.label} must be a valid email`);
      if (raw && f.type === "select" && f.options && !f.options.includes(raw)) errors.push(`${f.label} has an unexpected value`);
      values[f.label] = raw;
    }
    if (errors.length) {
      return reply.status(400).type("text/html; charset=utf-8").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Please check the form</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 24px;color:#1a202c}a{color:#2f855a}</style></head><body><h1>Please check the form</h1><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul><p><a href="javascript:history.back()">Go back</a></p></body></html>`);
    }
    await deps.db.insert(formSubmissions).values({ id: newId("sub"), siteId: resolved.siteId, formNodeId: formId, pagePath: refererPath(req, slug), fields: values });
    return reply.redirect(backTo(req, slug, formId), 303);
  });
}

function refererPath(req: FastifyRequest, slug: string): string {
  const ref = req.headers.referer;
  if (!ref) return `/s/${slug}/`;
  try {
    const u = new URL(ref);
    return u.pathname.startsWith(`/s/${slug}/`) ? u.pathname : `/s/${slug}/`;
  } catch {
    return `/s/${slug}/`;
  }
}

function backTo(req: FastifyRequest, slug: string, formId: string): string {
  return `${refererPath(req, slug)}#${formId}-sent`;
}
