#!/usr/bin/env node
// Generates src/core/icons/generated/** from scripts/icons/catalog.mjs.
//   node scripts/icons/generate.mjs <path to an extracted lucide-static@1.61.0 package>
// Lucide is NOT a runtime dependency: only the resulting geometry is committed (ISC licence, see docs/ICON_LICENSES.md).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./catalog.mjs";
import { ORIGINAL } from "./original.mjs";
import { CLOSE_PATHS, FILLED } from "./variants.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const lucideDir = process.argv[2] ? resolve(process.argv[2]) : process.env.LUCIDE_STATIC_DIR;
if (!lucideDir || !existsSync(join(lucideDir, "icons"))) {
  console.error("usage: node scripts/icons/generate.mjs <lucide-static package dir>");
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(join(lucideDir, "package.json"), "utf8"));
const tags = JSON.parse(readFileSync(join(lucideDir, "tags.json"), "utf8"));

const ALLOWED = {
  path: ["d"],
  circle: ["cx", "cy", "r"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
  ellipse: ["cx", "cy", "rx", "ry"],
};

function parseSvg(name) {
  const file = join(lucideDir, "icons", `${name}.svg`);
  if (!existsSync(file)) throw new Error(`Lucide icon not found: ${name}`);
  const text = readFileSync(file, "utf8");
  const body = text.slice(text.indexOf(">", text.indexOf("<svg")) + 1, text.lastIndexOf("</svg>"));
  const nodes = [];
  for (const m of body.matchAll(/<([a-z]+)\s+([^>]*?)\s*\/>/g)) {
    const tag = m[1];
    if (!ALLOWED[tag]) throw new Error(`${name}: unsupported element <${tag}>`);
    const attrs = {};
    for (const a of m[2].matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
      // The only paint attribute allowed on a node is fill="currentColor" (Lucide's solid dots); everything else is geometry.
      const okFill = a[1] === "fill" && a[2] === "currentColor";
      if (!okFill && !ALLOWED[tag].includes(a[1])) throw new Error(`${name}: unsupported attribute ${a[1]} on <${tag}>`);
      attrs[a[1]] = /^-?\d+(\.\d+)?$/.test(a[2]) ? Number(a[2]) : a[2];
    }
    nodes.push([tag, attrs]);
  }
  const leftover = body.replace(/<([a-z]+)\s+([^>]*?)\s*\/>/g, "").trim();
  if (leftover) throw new Error(`${name}: unparsed content: ${leftover.slice(0, 60)}`);
  if (!nodes.length) throw new Error(`${name}: no drawable nodes`);
  return nodes;
}

// Mirrors isClosedNode() in src/core/icons/safe.ts (a unit test keeps the two in step).
function isClosedNode([tag, attrs]) {
  if (attrs.fill === "currentColor") return false;
  if (["circle", "rect", "ellipse", "polygon"].includes(tag)) return true;
  if (tag === "path") {
    const subs = String(attrs.d).split(/(?=[Mm])/).filter((x) => x.trim());
    return subs.length > 0 && subs.every((x) => /[zZ]\s*$/.test(x.trim()));
  }
  return false;
}

// Licence classes: 0 = BINHI original, 1 = ISC (Lucide), 2 = ISC + MIT (Feather-derived glyph).
const licenceText = readFileSync(join(lucideDir, "LICENSE"), "utf8");
const featherList = new Set(
  (licenceText.match(/derived from the Feather project:\s+([^\n]+(?:\n[^\n]+)*?)\n\nThe MIT License/)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
);
if (!featherList.size) throw new Error("could not read the Feather-derived icon list from the Lucide LICENSE");
const rawGeometry = (name) => {
  const t = readFileSync(join(lucideDir, "icons", `${name}.svg`), "utf8");
  return t.slice(t.indexOf(">", t.indexOf("<svg")) + 1, t.lastIndexOf("</svg>")).replace(/\s+/g, "");
};
// Feather-derived = byte-identical to a Feather-listed glyph. This also catches icons Lucide renamed (circle-help = help-circle).
const featherGeometry = new Set([...featherList].filter((n) => existsSync(join(lucideDir, "icons", `${n}.svg`))).map(rawGeometry));
const isFeather = (src) => featherList.has(src) || featherGeometry.has(rawGeometry(src));

const slugOf = (name) =>
  name.split(" / ")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const entries = [];
const seenSlugs = new Map();
const seenGeometry = new Map();
let n = 0;
const outShapes = {};
for (const cat of CATEGORIES) {
  if (cat.icons.length !== 10) throw new Error(`${cat.slug} must have 10 icons`);
  outShapes[cat.slug] = {};
  for (const [name, source, extra] of cat.icons) {
    n += 1;
    const slug = slugOf(name);
    if (seenSlugs.has(slug)) throw new Error(`duplicate slug ${slug}`);
    seenSlugs.set(slug, n);
    const original = source === "original";
    let nodes = original ? ORIGINAL[name] : parseSvg(source);
    if (nodes && CLOSE_PATHS.has(slug)) nodes = nodes.map(([t, a]) => (t === "path" && !/[zZ]\s*$/.test(a.d) ? [t, { ...a, d: `${a.d}Z` }] : [t, a]));
    if (!nodes) throw new Error(`no original geometry for ${name}`);
    const hash = createHash("sha1").update(JSON.stringify(nodes)).digest("hex");
    if (seenGeometry.has(hash)) throw new Error(`#${n} ${name} has the same glyph as #${seenGeometry.get(hash)}`);
    seenGeometry.set(hash, n);
    // `k`: curated BINHI vocabulary (name words + hand-written intents). `t`: Lucide's own tags, ranked lower in search.
    const words = new Set();
    const tagWords = new Set();
    const split = (str) => str.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    split(name.replace(/ \/ /g, " ")).forEach((w) => words.add(w));
    split(extra).forEach((w) => words.add(w));
    if (!original) (tags[source] ?? []).slice(0, 6).flatMap(split).filter((w) => !words.has(w)).forEach((w) => tagWords.add(w));
    const duo = nodes.some(isClosedNode) ? 1 : 0;
    const filled = FILLED.has(slug) ? 1 : 0;
    if (filled && !duo) throw new Error(`${slug}: filled variant requires a closed shape`);
    entries.push({ n, slug, name, cat: cat.slug, src: original ? "original" : `lucide:${source}`, k: [...words], t: [...tagWords], d: duo, f: filled, l: original ? 0 : isFeather(source) ? 2 : 1 });
    outShapes[cat.slug][slug] = nodes;
  }
}
if (n !== 250) throw new Error(`expected 250 icons, got ${n}`);

const header = (what) => `// GENERATED by scripts/icons/generate.mjs — do not edit by hand.\n// ${what}\n// Lucide geometry: lucide-static ${pkg.version}, ISC licence (see docs/ICON_LICENSES.md). "original" icons are BINHI-authored.\n`;

const outDir = join(root, "src/core/icons/generated");
rmSync(join(outDir, "shapes"), { recursive: true, force: true });
mkdirSync(join(outDir, "shapes"), { recursive: true });

const catLines = CATEGORIES.map((c, i) => `  { slug: ${JSON.stringify(c.slug)}, number: ${i + 1}, name: ${JSON.stringify(c.name)} },`);
const entLines = entries.map((e) => `  { n: ${e.n}, slug: ${JSON.stringify(e.slug)}, name: ${JSON.stringify(e.name)}, cat: ${JSON.stringify(e.cat)}, src: ${JSON.stringify(e.src)}, k: ${JSON.stringify(e.k)}, t: ${JSON.stringify(e.t)}, d: ${e.d}, f: ${e.f}, l: ${e.l} },`);
writeFileSync(
  join(outDir, "catalog.ts"),
  `${header("Icon catalog metadata: 25 categories × 10 icons, fixed numbers 001–250.")}
export interface CatalogCategory { readonly slug: string; readonly number: number; readonly name: string }
export interface CatalogEntry {
  readonly n: number;
  readonly slug: string;
  readonly name: string;
  readonly cat: string;
  /** "lucide:<name>" or "original". */
  readonly src: string;
  /** Curated search keywords (name words and BINHI synonyms/intents), lower case. */
  readonly k: readonly string[];
  /** Lucide's own tags for this glyph (lower-ranked search terms). */
  readonly t: readonly string[];
  /** 1 when the duotone variant is supported (the icon has at least one closed shape). */
  readonly d: 0 | 1;
  /** 1 when the filled variant is supported (curated; see scripts/icons/variants.mjs). */
  readonly f: 0 | 1;
  /** Licence class: 0 BINHI original, 1 ISC (Lucide), 2 ISC + MIT (Feather-derived glyph). */
  readonly l: 0 | 1 | 2;
}
export const LUCIDE_VERSION = ${JSON.stringify(pkg.version)};
export const CATALOG_CATEGORIES: readonly CatalogCategory[] = [\n${catLines.join("\n")}\n];
export const CATALOG_ENTRIES: readonly CatalogEntry[] = [\n${entLines.join("\n")}\n];\n`,
);
for (const [cat, shapes] of Object.entries(outShapes)) {
  const lines = Object.entries(shapes).map(([slug, nodes]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(nodes)},`);
  writeFileSync(
    join(outDir, "shapes", `${cat}.ts`),
    `${header(`Geometry for category "${cat}".`)}import type { IconNode } from "../../types.js";\n\nexport const shapes: Readonly<Record<string, readonly IconNode[]>> = {\n${lines.join("\n")}\n};\n`,
  );
}
// ---- docs/ICON_INVENTORY.md + licence text ----
const licenceOf = (e) => (e.l === 0 ? "BINHI original" : e.l === 2 ? "ISC + MIT (Feather)" : "ISC");
const invLines = [];
for (const c of CATEGORIES) {
  invLines.push(`\n### ${String(CATEGORIES.indexOf(c) + 1).padStart(2, "0")} ${c.name}\n`, "| # | ID | Name | Source | Licence |", "| --- | --- | --- | --- | --- |");
  for (const e of entries.filter((x) => x.cat === c.slug)) {
    invLines.push(`| ${String(e.n).padStart(3, "0")} | \`binhi.icon.${e.slug}\` | ${e.name} | ${e.src === "original" ? "BINHI original" : "Lucide `" + e.src.slice(7) + "`"} | ${licenceOf(e)} |`);
  }
}
const counts = entries.reduce((m, e) => ((m[licenceOf(e)] = (m[licenceOf(e)] ?? 0) + 1), m), {});
writeFileSync(
  join(root, "docs/ICON_INVENTORY.md"),
  `# BINHI icon inventory (generated)\n\nGenerated by \`scripts/icons/generate.mjs\` from \`scripts/icons/catalog.mjs\` — do not edit by hand.\nSource geometry: lucide-static ${pkg.version}. Totals: ${Object.entries(counts).map(([k, v]) => `${v} × ${k}`).join(", ")}.\n${invLines.join("\n")}\n`,
);
// Shipped with the app (served at /third-party-notices.txt) so the notices travel with the artwork.
const originalNames = Object.keys(ORIGINAL);
writeFileSync(
  join(root, "public/third-party-notices.txt"),
  `BINHI icon library — third-party notices\n========================================\n\nThe BINHI icon library contains artwork derived from Lucide (lucide-static ${pkg.version}),\nincluding glyphs that Lucide itself derives from Feather. The licence text below is\nreproduced verbatim from the Lucide package, as the licences require.\n\n${originalNames.length} icons (${originalNames.join(", ")}) are original BINHI artwork and are not covered by these notices.\nPer-icon sources: docs/ICON_INVENTORY.md in the BINHI repository.\n\n----------------------------------------------------------------------------\n\n${licenceText.trimEnd()}\n`,
);
console.log(`generated ${n} icons, ${CATEGORIES.length} categories, ${entries.filter((e) => e.src === "original").length} original`);
