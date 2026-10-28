/**
 * Builds the catalog's generated assets from the real content:
 *   - public/template-previews/<id>@<version>.jpg   card thumbnails
 *   - src/core/templates/library/catalog/lock.ts    content fingerprints + preview provenance
 *
 * Website thumbnails are the real renderer's output (the same HTML a published
 * site uses) captured in Chromium. Design thumbnails come from the Design
 * Studio's own renderDesign() bundled into a page. Nothing is hand-drawn.
 *
 * Usage: node --import tsx scripts/templates/build-assets.ts [--check]
 *   --check  verify the committed lock matches current content; write nothing.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { build } from "esbuild";
import { CATALOG, DESIGN_CONTENT, canonicalContent, type Manifest } from "../../src/core/templates/library/index.js";
import { createSiteDocument } from "../../src/core/templates/index.js";
import { renderPage } from "../../src/core/render/html.js";
import { DesignDocument } from "../../src/core/creative/design.js";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(root, "public/template-previews");
const lockFile = path.join(root, "src/core/templates/library/catalog/lock.ts");
const check = process.argv.includes("--check");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function contentOf(m: Manifest): unknown {
  if (m.content.type === "builtin-site") return createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
  if (m.content.type === "builtin-design") return DesignDocument.parse(DESIGN_CONTENT[m.content.key]);
  throw new Error(`${m.id}: only built-in templates have generated assets`);
}

export interface LockEntry {
  contentSha256: string;
  preview: { file: string; width: number; height: number; renderedFrom: string };
}

async function bundleDesignRenderer(): Promise<string> {
  const entry = `
    import { renderDesign } from ${JSON.stringify(path.join(root, "src/client/studio/design/renderDesign.ts"))};
    window.__render = async (doc, maxEdge) => {
      const blob = await renderDesign(doc, "image/png", 1, () => Promise.reject(new Error("no images")));
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, c.width, c.height);
      return { dataUrl: c.toDataURL("image/jpeg", 0.85), width: c.width, height: c.height };
    };`;
  const r = await build({ stdin: { contents: entry, resolveDir: root, loader: "ts" }, bundle: true, write: false, format: "iife", platform: "browser", logLevel: "silent" });
  return r.outputFiles[0]!.text;
}

async function main() {
  const lock: Record<string, LockEntry> = {};
  const hashes: Record<string, string> = {};
  for (const m of CATALOG) hashes[`${m.id}@${m.version}`] = sha256(canonicalContent(contentOf(m)));

  if (check) {
    const current = await import("../../src/core/templates/library/catalog/lock.js").then((x) => x.LOCK as Record<string, LockEntry>).catch(() => ({}) as Record<string, LockEntry>);
    let bad = 0;
    for (const [key, h] of Object.entries(hashes)) {
      const e = current[key];
      if (!e) { console.error(`MISSING lock entry: ${key}`); bad++; }
      else if (e.contentSha256 !== h) { console.error(`CONTENT CHANGED without a version bump: ${key}`); bad++; }
      else if (e.preview.renderedFrom !== h) { console.error(`STALE preview: ${key}`); bad++; }
      else if (!existsSync(path.join(root, "public", e.preview.file))) { console.error(`MISSING preview file: ${e.preview.file}`); bad++; }
    }
    for (const key of Object.keys(current)) if (!(key in hashes)) { console.error(`ORPHAN lock entry: ${key}`); bad++; }
    if (bad) process.exit(1);
    console.log(`catalog assets OK (${Object.keys(hashes).length} templates)`);
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const designBundle = CATALOG.some((m) => m.content.type === "builtin-design") ? await bundleDesignRenderer() : null;
    for (const m of CATALOG) {
      const key = `${m.id}@${m.version}`;
      const file = `/template-previews/${m.id}@${m.version}.jpg`;
      const abs = path.join(root, "public", file);
      let width = 0, height = 0;
      if (m.content.type === "builtin-site") {
        const doc = createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
        const home = doc.pages.find((p) => p.isHome)!;
        const html = renderPage(doc, home.id, { mode: "preview", baseHref: "/", formAction: () => "#" });
        const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 0.5 });
        const page = await ctx.newPage();
        await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => undefined);
        await page.evaluate(() => (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => undefined);
        writeFileSync(abs, await page.screenshot({ type: "jpeg", quality: 82 }));
        width = 600; height = 450;
        await ctx.close();
      } else {
        const doc = DesignDocument.parse(DESIGN_CONTENT[(m.content as { key: string }).key]);
        const page = await browser.newPage();
        await page.setContent("<!doctype html><meta charset=utf-8><body></body>");
        await page.addScriptTag({ content: designBundle! });
        const out = await page.evaluate(([d, edge]) => (window as unknown as { __render: (d: unknown, e: number) => Promise<{ dataUrl: string; width: number; height: number }> }).__render(d, edge), [doc, 640] as const);
        writeFileSync(abs, Buffer.from(out.dataUrl.split(",")[1]!, "base64"));
        width = out.width; height = out.height;
        await page.close();
      }
      lock[key] = { contentSha256: hashes[key]!, preview: { file, width, height, renderedFrom: hashes[key]! } };
      console.log(`built ${key}  ${width}x${height}`);
    }
  } finally {
    await browser.close();
  }
  const body = `/**\n * GENERATED by scripts/templates/build-assets.ts. Do not edit.\n * Content fingerprints make published (id, version) pairs immutable: the\n * catalog test fails if a template's content changes without a version bump,\n * and a stale preview (renderedFrom != contentSha256) fails as well.\n */\nexport const LOCK = ${JSON.stringify(lock, null, 2)} as const;\n`;
  writeFileSync(lockFile, body);
  console.log(`wrote ${path.relative(root, lockFile)}`);
}

await main();
