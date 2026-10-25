import { fontStack, type DesignDocument, type DesignLayer, type IconLayer, type TextLayer } from "../../../core/creative/index.js";
import { iconLayerSvg, wrapText } from "./renderDesign.js";

/** Embedded copy of a library image (the only place bytes enter the SVG). */
export type SvgImageSource = (assetId: string) => Promise<{ mime: string; base64: string }>;
type Measurer = Pick<CanvasRenderingContext2D, "measureText"> & { font: string };

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const n = (v: number) => String(Math.round(v * 100) / 100);

function textMarkup(layer: TextLayer, ctx: Measurer, clipId: string): string {
  ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${fontStack(layer.font)}`;
  const lines = wrapText(ctx as CanvasRenderingContext2D, layer.text, layer.width);
  const lineHeight = layer.fontSize * layer.lineHeight;
  const ascentPad = layer.fontSize * 0.8 + (lineHeight - layer.fontSize) / 2;
  const anchor = layer.align === "left" ? "start" : layer.align === "right" ? "end" : "middle";
  const x = layer.align === "left" ? -layer.width / 2 : layer.align === "right" ? layer.width / 2 : 0;
  const rows = lines
    .map((line, i) => `<text x="${n(x)}" y="${n(-layer.height / 2 + i * lineHeight + ascentPad)}" text-anchor="${anchor}" xml:space="preserve">${xml(line)}</text>`)
    .join("");
  return `<clipPath id="${clipId}"><rect x="${n(-layer.width / 2)}" y="${n(-layer.height / 2)}" width="${n(layer.width)}" height="${n(layer.height)}"/></clipPath><g clip-path="url(#${clipId})" font-family="${xml(fontStack(layer.font))}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" fill="${xml(layer.color)}">${rows}</g>`;
}

async function layerMarkup(layer: DesignLayer, ctx: Measurer, images: SvgImageSource): Promise<string> {
  const transform = `translate(${n(layer.x + layer.width / 2)} ${n(layer.y + layer.height / 2)})${layer.rotation ? ` rotate(${n(layer.rotation)})` : ""}`;
  const opacity = layer.opacity < 1 ? ` opacity="${n(layer.opacity)}"` : "";
  const open = `<g data-layer="${xml(layer.id)}" transform="${transform}"${opacity}>`;
  switch (layer.type) {
    case "rect": {
      const r = Math.max(0, Math.min(layer.radius, layer.width / 2, layer.height / 2));
      const stroke = layer.strokeWidth > 0 && layer.stroke !== "transparent" ? ` stroke="${xml(layer.stroke)}" stroke-width="${n(layer.strokeWidth)}"` : "";
      return `${open}<rect x="${n(-layer.width / 2)}" y="${n(-layer.height / 2)}" width="${n(layer.width)}" height="${n(layer.height)}" rx="${n(r)}" fill="${xml(layer.fill)}"${stroke}/></g>`;
    }
    case "ellipse": {
      const stroke = layer.strokeWidth > 0 && layer.stroke !== "transparent" ? ` stroke="${xml(layer.stroke)}" stroke-width="${n(layer.strokeWidth)}"` : "";
      return `${open}<ellipse rx="${n(layer.width / 2)}" ry="${n(layer.height / 2)}" fill="${xml(layer.fill)}"${stroke}/></g>`;
    }
    case "text":
      return `${open}${textMarkup(layer, ctx, `clip-${layer.id}`)}</g>`;
    case "icon": {
      const edge = Math.max(1, Math.round(Math.min(layer.width, layer.height)));
      const svg = iconLayerSvg(layer as IconLayer, edge, `i${layer.id}`);
      if (!svg) throw new Error("An icon in this design could not be loaded.");
      const label = layer.label ? ` role="img" aria-label="${xml(layer.label)}"` : "";
      return `${open}<g transform="translate(${n(-edge / 2)} ${n(-edge / 2)})"${label}>${svg}</g></g>`;
    }
    case "image": {
      const { mime, base64 } = await images(layer.assetId);
      const fit = layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      const clip = `clip-${layer.id}`;
      return `${open}<clipPath id="${clip}"><rect x="${n(-layer.width / 2)}" y="${n(-layer.height / 2)}" width="${n(layer.width)}" height="${n(layer.height)}"/></clipPath><image clip-path="url(#${clip})" x="${n(-layer.width / 2)}" y="${n(-layer.height / 2)}" width="${n(layer.width)}" height="${n(layer.height)}" preserveAspectRatio="${fit}" href="data:${xml(mime)};base64,${base64}"/></g>`;
    }
  }
}

/**
 * Vector export of a whole design. Shapes, text and icons stay vector; library images are embedded as data URIs.
 * Text keeps its font-family names (fonts are not embedded), so it renders with whatever the viewer has installed.
 */
export async function renderDesignSvg(doc: DesignDocument, images: SvgImageSource, ctx: Measurer): Promise<string> {
  const parts: string[] = [];
  if (doc.background !== "transparent") parts.push(`<rect width="${doc.width}" height="${doc.height}" fill="${xml(doc.background)}"/>`);
  for (const layer of doc.layers) if (!layer.hidden) parts.push(await layerMarkup(layer, ctx, images));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${parts.join("")}</svg>`;
}
