import type { LinkTarget, SiteDocument } from "../schema/document.js";

export interface LinkContext {
  doc: SiteDocument;
  /** Base href of the site, with trailing slash: "/s/my-site/" or "/". */
  baseHref: string;
  /** Map of asset ids to public URLs for file links. */
  assetUrl?: (assetId: string) => string | undefined;
}

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

/** Returns a safe absolute/relative URL or null if the value is not allowed. */
export function sanitizeUrl(raw: string | undefined | null, opts: { allowRelative?: boolean } = {}): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("#")) return /^#[A-Za-z][A-Za-z0-9_-]*$/.test(value) ? value : null;
  if (value.startsWith("/") && !value.startsWith("//")) return opts.allowRelative === false ? null : value;
  try {
    const u = new URL(value);
    if (!SAFE_PROTOCOLS.includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Image/media sources: BINHI-served media, or https. Never data:/javascript:. */
export function sanitizeMediaSrc(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.startsWith("/media/") && /^\/media\/[A-Za-z0-9_-]+(\/[A-Za-z0-9._-]+)?$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function pageHref(ctx: LinkContext, pageId: string, anchor?: string): string | null {
  const page = ctx.doc.pages.find((p) => p.id === pageId);
  if (!page) return null;
  const path = page.isHome ? ctx.baseHref : `${ctx.baseHref}${page.slug}/`;
  return anchor && /^[A-Za-z][A-Za-z0-9_-]*$/.test(anchor) ? `${path}#${anchor}` : path;
}

export interface ResolvedLink {
  href: string;
  newTab: boolean;
  rel?: string;
  download?: boolean;
}

export function resolveLink(ctx: LinkContext, target: LinkTarget | undefined): ResolvedLink | null {
  if (!target || target.kind === "none") return null;
  switch (target.kind) {
    case "page": {
      const href = pageHref(ctx, target.pageId, target.anchor);
      return href ? { href, newTab: false } : null;
    }
    case "url": {
      const href = sanitizeUrl(target.href);
      if (!href) return null;
      return { href, newTab: target.newTab, rel: "noopener noreferrer" };
    }
    case "email": {
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(target.address)) return null;
      const q = target.subject ? `?subject=${encodeURIComponent(target.subject)}` : "";
      return { href: `mailto:${target.address}${q}`, newTab: false };
    }
    case "phone": {
      const num = target.number.replace(/[^\d+().\- ]/g, "").trim();
      return num ? { href: `tel:${num.replace(/[^\d+]/g, "")}`, newTab: false } : null;
    }
    case "anchor":
      return /^[A-Za-z][A-Za-z0-9_-]*$/.test(target.anchor) ? { href: `#${target.anchor}`, newTab: false } : null;
    case "file": {
      const href = ctx.assetUrl?.(target.assetId);
      return href ? { href, newTab: !target.download, download: target.download } : null;
    }
  }
}

export function linkAttrs(link: ResolvedLink | null): string {
  if (!link) return "";
  let s = ` href="${link.href.replace(/"/g, "&quot;")}"`;
  if (link.newTab) s += ` target="_blank"`;
  const rel = [link.rel, link.newTab ? "noopener noreferrer" : ""].filter(Boolean).join(" ").trim();
  if (rel) s += ` rel="${Array.from(new Set(rel.split(" "))).join(" ")}"`;
  if (link.download) s += " download";
  return s;
}
