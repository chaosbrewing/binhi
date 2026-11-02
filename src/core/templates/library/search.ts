/**
 * Template search and filtering. Pure, deterministic and dependency free: no
 * external model, no user activity, no popularity data. Ranking is a weighted
 * keyword match over the fields a person would actually look in; "latest" is
 * the real publication date. Facet counts are computed server-side so the UI
 * never has to download the whole catalog to show a filter.
 */
import { CATEGORIES, FORMAT_IDS, STYLE_IDS, getCategory, getSubcategory, type FormatId, type Orientation, type StyleId } from "./taxonomy.js";
import type { EditorId } from "./editors.js";
import type { TemplateManifest as Manifest } from "./schema.js";

export type TemplateSort = "relevance" | "latest" | "name";

export const COLOR_FAMILIES = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "neutral"] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export const COLOR_LABEL: Record<ColorFamily, string> = { red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", teal: "Teal", blue: "Blue", purple: "Purple", pink: "Pink", neutral: "Black, white and grey" };

/** The named family of a #rrggbb colour. Very dark, very light and unsaturated colours are "neutral". */
export function colorFamily(hex: string): ColorFamily {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "neutral";
  const [r, g, b] = [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.08 || l < 0.12 || l > 0.93) return "neutral";
  const sat = d / (1 - Math.abs(2 * l - 1));
  if (sat < 0.18) return "neutral";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 345 || h < 15) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 255) return "blue";
  if (h < 300) return "purple";
  return "pink";
}

/** The families people will notice in a template: its three most visible palette colours. */
export function templateColorFamilies(m: Manifest): Set<ColorFamily> {
  return new Set(m.palette.slice(0, 3).map(colorFamily));
}

export interface TemplateQuery {
  q?: string;
  format?: FormatId | "all";
  category?: string;
  subcategory?: string;
  style?: StyleId;
  orientation?: Orientation;
  editor?: EditorId;
  color?: ColorFamily;
  /** Collection id from the catalog; applied by the caller (see matchesCollection). */
  sort?: TemplateSort;
}

/** Common ways people name things. Expansion is one-way and applied to query tokens only. */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  ig: ["instagram"],
  insta: ["instagram"],
  fb: ["facebook"],
  yt: ["youtube"],
  li: ["linkedin"],
  tiktok: ["tiktok", "reels"],
  cv: ["resume", "curriculum"],
  resume: ["cv", "curriculum"],
  leaflet: ["flyer"],
  handbill: ["flyer"],
  brochure: ["flyer", "booklet"],
  ppt: ["presentation", "slides"],
  deck: ["presentation", "slides"],
  slides: ["presentation"],
  site: ["website"],
  web: ["website"],
  webpage: ["website", "landing"],
  homepage: ["website", "landing"],
  portfolio: ["portfolios"],
  biz: ["business"],
  card: ["cards"],
  thumbnail: ["thumbnails", "youtube"],
  story: ["stories"],
  pin: ["pins", "pinterest"],
  logo: ["logos", "brand"],
  invite: ["invitation", "invitations"],
  invitation: ["invite"],
  promo: ["promotion", "promotional", "sale"],
  sale: ["promotion", "discount"],
  menu: ["menus", "restaurant"],
  poster: ["posters"],
  banner: ["banners", "cover"],
  cover: ["covers", "banner"],
};

const STOP = new Set(["a", "an", "the", "for", "and", "of", "to", "my", "your", "template", "templates"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

/** Minimal plural folding so "posters" finds "poster" and the reverse. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

interface Doc {
  m: Manifest;
  name: Set<string>;
  keywords: Set<string>;
  tags: Set<string>;
  where: Set<string>;
  description: Set<string>;
  nameText: string;
}

function toSet(text: string): Set<string> {
  return new Set(tokenize(text).map(stem));
}

function buildDoc(m: Manifest): Doc {
  const cat = getCategory(m.primaryCategory);
  const sub = m.subcategory ? getSubcategory(m.subcategory) : undefined;
  const secondary = m.secondaryCategories.map((c) => getCategory(c)?.name ?? "").join(" ");
  return {
    m,
    name: toSet(m.name),
    keywords: toSet([...m.keywords, ...m.aliases].join(" ")),
    tags: toSet(m.tags.join(" ")),
    where: toSet(`${cat?.name ?? ""} ${sub?.name ?? ""} ${secondary} ${m.format} ${m.styles.join(" ")}`),
    description: toSet(m.description),
    nameText: m.name.toLowerCase(),
  };
}

function scoreToken(d: Doc, token: string, weight: number): number {
  let s = 0;
  if (d.name.has(token)) s += 30;
  if (d.keywords.has(token)) s += 20;
  if (d.tags.has(token)) s += 15;
  if (d.where.has(token)) s += 10;
  if (d.description.has(token)) s += 3;
  // Prefix matches help people who are still typing ("insta" -> "instagram").
  if (s === 0 && token.length >= 3) {
    const prefix = (set: Set<string>) => Array.from(set).some((w) => w.startsWith(token));
    if (prefix(d.name)) s += 12;
    else if (prefix(d.keywords) || prefix(d.tags) || prefix(d.where)) s += 6;
  }
  return s * weight;
}

/** Score for one query token: the literal token plus its aliases, taking the best. */
function tokenScore(d: Doc, raw: string): number {
  const token = stem(raw);
  let best = scoreToken(d, token, 1);
  for (const alias of SEARCH_ALIASES[raw] ?? []) best = Math.max(best, scoreToken(d, stem(alias), 0.4));
  return best;
}

export function matchesFilters(m: Manifest, q: TemplateQuery, skip?: "format" | "category" | "style"): boolean {
  if (skip !== "format" && q.format && q.format !== "all" && m.format !== q.format) return false;
  if (skip !== "category" && q.category && m.primaryCategory !== q.category && !m.secondaryCategories.includes(q.category)) return false;
  if (q.subcategory && m.subcategory !== q.subcategory) return false;
  if (skip !== "style" && q.style && !m.styles.includes(q.style)) return false;
  if (q.orientation && m.orientation !== q.orientation) return false;
  if (q.editor && m.editor !== q.editor) return false;
  if (q.color && !templateColorFamilies(m).has(q.color)) return false;
  return true;
}

function rank(items: readonly Manifest[], q: TemplateQuery): Manifest[] {
  const tokens = tokenize(q.q ?? "");
  const sort: TemplateSort = q.sort ?? (tokens.length ? "relevance" : "latest");
  let scored: { m: Manifest; score: number }[];
  if (tokens.length) {
    scored = [];
    for (const m of items) {
      const d = buildDoc(m);
      let total = 0;
      let ok = true;
      for (const t of tokens) {
        const s = tokenScore(d, t);
        if (s === 0) { ok = false; break; }
        total += s;
      }
      if (ok) scored.push({ m, score: total + (d.nameText.includes(tokens.join(" ")) ? 25 : 0) });
    }
  } else {
    scored = items.map((m) => ({ m, score: 0 }));
  }
  const byName = (a: Manifest, b: Manifest) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const byLatest = (a: Manifest, b: Manifest) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || byName(a, b);
  scored.sort((a, b) => {
    if (sort === "relevance" && b.score !== a.score) return b.score - a.score;
    return sort === "name" ? byName(a.m, b.m) : byLatest(a.m, b.m);
  });
  return scored.map((s) => s.m);
}

export interface Facets {
  formats: Record<string, number>;
  categories: Record<string, number>;
  styles: Record<string, number>;
}

export interface SearchResult {
  items: Manifest[];
  total: number;
  facets: Facets;
}

export function searchTemplates(all: readonly Manifest[], q: TemplateQuery): SearchResult {
  const textMatched = new Set(rank(all.filter((m) => matchesFilters(m, { ...q, format: "all", category: undefined, style: undefined })), { ...q }).map((m) => m.id + "@" + m.version));
  const inText = (m: Manifest) => textMatched.has(m.id + "@" + m.version);

  // Facet counts exclude their own filter so a chip shows what choosing it would give.
  const facets: Facets = { formats: {}, categories: {}, styles: {} };
  for (const f of FORMAT_IDS) facets.formats[f] = 0;
  for (const c of CATEGORIES) facets.categories[c.id] = 0;
  for (const s of STYLE_IDS) facets.styles[s] = 0;
  for (const m of all) {
    if (!inText(m)) continue;
    if (matchesFilters(m, q, "format")) facets.formats[m.format] = (facets.formats[m.format] ?? 0) + 1;
    if (matchesFilters(m, q, "category")) {
      facets.categories[m.primaryCategory] = (facets.categories[m.primaryCategory] ?? 0) + 1;
      for (const c of m.secondaryCategories) facets.categories[c] = (facets.categories[c] ?? 0) + 1;
    }
    if (matchesFilters(m, q, "style")) for (const s of m.styles) facets.styles[s] = (facets.styles[s] ?? 0) + 1;
  }

  const filtered = all.filter((m) => matchesFilters(m, q));
  const items = rank(filtered, q);
  return { items, total: items.length, facets };
}
