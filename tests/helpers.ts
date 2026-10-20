import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp, type BinhiApp } from "../src/server/app.js";
import { loadConfig } from "../src/server/config.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { createDb } from "../src/server/db/client.js";

export const TEST_DATABASE_URL = process.env.BINHI_TEST_DATABASE_URL ?? "postgres://binhi:binhi_dev_pw@127.0.0.1:5432/binhi_test";

/** Build a fresh app against the test database with every BINHI table emptied. */
export interface TestAppOptions {
  /** Empty every BINHI table first (default true). Pass false for a second app sharing the database. */
  truncate?: boolean;
  /** Replace the fetch used for publication verification (default: inject into this app). */
  fetchImpl?: typeof fetch;
}

export async function testApp(overrides: Record<string, string> = {}, options: TestAppOptions = {}): Promise<BinhiApp> {
  await runMigrations(TEST_DATABASE_URL);
  const { db, sql } = createDb(TEST_DATABASE_URL);
  if (options.truncate !== false) await sql`truncate binhi_users, binhi_sessions, binhi_sites, binhi_site_revisions, binhi_op_batches, binhi_assets, binhi_asset_blobs, binhi_publications, binhi_published_pages, binhi_form_submissions, binhi_audit_log cascade`;
  const config = loadConfig({
    BINHI_DATABASE_URL: TEST_DATABASE_URL,
    BINHI_SESSION_SECRET: "test-secret-test-secret-test-secret",
    BINHI_PUBLIC_URL: "https://binhi.test",
    NODE_ENV: "test",
    ...overrides,
  });
  let appRef: FastifyInstance | null = null;
  // Publication verification "fetches" the public URL through the app itself.
  const fetchImpl: typeof fetch = options.fetchImpl ?? (async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const res = await appRef!.inject({ method: "GET", url: url.pathname + url.search, headers: (init?.headers as Record<string, string>) ?? {} });
    return new Response(res.body, { status: res.statusCode, headers: res.headers as Record<string, string> });
  });
  const built = await buildApp({ config, db, sql, fetchImpl });
  appRef = built.app;
  const close = built.close;
  built.close = async () => {
    await close();
    await sql.end();
  };
  return built;
}

export interface Session {
  cookie: string;
  user: { id: string; email: string; displayName: string };
}

export async function signup(app: FastifyInstance, email = `u${Math.random().toString(36).slice(2)}@example.com`, password = "correct horse battery"): Promise<Session> {
  const res = await app.inject({ method: "POST", url: "/api/auth/signup", headers: { "x-binhi-request": "editor" }, payload: { email, password, displayName: "Tester" } });
  if (res.statusCode !== 200) throw new Error(`signup failed: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === "binhi_session")!;
  return { cookie: `${cookie.name}=${cookie.value}`, user: res.json().user };
}

export function api(app: FastifyInstance, session: Session | null) {
  const headers = { "x-binhi-request": "editor", ...(session ? { cookie: session.cookie } : {}) };
  return {
    get: (url: string, extra: { headers?: Record<string, string> } = {}) => app.inject({ method: "GET", url, headers: { ...headers, ...(extra.headers ?? {}) } }),
    post: (url: string, payload?: unknown, extra: { headers?: Record<string, string> } = {}) => app.inject({ method: "POST", url, headers: { ...headers, ...(extra.headers ?? {}) }, payload: payload as InjectOptions["payload"] }),
    patch: (url: string, payload?: unknown) => app.inject({ method: "PATCH", url, headers, payload: payload as InjectOptions["payload"] }),
    del: (url: string, payload?: unknown) => app.inject({ method: "DELETE", url, headers, payload: payload as InjectOptions["payload"] }),
  };
}

export async function createSite(app: FastifyInstance, session: Session, templateId = "blank", name = "Test Site") {
  const res = await api(app, session).post("/api/sites", { name, templateId });
  if (res.statusCode !== 200) throw new Error(`create site failed: ${res.body}`);
  return res.json().site as { id: string; slug: string; revision: number; document: import("../src/core/index.js").SiteDocument };
}

/** A valid 2x2 PNG. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNAgAAEoIBf+mKRSyAAAAAElFTkSuQmCC",
  "base64",
);

export function batch(baseRevision: number, ops: unknown[], batchId = `b-${Math.random().toString(36).slice(2, 12)}`) {
  return { baseRevision, ops, batchId };
}
