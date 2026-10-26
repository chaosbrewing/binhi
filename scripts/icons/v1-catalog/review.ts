/**
 * Deterministic review sheets, pixel verification at 16/20/24/32 and optical comparison.
 * Generates local evidence only; does not mark founder approval or change runtime geometry.
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { ICON_CATEGORIES, renderIconSvg } from "../../../src/core/icons/index.js";
import { resolveIconShapeSync } from "../../../src/core/icons/shapes-all.js";

const out = resolve(process.argv[2] ?? "generated-artifacts/icon-v1-review");
mkdirSync(out, { recursive: true });
const gbm = (existsSync("/nix/store") ? readdirSync("/nix/store") : []).filter(n => n.includes("mesa-libgbm")).map(n => `/nix/store/${n}/lib`).find(d => existsSync(`${d}/libgbm.so.1`));
if (gbm) process.env.LD_LIBRARY_PATH = `${gbm}:${process.env.LD_LIBRARY_PATH ?? ""}`;
const sizes = [16, 20, 24, 32];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pixels: Record<string, unknown>[] = [];
  const optical: Record<string, unknown>[] = [];
  const sections: string[] = [];
  for (const cat of ICON_CATEGORIES) {
    const cells = cat.icons.map(d => {
      const nodes = resolveIconShapeSync(d.id)!;
      const svgs = sizes.map(size => renderIconSvg(nodes, { size, color: "#193a40", strokeWidth: 1.5, label: `${d.aliases![0]} at ${size}px` })).join("");
      const unchanged = renderIconSvg(nodes, { size: 32, color: "#193a40", strokeWidth: 2 });
      const target = renderIconSvg(nodes, { size: 32, color: "#193a40", strokeWidth: 1.5 / 0.909 })
        .replace(/(<svg[^>]*>)/, '$1<g transform="translate(12 12) scale(0.909) translate(-12 -12)">').replace("</svg>", "</g></svg>");
      return `<article data-id="${d.id}"><div class="sizes">${svgs}</div><strong>${d.aliases![0]} · ${d.name}</strong><p>${d.classification} · review pending</p><div class="compare">${unchanged}<span>→</span>${target}</div></article>`;
    }).join("");
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${cat.name} — artwork review</title><style>body{font:14px system-ui;background:#f1f7f4;color:#193a40;margin:24px}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}article{background:white;border:1px solid #9cb8ae;border-radius:8px;padding:12px}.sizes{display:flex;align-items:center;gap:12px;height:48px}strong{display:block;font-size:12px;margin-top:12px}p{font-size:12px}.compare{display:flex;align-items:center;gap:16px}</style><h1>${cat.name}</h1><p>16 / 20 / 24 / 32px · stroke 1.5. Below: current 2px → proposed optical target. Comparison only; no saved geometry rescaled. Founder review pending.</p><div class="grid">${cells}</div></html>`;
    sections.push(`<section id="${cat.slug}"><h2>${cat.number}. ${cat.name}</h2><div class="grid">${cells}</div></section>`);
    writeFileSync(join(out, `${cat.slug}.html`), html);
    await page.setContent(html);
    // Rasterize every glyph from its actual SVG; every size must have nontransparent pixels.
    const checks = await page.evaluate(async () => {
      const result = [];
      for (const article of document.querySelectorAll("article")) {
        for (const svg of article.querySelectorAll(".sizes svg")) {
          const image = new Image();
          const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          try {
            image.src = url;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let ink = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) ink++;
            if (!ink) throw new Error(`Blank glyph ${article.getAttribute("data-id")}`);
            result.push({ id: article.getAttribute("data-id"), size: image.width, ink });
          } finally { URL.revokeObjectURL(url); }
        }
      }
      return result;
    });
    pixels.push(...checks);
    const bounds = await page.evaluate(() => Array.from(document.querySelectorAll("article")).map(a => {
      const svg = a.querySelector<SVGSVGElement>(".sizes svg")!;
      const b = svg.getBBox();
      return { id: a.getAttribute("data-id"), x: b.x, y: b.y, width: b.width, height: b.height,
        outsideOpticalTarget: b.x - 0.75 < 2 || b.y - 0.75 < 2 || b.x + b.width + 0.75 > 22 || b.y + b.height + 0.75 > 22 };
    }));
    optical.push(...bounds);
    await page.screenshot({ path: join(out, `${cat.slug}.png`), fullPage: true });
  }
  writeFileSync(join(out, "evidence.json"), JSON.stringify({ canonical: 250, rasterChecks: pixels.length, sizes, pixels, optical, review: "pending founder approval; pixel presence is not a legibility or authorship verdict" }, null, 2));
  writeFileSync(join(out, "all-250-review.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BINHI Essential 250 — founder artwork review</title><style>body{font:14px system-ui;background:#f1f7f4;color:#193a40;margin:24px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}article{background:white;border:1px solid #9cb8ae;border-radius:8px;padding:12px}.sizes,.compare{display:flex;align-items:center;gap:12px;min-height:48px}strong{display:block;margin-top:12px}p{font-size:13px}section{margin:40px 0}nav{display:flex;flex-wrap:wrap;gap:12px}a{color:#164e63}</style><h1>BINHI Essential 250 — canonical v1.0</h1><p>75 preserved + 70 Lucide + 80 custom compositions + 25 original drawings. All 250 await founder visual approval; the 105 new C/O vectors are AI-assisted and await authorship review. No production changes.</p><p>Each card shows 16/20/24/32px at 1.5px stroke. Bottom comparison: unchanged 2px geometry → proposed 20×20 optical profile. The proposal is not applied to saved projects. ${optical.filter(b => b.outsideOpticalTarget).length} optical target flags require review. Pixel presence is verified, not semantic legibility.</p><nav>${ICON_CATEGORIES.map(c => `<a href="#${c.slug}">${c.number}. ${c.name}</a>`).join("")}</nav>${sections.join("")}<footer>Lucide artwork: ISC; Feather-derived artwork: ISC AND MIT. Full third-party notices remain in the BINHI repository and app at /third-party-notices.txt. Per-item provenance and hashes: docs/ICON_V1_MANIFEST.json. AI-assisted originals are not claimed as cleared for release.</footer></html>`);
  console.log(`PASS: ${pixels.length} nonblank raster checks; 25 contact sheets; ${optical.filter(b => b.outsideOpticalTarget).length} optical-target flags (no runtime normalization applied)`);
} finally { await browser.close(); }
