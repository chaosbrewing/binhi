/**
 * Reproducible performance measurements for the template library (API side).
 * Boots the real app against a disposable test database with the shipped
 * catalog, then reports payload sizes and in-process latency (no network) for
 * the calls the Templates page makes, plus the weight of generated thumbnails.
 *
 * Usage: BINHI_TEST_DATABASE_URL=postgres://.../binhi_test node --import tsx scripts/templates/measure-performance.ts
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { api, signup, testApp } from "../../tests/helpers.js";
import { CATALOG } from "../../src/core/templates/library/index.js";

const b = await testApp();
const s = await signup(b.app);
const root = path.resolve(import.meta.dirname, "../..");

async function time(label: string, url: string, runs = 30) {
  const bytes = (await api(b.app, s).get(url)).rawPayload.length;
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await api(b.app, s).get(url);
    samples.push(performance.now() - t);
  }
  samples.sort((x, y) => x - y);
  const pct = (p: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))]!.toFixed(2);
  console.log(`${label.padEnd(44)} ${String(bytes).padStart(8)} B   p50 ${pct(0.5)} ms   p95 ${pct(0.95)} ms`);
}

console.log(`catalog: ${CATALOG.length} templates`);
await time("taxonomy", "/api/template-library/taxonomy");
await time("list, first page (24 cards)", "/api/template-library/templates?pageSize=24");
await time("list, all (48 max)", "/api/template-library/templates?pageSize=48");
await time("search 'poster'", "/api/template-library/templates?q=poster");
await time("filter format=social", "/api/template-library/templates?format=social");
await time("detail", `/api/template-library/templates/${CATALOG[0]!.id}`);
const design = CATALOG.find((m) => m.editor === "design")!;
await time("design document (one template)", `/api/template-library/templates/${design.id}/document`);

const dir = path.join(root, "public/template-previews");
const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
const sizes = files.map((f) => statSync(path.join(dir, f)).size);
const total = sizes.reduce((a, c) => a + c, 0);
console.log(`thumbnails: ${files.length} files, total ${(total / 1024).toFixed(0)} KB, average ${(total / files.length / 1024).toFixed(1)} KB, largest ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
console.log(`first page of 24 thumbnails would transfer ~${(sizes.slice(0, 24).reduce((a, c) => a + c, 0) / 1024).toFixed(0)} KB (lazy-loaded as cards scroll into view)`);
await b.close();
