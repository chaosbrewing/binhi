#!/usr/bin/env node
// Fails when the client bundle grows past agreed budgets. Run after `npm run build`.
//   main bundle (gzip)        ≤ 190 KB   (Phase 1 baseline 169.3 KB; icon library + editor features 184.8 KB at introduction)
//   icon browser chunk (gzip) ≤  14 KB
//   each icon category chunk  ≤   4 KB gzip, and exactly 25 of them
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const dir = join(process.cwd(), "dist/client/assets");
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
const gz = (f) => gzipSync(readFileSync(join(dir, f)), { level: 9 }).length;
const CATEGORIES = ["navigation", "editing", "selection", "alignment", "layers", "typography", "adjustments", "effects", "colors", "shapes", "structure", "elements", "media", "conversion", "devices", "publishing", "forms", "communication", "commerce", "people", "time", "places", "creative", "nature", "status"];
const problems = [];
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const main = files.filter((f) => f.startsWith("index-"));
const mainGz = main.reduce((n, f) => n + gz(f), 0);
if (mainGz > 190 * 1024) problems.push(`main bundle ${kb(mainGz)} gzip exceeds 190 KB`);
const browser = files.find((f) => f.startsWith("IconBrowser-"));
if (!browser) problems.push("the icon browser is no longer a lazy chunk");
else if (gz(browser) > 14 * 1024) problems.push(`icon browser chunk ${kb(gz(browser))} gzip exceeds 14 KB`);
let categoryTotal = 0;
let found = 0;
for (const c of CATEGORIES) {
  const f = files.find((x) => new RegExp(`^${c}-[\\w-]+\\.js$`).test(x));
  if (!f) continue;
  found++;
  const size = gz(f);
  categoryTotal += size;
  if (size > 4 * 1024) problems.push(`icon category chunk ${f} is ${kb(size)} gzip (limit 4 KB)`);
}
if (found !== 25) problems.push(`expected 25 lazy icon category chunks, found ${found}`);
console.log(`main ${kb(mainGz)} gzip · icon browser ${browser ? kb(gz(browser)) : "n/a"} · ${found} category chunks ${kb(categoryTotal)} gzip total`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
