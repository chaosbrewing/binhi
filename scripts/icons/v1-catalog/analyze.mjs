#!/usr/bin/env node
// Coverage analysis of the "Engineering Specification & Catalog v1.0" (ICN-001..250) against the shipped Essential 250
// and a pinned lucide-static package.   node scripts/icons/v1-catalog/analyze.mjs <lucide-static dir>
// Classes: S = same concept already shipped (binhi.icon.<slug>); L = a Lucide glyph exists (new geometry, ISC);
//          C = needs composition of parts / modified Lucide glyphs; O = needs original art.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "../catalog.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const lucide = process.argv[2];
if (!lucide) throw new Error("usage: analyze.mjs <lucide-static dir>");
const rows = (f) => readFileSync(join(here, f), "utf8").trim().split("\n").map((l) => l.split("\t"));
const catalog = rows("catalog-v1.tsv").map(([n, slug, name, cat]) => ({ n, slug, name, cat }));
const mapping = new Map(rows("v1-mapping.tsv").map(([n, cls, ref]) => [n, { cls, ref }]));
const shipped = new Set(CATEGORIES.flatMap((c) => c.icons.map(([name]) => name.split(" / ")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))));

const problems = [];
const counts = { S: 0, L: 0, C: 0, O: 0 };
const perCat = {};
const usedShipped = new Map();
const usedLucide = new Map();
for (const e of catalog) {
  const m = mapping.get(e.n);
  if (!m) { problems.push(`${e.n} has no mapping`); continue; }
  counts[m.cls]++;
  (perCat[e.cat] ??= { S: 0, L: 0, C: 0, O: 0 })[m.cls]++;
  if (m.cls === "S") {
    if (!shipped.has(m.ref)) problems.push(`${e.n}: shipped slug ${m.ref} does not exist`);
    usedShipped.set(m.ref, [...(usedShipped.get(m.ref) ?? []), e.n]);
  }
  if (m.cls === "L") {
    if (!existsSync(join(lucide, "icons", `${m.ref}.svg`))) problems.push(`${e.n}: lucide icon ${m.ref} does not exist`);
    usedLucide.set(m.ref, [...(usedLucide.get(m.ref) ?? []), e.n]);
  }
}
const dupShipped = [...usedShipped].filter(([, v]) => v.length > 1);
const dupLucide = [...usedLucide].filter(([, v]) => v.length > 1);
const shippedUsedByL = [...usedLucide.keys()].filter((l) => CATEGORIES.some((c) => c.icons.some(([, src]) => src === l)));
console.log(JSON.stringify({ total: catalog.length, counts, perCat, distinctShippedReused: usedShipped.size, shippedIconsMatchedMoreThanOnce: dupShipped, lucideReusedAcrossV1Entries: dupLucide, lucideChoicesAlreadyShipped: shippedUsedByL, problems }, null, 1));
if (problems.length) process.exit(1);
