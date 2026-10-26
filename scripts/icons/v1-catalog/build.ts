/**
 * Reproducible v1 reconciliation. Legacy catalog and geometry are immutable inputs.
 * node --import tsx scripts/icons/v1-catalog/build.ts <lucide-static@1.61.0 dir>
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { CATALOG_ENTRIES, LUCIDE_VERSION } from "../../../src/core/icons/generated/catalog.js";
import { KEYWORDS as LEGACY_KEYWORDS } from "../../../src/core/icons/generated/keywords.js";
import { iconProblem, isClosedNode } from "../../../src/core/icons/safe.js";
import type { IconNode } from "../../../src/core/icons/types.js";
import { ARTWORK } from "./artwork.mjs";

const root = resolve(import.meta.dirname, "../../..");
const upstream = resolve(process.argv[2] ?? "");
const pkg = JSON.parse(readFileSync(join(upstream, "package.json"), "utf8"));
if (pkg.version !== LUCIDE_VERSION || pkg.name !== "lucide-static") throw new Error("Pinned lucide-static 1.61.0 source required");
const license = readFileSync(join(upstream, "LICENSE"), "utf8");
const tags = JSON.parse(readFileSync(join(upstream, "tags.json"), "utf8"));
const rows = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8").trim().split("\n").map(l => l.split("\t"));
const mapping = new Map(rows("v1-mapping.tsv").map(([n, cls, basis]) => [n!, { cls: cls!, basis: basis! }]));
// Explicit semantic review of the ten plan collisions. Never rename or redirect the old ids.
// Unread Mention keeps the conventional @ glyph, but is a distinct asset from legacy Email Input.
const collisionChoices: Record<string, string> = {
  "003": "square-dashed-mouse-pointer", "004": "circle-dashed-check",
  "145": "align-horizontal-distribute-center", "193": "audio-waveform",
  "199": "file-search-2", "201": "file-code-2", "214": "workflow",
  "217": "circle-gauge", "233": "at-sign", "237": "git-compare-arrows",
};
const plan = readFileSync(join(root, "docs/ICON_CATALOG_V1_PLAN.md"), "utf8");
const categories = [...plan.matchAll(/^\*\*(C\d{2}) (.+?)\*\*/gm)].map((m, i) => ({
  slug: m[1]!.toLowerCase(), number: i + 1, name: m[2]!,
}));
if (categories.length !== 25) throw new Error("Plan must define exactly 25 canonical categories");
const oldBySlug = new Map(CATALOG_ENTRIES.map(e => [e.slug, e]));
const legacyShapes: Record<string, readonly IconNode[]> = {};
for (const cat of new Set(CATALOG_ENTRIES.map(e => e.cat))) {
  const { shapes } = await import(`../../../src/core/icons/generated/shapes/${cat}.js`);
  Object.assign(legacyShapes, shapes);
}
const geometryBody = (name: string) => {
  const text = readFileSync(join(upstream, "icons", `${name}.svg`), "utf8");
  return text.slice(text.indexOf(">", text.indexOf("<svg")) + 1, text.lastIndexOf("</svg>"));
};
const featherNames = new Set((license.match(/derived from the Feather project:\s+([^\n]+(?:\n[^\n]+)*?)\n\nThe MIT License/)?.[1] ?? "")
  .split(",").map(s => s.trim()).filter(Boolean));
if (!featherNames.size) throw new Error("Missing upstream Feather attribution list");
const featherGeometry = new Set([...featherNames].filter(n => existsSync(join(upstream, "icons", `${n}.svg`)))
  .map(n => geometryBody(n).replace(/\s+/g, "")));
const allowed: Record<string, string[]> = {
  path: ["d"], circle: ["cx", "cy", "r"], rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"], polyline: ["points"], polygon: ["points"], ellipse: ["cx", "cy", "rx", "ry"],
};
function lucide(name: string): readonly IconNode[] {
  const body = geometryBody(name);
  const nodes: IconNode[] = [];
  for (const m of body.matchAll(/<([a-z]+)\s+([^>]*?)\s*\/>/g)) {
    const tag = m[1]!;
    if (!allowed[tag]) throw new Error(`Unknown SVG tag ${tag}`);
    const attrs: Record<string, string | number> = {};
    for (const a of m[2]!.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
      const key = a[1]!, value = a[2]!;
      if (!allowed[tag]!.includes(key) && !(key === "fill" && value === "currentColor")) throw new Error(`Unknown SVG attr ${key}`);
      attrs[key] = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    nodes.push([tag as IconNode[0], attrs]);
  }
  if (body.replace(/<([a-z]+)\s+([^>]*?)\s*\/>/g, "").trim()) throw new Error(`Unparsed upstream SVG ${name}`);
  return nodes;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const entries: Record<string, unknown>[] = [];
const shapes: Record<string, Record<string, readonly IconNode[]>> = {};
const seen = new Map<string, string>();
const matrix = ["ICN\tcanonical_id\tname\tcategory\tclass\tbasis\tlegacy_same_concept\tgeometry_collision_legacy\tresolution\tsha256\tartwork_review"];
for (const [number, slug, name, category] of rows("catalog-v1.tsv")) {
  const planned = mapping.get(number!)!;
  const m = planned && { ...planned, basis: collisionChoices[number!] ?? planned.basis };
  if (!m || !["S", "L", "C", "O"].includes(m.cls)) throw new Error(`Bad mapping ${number}`);
  const legacy = m.cls === "S" ? oldBySlug.get(m.basis) : undefined;
  if (m.cls === "S" && !legacy) throw new Error(`Unknown preserved source ${m.basis}`);
  // Existing ids are reused ONLY for the explicitly same-concept S mapping.
  // A new meaning never takes an old slug, even where the SVG geometry is identical.
  let persistentSlug = legacy?.slug ?? slug!;
  if (!legacy && oldBySlug.has(persistentSlug)) persistentSlug = `v1-${persistentSlug}`;
  const id = `binhi.icon.${persistentSlug}`;
  const art = ARTWORK[number! as keyof typeof ARTWORK];
  const nodes: readonly IconNode[] = legacy ? legacyShapes[legacy.slug]! : m.cls === "L" ? lucide(m.basis) : art?.nodes as readonly IconNode[];
  if (!nodes) throw new Error(`ICN-${number} has no real artwork; canonical catalog may not be activated`);
  const problem = iconProblem(nodes);
  if (problem) throw new Error(`ICN-${number}: ${problem}`);
  const sha = hash(nodes);
  if (seen.has(sha)) throw new Error(`Canonical geometry duplicate ${number} / ${seen.get(sha)}`);
  seen.set(sha, number!);
  const collisions = CATALOG_ENTRIES.filter(e => hash(legacyShapes[e.slug]) === sha && e.slug !== legacy?.slug);
  const l = legacy?.l ?? (m.cls !== "L" ? 0 : featherNames.has(m.basis) || featherGeometry.has(geometryBody(m.basis).replace(/\s+/g, "")) ? 2 : 1);
  const src = legacy?.src ?? (m.cls === "L" ? `lucide:${m.basis}` : "original");
  const cat = category!.toLowerCase();
  const entry = {
    n: Number(number), slug: persistentSlug, name, cat, src, d: legacy?.d ?? (nodes.some(isClosedNode) ? 1 : 0),
    f: legacy?.f ?? (["048", "049", "050", "078", "105", "108", "109"].includes(number!) ? 1 : 0),
    l, alias: `ICN-${number}`, classification: m.cls, canonicalSlug: slug, sha256: sha,
    basis: m.basis, provenance: legacy ? `Preserved Essential source binhi.icon.${legacy.slug}; geometry unchanged` :
      m.cls === "L" ? `lucide-static@${pkg.version}/icons/${m.basis}.svg` : art!.provenance,
    review: "pending",
    keywords: [...new Set([...`${name} ${slug} ${m.basis}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      ...(legacy ? LEGACY_KEYWORDS[legacy.n - 1]?.[0] ?? [] : [])])],
    tags: legacy ? LEGACY_KEYWORDS[legacy.n - 1]?.[1] ?? [] : m.cls === "L" ? tags[m.basis] ?? [] : [],
  };
  entries.push(entry);
  (shapes[cat] ??= {})[persistentSlug] = nodes;
  matrix.push([`ICN-${number}`, id, name!, category!, m.cls, m.basis, legacy ? `binhi.icon.${legacy.slug}` : "",
    collisions.map(e => `binhi.icon.${e.slug}`).join(","),
    collisionChoices[number!] ? `Explicit collision decision: ${planned.basis} -> ${m.basis}; ${number === "233" ? "shared conventional @ geometry, NOT a semantic alias; legacy email-input unchanged" : "distinct glyph; old id and geometry retained"}` :
    collisions.length ? "Distinct semantic id; legacy id and exact geometry retained; shared licensed geometry declared" :
      legacy ? "Same concept; preserve legacy id and geometry" : "New semantic id; no legacy meaning replaced", sha, "pending"].join("\t"));
}
if (entries.length !== 250 || categories.some(c => entries.filter(e => e.cat === c.slug).length !== 10)) throw new Error("Expected 25 x 10 canonical entries");
const counts = Object.fromEntries(["S", "L", "C", "O"].map(c => [c, entries.filter(e => e.classification === c).length]));
if (JSON.stringify(counts) !== JSON.stringify({ S: 75, L: 70, C: 80, O: 25 })) throw new Error("Classification totals changed");
const out = join(root, "src/core/icons/canonical");
mkdirSync(join(out, "shapes"), { recursive: true });
const header = "// GENERATED by scripts/icons/v1-catalog/build.ts. Legacy sources remain unchanged.\n";
const metadata = entries.map(({ keywords, tags, sha256, basis, provenance, review, canonicalSlug, ...entry }) => entry);
writeFileSync(join(out, "catalog.ts"), `${header}export const V1_CATEGORIES = ${JSON.stringify(categories)} as const;\nexport const V1_ENTRIES = ${JSON.stringify(metadata)} as const;\n`);
const vocabulary = entries.map(e => {
  // Names already have a ranked search field. Do not ship them twice, or all upstream tags, in the browser.
  const nameWords = new Set(String(e.name).toLowerCase().split(/[^a-z0-9]+/));
  const keywords = (e.keywords as string[]).filter(w => !nameWords.has(w));
  const tagWords = [...new Set((e.tags as string[]).slice(0, 3).flatMap(t => t.toLowerCase().split(/[^a-z0-9]+/))
    .filter(w => w.length > 1 && !nameWords.has(w) && !keywords.includes(w)))];
  return [keywords, tagWords];
});
writeFileSync(join(out, "keywords.ts"), `${header}export const V1_KEYWORDS = ${JSON.stringify(vocabulary)} as const;\n`);
for (const [cat, nodes] of Object.entries(shapes)) {
  writeFileSync(join(out, "shapes", `${cat}.ts`), `${header}import type { IconNode } from "../../types.js";\nexport const shapes: Readonly<Record<string, readonly IconNode[]>> = ${JSON.stringify(nodes)};\n`);
}
writeFileSync(join(root, "docs/ICON_V1_COLLISION_MATRIX.tsv"), matrix.join("\n") + "\n");
writeFileSync(join(root, "docs/ICON_V1_MANIFEST.json"), JSON.stringify({ version: "1.0", counts, lucide: pkg.version, entries }, null, 2) + "\n");
writeFileSync(join(root, "docs/ICON_INVENTORY.md"), "# BINHI Essential 250 — canonical v1.0 inventory\n\nGenerated from the approved plan by scripts/icons/v1-catalog/build.ts. Exactly 25 × 10 canonical assets; legacy sources remain compatibility-only. S=75, L=70, C=80, O=25. Artwork review: **pending**, not release approval.\n\n| # | ID | Alias | Name | Class | Source | Licence |\n| --- | --- | --- | --- | --- | --- | --- |\n" + entries.map(e => `| ${String(e.n).padStart(3, "0")} | \`binhi.icon.${e.slug}\` | ${e.alias} | ${e.name} | ${e.classification} | ${e.src} | ${e.l === 0 ? "LicenseRef-BINHI (authorship review pending)" : e.l === 2 ? "ISC AND MIT" : "ISC"} |`).join("\n") + "\n");
// The existing public notice contains the verbatim licence, including Feather. Never remove it.
const notice = readFileSync(join(root, "public/third-party-notices.txt"), "utf8");
if (!notice.includes(license.trim())) throw new Error("Existing upstream legal notice differs; manual legal review required");
console.log(JSON.stringify({ canonical: entries.length, legacyPreserved: CATALOG_ENTRIES.length, counts, semanticCollisionDecisions: Object.keys(collisionChoices).length, review: "250 pending founder visual review" }, null, 2));
