import { z } from "zod";

export const PHOTO_LIMITS = {
  inputBytes: 8 * 1024 * 1024,
  sourcePixels: 16_000_000,
  sourceDimension: 8192,
  outputPixels: 16_000_000,
  outputDimension: 4096,
} as const;
export const RasterMime = z.enum(["image/png", "image/jpeg", "image/webp"]);
export type RasterMime = z.infer<typeof RasterMime>;
export type RasterInfo = { mimeType: RasterMime; width: number; height: number };
export const PhotoRecipe = z.object({
  crop: z.object({
    x: z.number().int().min(0), y: z.number().int().min(0),
    width: z.number().int().positive(), height: z.number().int().positive(),
  }),
  width: z.number().int().min(1).max(PHOTO_LIMITS.outputDimension),
  height: z.number().int().min(1).max(PHOTO_LIMITS.outputDimension),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  flipX: z.boolean(), flipY: z.boolean(),
  brightness: z.number().min(0).max(200),
  contrast: z.number().min(0).max(200),
  saturation: z.number().min(0).max(200),
});
export type PhotoRecipe = z.infer<typeof PhotoRecipe>;

export function validateDimensions(width: number, height: number, output = false): void {
  const edge = output ? PHOTO_LIMITS.outputDimension : PHOTO_LIMITS.sourceDimension;
  const pixels = output ? PHOTO_LIMITS.outputPixels : PHOTO_LIMITS.sourcePixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > edge || height > edge || width * height > pixels) {
    throw new Error(`Image dimensions exceed the ${edge}px edge / ${pixels / 1_000_000} megapixel limit.`);
  }
}

/** Inspect bounded bytes before allocating any browser image/canvas. Never trusts file extensions. */
export function inspectRaster(bytes: Uint8Array): RasterInfo {
  if (!bytes.length || bytes.length > PHOTO_LIMITS.inputBytes) throw new Error("Choose an image no larger than 8 MiB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (a: number, b: number) => String.fromCharCode(...bytes.subarray(a, b));
  let info: RasterInfo | undefined;
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) && text(12, 16) === "IHDR") {
    info = { mimeType: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (text(offset + 4, offset + 8) === "acTL") throw new Error("Animated PNG is not supported. Choose a static image.");
      if (offset + length + 12 > bytes.length) throw new Error("The PNG file is truncated.");
      offset += length + 12;
    }
  } else if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") {
    const chunk = text(12, 16);
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new Error("The WebP file length is invalid.");
    if (chunk === "VP8X") {
      if ((bytes[20]! & 2) !== 0) throw new Error("Animated WebP is not supported. Choose a static image.");
      const uint24 = (i: number) => bytes[i]! | bytes[i + 1]! << 8 | bytes[i + 2]! << 16;
      info = { mimeType: "image/webp", width: uint24(24) + 1, height: uint24(27) + 1 };
    } else if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      info = { mimeType: "image/webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    } else if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      info = { mimeType: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker.");
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++]!;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error("The JPEG file is truncated.");
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) throw new Error("Invalid JPEG dimensions.");
        info = { mimeType: "image/jpeg", width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
        break;
      }
      offset += length;
    }
  }
  if (!info) throw new Error("Unsupported or invalid image. Choose PNG, JPEG or static WebP; SVG, GIF, HEIC, PDF and executable files are not supported.");
  validateDimensions(info.width, info.height);
  return info;
}

export function initialRecipe(info: RasterInfo): PhotoRecipe {
  const scale = Math.min(1, PHOTO_LIMITS.outputDimension / info.width, PHOTO_LIMITS.outputDimension / info.height);
  return {
    crop: { x: 0, y: 0, width: info.width, height: info.height },
    width: Math.max(1, Math.round(info.width * scale)), height: Math.max(1, Math.round(info.height * scale)),
    rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100,
  };
}

export function validateRecipe(value: unknown, info: RasterInfo): PhotoRecipe {
  const result = PhotoRecipe.safeParse(value);
  if (!result.success) throw new Error("Use valid crop values, 1–4096px output dimensions, and adjustments between 0 and 200.");
  const recipe = result.data;
  if (recipe.crop.x + recipe.crop.width > info.width || recipe.crop.y + recipe.crop.height > info.height) throw new Error("The crop must stay inside the original image.");
  validateDimensions(recipe.width, recipe.height, true);
  return recipe;
}
