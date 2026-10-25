// Measures the shipped 250 icons against the v1.0 grid rule (geometry + stroke inside the 20×20 live area, 2 px margin).
//   node --import tsx scripts/icons/v1-catalog/measure-grid.ts
import { chromium } from "playwright";
import { ICON_LIST, renderIconSvg } from "../../../src/core/icons/index.js";
import { ALL_ICON_SHAPES } from "../../../src/core/icons/shapes-all.js";

const browser = await chromium.launch();
const page = await browser.newPage();
const results: { id: string; w: number; minX: number; minY: number; maxX: number; maxY: number }[] = [];
for (const strokeWidth of [2, 1.5]) {
  let out = 0;
  const outside: string[] = [];
  for (const d of ICON_LIST) {
    await page.setContent(`<body>${renderIconSvg(ALL_ICON_SHAPES[d.id]!, { size: 24, strokeWidth })}</body>`);
    const b = await page.evaluate(() => {
      const svg = document.querySelector("svg")!;
      const bb = (svg.firstElementChild as SVGGraphicsElement).parentElement!.getBBox();
      return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    });
    const sw = strokeWidth / 2;
    const [x0, y0, x1, y1] = [b.x - sw, b.y - sw, b.x + b.w + sw, b.y + b.h + sw];
    if (x0 < 2 - 0.01 || y0 < 2 - 0.01 || x1 > 22 + 0.01 || y1 > 22 + 0.01) {
      out++;
      outside.push(d.slug);
    }
  }
  console.log(JSON.stringify({ strokeWidth, outsideLiveArea: out, of: ICON_LIST.length, sample: outside.slice(0, 12) }));
}
await browser.close();
void results;
