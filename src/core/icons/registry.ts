import { CATALOG_CATEGORIES, CATALOG_ENTRIES, LUCIDE_VERSION, type CatalogEntry } from "./generated/catalog.js";
import type { IconVariant } from "./render.js";

/** Version of the registry contract; bump when ids change meaning, never for added keywords. */
export const ICON_REGISTRY_VERSION = "1.0.0";
export const ICON_ID_PREFIX = "binhi.icon.";
export const ICON_ID_PATTERN = /^binhi\.icon\.[a-z0-9]+(-[a-z0-9]+)*$/;
export const ICON_VIEWBOX = "0 0 24 24";
export const ICON_COUNT = 250;
export const ICON_CATEGORY_COUNT = 25;
export const ICONS_PER_CATEGORY = 10;

export interface IconLicence {
  readonly spdx: string;
  readonly holder: string;
  readonly note: string;
}

export interface IconDefinition {
  /** Canonical, stable asset id, e.g. `binhi.icon.camera`. Stored in documents. */
  readonly id: string;
  /** Fixed library number 1–250. */
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly categoryName: string;
  readonly source: { readonly kind: "lucide" | "original"; readonly name?: string };
  readonly licence: IconLicence;
  /** Curated BINHI keywords (name words and intents). */
  readonly keywords: readonly string[];
  /** Lucide's own tags; searchable but ranked below curated keywords. */
  readonly tags: readonly string[];
  readonly variants: readonly IconVariant[];
  readonly customization: {
    readonly colour: true;
    readonly gradient: true;
    readonly opacity: true;
    readonly strokeWeight: true;
    readonly rotate: true;
    readonly flip: true;
  };
  readonly viewBox: typeof ICON_VIEWBOX;
  readonly a11y: { readonly defaultLabel: string; readonly decorativeByDefault: true };
  readonly version: number;
  readonly deprecated?: { readonly since: string; readonly replacedBy?: string };
}

const LUCIDE_LICENCE: IconLicence = {
  spdx: "ISC",
  holder: "Lucide Icons and Contributors",
  note: `lucide-static ${LUCIDE_VERSION}; some icons derive from Feather (MIT, Cole Bemis) — see docs/ICON_LICENSES.md`,
};
const LUCIDE_FEATHER_LICENCE: IconLicence = {
  spdx: "ISC AND MIT",
  holder: "Lucide Icons and Contributors; Cole Bemis (Feather)",
  note: `lucide-static ${LUCIDE_VERSION}; this glyph is identical to a Feather icon — both notices apply (public/third-party-notices.txt)`,
};
const ORIGINAL_LICENCE: IconLicence = {
  spdx: "LicenseRef-BINHI",
  holder: "CHAOS ORIGINS",
  note: "Authored for BINHI; same terms as the BINHI repository",
};

export class IconRegistryError extends Error {}

function define(entry: CatalogEntry): IconDefinition {
  const categoryName = CATALOG_CATEGORIES.find((c) => c.slug === entry.cat)?.name;
  if (!categoryName) throw new IconRegistryError(`icon ${entry.slug} has unknown category ${entry.cat}`);
  const variants: IconVariant[] = ["outline"];
  if (entry.d) variants.push("duotone");
  if (entry.f) variants.push("filled");
  variants.push("inverted", "brand");
  const original = entry.src === "original";
  return Object.freeze({
    id: `${ICON_ID_PREFIX}${entry.slug}`,
    number: entry.n,
    slug: entry.slug,
    name: entry.name,
    category: entry.cat,
    categoryName,
    source: original ? { kind: "original" } : { kind: "lucide", name: entry.src.slice("lucide:".length) },
    licence: original ? ORIGINAL_LICENCE : entry.l === 2 ? LUCIDE_FEATHER_LICENCE : LUCIDE_LICENCE,
    keywords: entry.k,
    tags: entry.t,
    variants,
    customization: { colour: true, gradient: true, opacity: true, strokeWeight: true, rotate: true, flip: true },
    viewBox: ICON_VIEWBOX,
    a11y: { defaultLabel: entry.name, decorativeByDefault: true },
    version: 1,
  } as IconDefinition);
}

/**
 * Builds the registry and refuses to start on any structural problem: wrong totals, a gap in the numbering,
 * duplicate ids/slugs, or an unknown category. Cheap (250 entries), so it runs at module load.
 */
export function buildRegistry(entries: readonly CatalogEntry[] = CATALOG_ENTRIES): ReadonlyMap<string, IconDefinition> {
  if (entries.length !== ICON_COUNT) throw new IconRegistryError(`expected ${ICON_COUNT} icons, found ${entries.length}`);
  if (CATALOG_CATEGORIES.length !== ICON_CATEGORY_COUNT) throw new IconRegistryError(`expected ${ICON_CATEGORY_COUNT} categories`);
  const map = new Map<string, IconDefinition>();
  entries.forEach((entry, index) => {
    if (entry.n !== index + 1) throw new IconRegistryError(`icon numbering breaks at #${index + 1} (${entry.slug})`);
    const def = define(entry);
    if (!ICON_ID_PATTERN.test(def.id)) throw new IconRegistryError(`invalid icon id ${def.id}`);
    if (map.has(def.id)) throw new IconRegistryError(`duplicate icon id ${def.id}`);
    map.set(def.id, def);
  });
  for (const cat of CATALOG_CATEGORIES) {
    const count = entries.filter((e) => e.cat === cat.slug).length;
    if (count !== ICONS_PER_CATEGORY) throw new IconRegistryError(`category ${cat.slug} has ${count} icons`);
  }
  return map;
}

const REGISTRY = buildRegistry();
const BY_NUMBER = new Map([...REGISTRY.values()].map((d) => [d.number, d]));

export interface IconCategory {
  readonly slug: string;
  readonly number: number;
  readonly name: string;
  readonly icons: readonly IconDefinition[];
}

export const ICON_CATEGORIES: readonly IconCategory[] = CATALOG_CATEGORIES.map((c) => ({
  ...c,
  icons: [...REGISTRY.values()].filter((d) => d.category === c.slug),
}));

/**
 * For builds that predate the library: the built-in icon name (see LEGACY_ICON_NAMES in the component registry) that
 * means the same thing as a library icon. The editor stores it in the element's legacy `name` prop when a library icon
 * is chosen, so an older build that cannot read `icon` still shows a sensible glyph instead of the default star.
 * The library icon always wins in this build. Only icons with a true equivalent are listed.
 */
export const LEGACY_FALLBACK_NAMES: Readonly<Record<string, string>> = {
  "binhi.icon.star": "star",
  "binhi.icon.heart": "heart",
  "binhi.icon.forward-arrow": "arrow-right",
  "binhi.icon.email": "mail",
  "binhi.icon.phone": "phone",
  "binhi.icon.location-pin": "pin",
  "binhi.icon.camera": "camera",
  "binhi.icon.leaf": "leaf",
  "binhi.icon.sun": "sun",
  "binhi.icon.moon": "moon",
  "binhi.icon.sparkles": "sparkle",
  "binhi.icon.menu": "menu",
  "binhi.icon.globe": "globe",
  "binhi.icon.clock": "clock",
  "binhi.icon.calendar": "calendar",
  "binhi.icon.user": "user",
  "binhi.icon.price-tag": "tag",
  "binhi.icon.video-element": "play",
};

export function legacyFallbackName(id: string): string | undefined {
  return LEGACY_FALLBACK_NAMES[id];
}

export const ICON_LIST: readonly IconDefinition[] = [...REGISTRY.values()];

export function hasIcon(id: unknown): id is string {
  return typeof id === "string" && REGISTRY.has(id);
}

export function getIcon(id: string): IconDefinition | undefined {
  return REGISTRY.get(id);
}

export function getIconByNumber(n: number): IconDefinition | undefined {
  return BY_NUMBER.get(n);
}

export function iconSupportsVariant(id: string, variant: IconVariant): boolean {
  return REGISTRY.get(id)?.variants.includes(variant) ?? false;
}
