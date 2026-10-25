// Renders every icon (all supported variants) to PNG contact sheets for visual review.
//   node --import tsx scripts/icons/contact-sheet.ts <output dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { ICON_CATEGORIES, renderIconSvg, type IconVariant } from "../../src/core/icons/index.js";
import { ALL_ICON_SHAPES } from "../../src/core/icons/shapes-all.js";

const out = resolve(process.argv[2] ?? "icon-sheets");
mkdirSync(out, { recursive: true });
const variants: IconVariant[] = ["outline", "duotone", "filled","inverted"];

function sheet(cats: typeof ICON_CATEGORIES): string {
  const rows = cats
    .map((cat) => {
      const cells = cat.icons
        .map((d) => {
          const nodes = ALL_ICON_SHAPES[d.id]!;
          const svgs = variants
            .filter((v) => d.variants.includes(v))
            .map((v) => `<span title="${v}">${renderIconSvg(nodes, { variant: v, size: 40, color: "#1d3557" })}</span>`)
            .join("");
          return `<div class="c"><div class="v">${svgs}</div><div class="n">${String(d.number).padStart(3, "0")} ${d.name}</div></div>`;
        })
        .join("");
      return `<h2>${String(cat.number).padStart(2, "0")} ${cat.name}</h2><div class="g">${cells}</div>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>body{font:12px system-ui;margin:16px;background:#fff;color:#111;width:1500px}h2{font-size:14px;margin:14px 0 6px}.g{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.c{border:1px solid #ddd;border-radius:6px;padding:6px}.v{display:flex;gap:8px;min-height:44px}.n{margin-top:4px;color:#444}</style>${rows}`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1540, height: 900 } });
for (let i = 0; i < ICON_CATEGORIES.length; i += 5) {
  const html = sheet(ICON_CATEGORIES.slice(i, i + 5));
  writeFileSync(join(out, `sheet-${i / 5 + 1}.html`), html);
  await page.setContent(html);
  await page.screenshot({ path: join(out, `sheet-${i / 5 + 1}.png`), fullPage: true });
}
await browser.close();
console.log(`wrote 5 sheets to ${out}`);
