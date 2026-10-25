import { fontStack, type DesignDocument, type DesignLayer, type TextLayer } from "../../../core/creative/index.js";
import { inspectRaster, PHOTO_LIMITS, type RasterMime } from "../../../core/media/photo.js";

export type ImageSource = (assetId: string) => Promise<ImageBitmap>;

/** Word-wrap a text layer the same way the DOM preview does (pre-wrap, break on spaces, hard newlines kept). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -h / 2);
  ctx.lineTo(w / 2 - r, -h / 2);
  ctx.arcTo(w / 2, -h / 2, w / 2, -h / 2 + r, r);
  ctx.lineTo(w / 2, h / 2 - r);
  ctx.arcTo(w / 2, h / 2, w / 2 - r, h / 2, r);
  ctx.lineTo(-w / 2 + r, h / 2);
  ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - r, r);
  ctx.lineTo(-w / 2, -h / 2 + r);
  ctx.arcTo(-w / 2, -h / 2, -w / 2 + r, -h / 2, r);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${fontStack(layer.font)}`;
  ctx.fillStyle = layer.color;
  ctx.textBaseline = "alphabetic";
  const lines = wrapText(ctx, layer.text, layer.width);
  const lineHeight = layer.fontSize * layer.lineHeight;
  const ascentPad = layer.fontSize * 0.8 + (lineHeight - layer.fontSize) / 2;
  lines.forEach((line, i) => {
    const y = -layer.height / 2 + i * lineHeight + ascentPad;
    const width = ctx.measureText(line).width;
    const x = layer.align === "left" ? -layer.width / 2 : layer.align === "right" ? layer.width / 2 - width : -width / 2;
    ctx.fillText(line, x, y);
  });
}

async function drawLayer(ctx: CanvasRenderingContext2D, layer: DesignLayer, images: ImageSource) {
  if (layer.hidden) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.type === "rect" || layer.type === "ellipse") {
    if (layer.type === "rect") roundedRectPath(ctx, layer.width, layer.height, layer.radius);
    else {
      ctx.beginPath();
      ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = layer.fill;
    ctx.fill();
    if (layer.strokeWidth > 0 && layer.stroke !== "transparent") {
      ctx.lineWidth = layer.strokeWidth;
      ctx.strokeStyle = layer.stroke;
      ctx.stroke();
    }
  } else if (layer.type === "text") {
    ctx.beginPath();
    ctx.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
    ctx.clip();
    drawText(ctx, layer);
  } else if (layer.type === "image") {
    const bitmap = await images(layer.assetId);
    try {
      const scale = layer.fit === "cover" ? Math.max(layer.width / bitmap.width, layer.height / bitmap.height) : Math.min(layer.width / bitmap.width, layer.height / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.beginPath();
      ctx.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
    } finally {
      bitmap.close();
    }
  }
  ctx.restore();
}

/**
 * Render a design to a verified PNG/JPEG blob. The whole document is drawn
 * at its native pixel size; the result is re-inspected so the reported
 * type and dimensions always describe the actual bytes.
 */
export async function renderDesign(doc: DesignDocument, mimeType: RasterMime, quality: number, images: ImageSource): Promise<Blob> {
  if (typeof document.fonts?.load === "function") {
    await Promise.all(Array.from(new Set(doc.layers.flatMap((l) => (l.type === "text" ? [`${l.fontWeight} ${l.fontSize}px ${fontStack(l.font)}`] : [])))).map((f) => document.fonts.load(f).catch(() => [])));
  }
  const canvas = document.createElement("canvas");
  canvas.width = doc.width;
  canvas.height = doc.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support the required image canvas.");
  try {
    if (mimeType === "image/jpeg" || doc.background !== "transparent") {
      ctx.fillStyle = mimeType === "image/jpeg" && doc.background === "transparent" ? "#ffffff" : doc.background;
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
    for (const layer of doc.layers) await drawLayer(ctx, layer, images);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((v) => (v ? resolve(v) : reject(new Error("The browser could not encode this design."))), mimeType, quality));
    if (blob.type !== mimeType) throw new Error(`Your browser cannot export ${mimeType}.`);
    if (blob.size <= PHOTO_LIMITS.inputBytes) {
      const info = inspectRaster(new Uint8Array(await blob.arrayBuffer()));
      if (info.mimeType !== mimeType || info.width !== doc.width || info.height !== doc.height) throw new Error("Export verification failed: type or dimensions did not match.");
    }
    return blob;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

/** Image loader for the private asset library (same-origin, session cookie). */
export async function libraryImageSource(assetId: string): Promise<ImageBitmap> {
  const res = await fetch(`/api/library/${assetId}/file`, { credentials: "same-origin", headers: { "x-binhi-request": "editor" } });
  if (!res.ok) throw new Error("An image in this design is no longer in your asset library.");
  return createImageBitmap(await res.blob());
}
