export const SITE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Slugs that would collide with BINHI's own routes or confuse visitors. */
export const RESERVED_SLUGS = new Set([
  "api", "s", "media", "assets", "static", "admin", "login", "signin", "signup", "logout", "settings", "binhi", "origin", "www", "mail", "ftp", "app", "editor", "sites", "new", "_binhi", "preview", "help", "support", "status", "terms", "privacy", "robots.txt", "sitemap.xml", "favicon.ico",
]);

export function slugifySiteName(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `site-${s}`.replace(/-+$/g, "").padEnd(3, "x");
}

export function isValidSiteSlug(slug: string): boolean {
  return SITE_SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}
