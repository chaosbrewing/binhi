import type { SiteDocument, Operation, ValidationReport } from "../core/index.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, url: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method,
      credentials: "same-origin",
      headers: { "x-binhi-request": "editor", ...(body !== undefined && !(body instanceof Blob || body instanceof ArrayBuffer) ? { "content-type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) },
      body: body === undefined ? undefined : body instanceof Blob || body instanceof ArrayBuffer ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "OFFLINE", "You appear to be offline. Changes are kept locally until the connection returns.");
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return json as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}
export interface PublicationSummary {
  id: string;
  siteId: string;
  revision: number;
  state: "pending" | "building" | "deploying" | "live" | "failed" | "unpublished" | "superseded";
  url: string | null;
  pageCount: number;
  error: string | null;
  createdAt: string;
  verifiedAt: string | null;
  isLive: boolean;
}
export interface SiteSummary {
  id: string;
  name: string;
  slug: string;
  templateId: string;
  revision: number;
  livePublicationId: string | null;
  createdAt: string;
  updatedAt: string;
  publication: PublicationSummary | null;
  liveUrl: string | null;
}
export interface SiteDetail extends SiteSummary {
  document: SiteDocument;
}
export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  swatch: [string, string, string];
}
export interface RevisionSummary {
  id: string;
  revision: number;
  kind: string;
  label: string | null;
  summary: string[];
  createdAt: string;
}
export interface AssetRecord {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
  url: string;
  createdAt: string;
}
export interface Submission {
  id: string;
  formNodeId: string;
  pagePath: string;
  fields: Record<string, string>;
  createdAt: string;
}

export const api = {
  me: () => request<{ user: User | null; signupEnabled: boolean }>("GET", "/api/auth/me"),
  signup: (email: string, password: string, displayName: string) => request<{ user: User }>("POST", "/api/auth/signup", { email, password, displayName }),
  login: (email: string, password: string) => request<{ user: User }>("POST", "/api/auth/login", { email, password }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),
  deleteAccount: (password: string) => request<{ ok: true }>("DELETE", "/api/auth/account", { password }),
  templates: () => request<{ templates: TemplateSummary[] }>("GET", "/api/templates"),
  sites: () => request<{ sites: SiteSummary[] }>("GET", "/api/sites"),
  createSite: (name: string, templateId: string) => request<{ site: SiteDetail }>("POST", "/api/sites", { name, templateId }),
  site: (id: string) => request<{ site: SiteDetail }>("GET", `/api/sites/${id}`),
  updateSite: (id: string, patch: { name?: string; slug?: string }) => request<{ site: SiteSummary }>("PATCH", `/api/sites/${id}`, patch),
  deleteSite: (id: string) => request<{ ok: true }>("DELETE", `/api/sites/${id}`),
  applyOps: (id: string, batch: { baseRevision: number; ops: Operation[]; batchId: string }) =>
    request<{ revision: number; createdIds: string[]; replayed: boolean; document?: SiteDocument }>("POST", `/api/sites/${id}/ops`, batch),
  revisions: (id: string) => request<{ revisions: RevisionSummary[] }>("GET", `/api/sites/${id}/revisions`),
  revision: (id: string, rev: number) => request<{ revision: number; document: SiteDocument }>("GET", `/api/sites/${id}/revisions/${rev}`),
  restore: (id: string, rev: number, baseRevision: number) => request<{ revision: number; document: SiteDocument }>("POST", `/api/sites/${id}/revisions/${rev}/restore`, { baseRevision }),
  assets: (id: string) => request<{ assets: AssetRecord[] }>("GET", `/api/sites/${id}/assets`),
  upload: (id: string, file: File, alt = "", folder = "") =>
    request<{ asset: AssetRecord }>("POST", `/api/sites/${id}/assets`, file, {
      headers: { "content-type": file.type || "application/octet-stream", "x-binhi-filename": encodeURIComponent(file.name), "x-binhi-alt": encodeURIComponent(alt), "x-binhi-folder": encodeURIComponent(folder) },
    }),
  updateAsset: (id: string, assetId: string, patch: { alt?: string; folder?: string }) => request<{ asset: AssetRecord }>("PATCH", `/api/sites/${id}/assets/${assetId}`, patch),
  deleteAsset: (id: string, assetId: string) => request<{ ok: true }>("DELETE", `/api/sites/${id}/assets/${assetId}`),
  validate: (id: string) => request<{ report: ValidationReport }>("GET", `/api/sites/${id}/validate`),
  publish: (id: string) => request<{ publication: PublicationSummary; warnings: ValidationReport["warnings"] }>("POST", `/api/sites/${id}/publish`),
  unpublish: (id: string) => request<{ publication: PublicationSummary | null }>("POST", `/api/sites/${id}/unpublish`),
  publications: (id: string) => request<{ publications: PublicationSummary[] }>("GET", `/api/sites/${id}/publications`),
  rollback: (id: string, publicationId: string) => request<{ publication: PublicationSummary }>("POST", `/api/sites/${id}/publications/${publicationId}/rollback`),
  submissions: (id: string) => request<{ submissions: Submission[] }>("GET", `/api/sites/${id}/submissions`),
  deleteSubmission: (id: string, subId: string) => request<{ ok: true }>("DELETE", `/api/sites/${id}/submissions/${subId}`),
};
