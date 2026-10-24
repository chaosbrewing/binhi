import { describe, expect, it } from "vitest";
import { inspectRaster, initialRecipe, PHOTO_LIMITS, validateDimensions, validateRecipe } from "../../src/core/media/photo.js";

function png(width = 640, height = 480, animated = false) {
  const bytes = new Uint8Array(animated ? 65 : 45);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width); view.setUint32(20, height);
  if (animated) {
    view.setUint32(33, 8); bytes.set([97, 99, 84, 76], 37);
    bytes.set([73, 69, 78, 68], 57);
  } else bytes.set([73, 69, 78, 68], 37);
  return bytes;
}
function webp(animated = false) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  bytes.set([82, 73, 70, 70]); view.setUint32(4, 22, true);
  bytes.set([87, 69, 66, 80, 86, 80, 56, 88], 8);
  view.setUint32(16, 10, true);
  bytes[20] = animated ? 2 : 0;
  bytes[24] = 99; bytes[27] = 49;
  return bytes;
}

describe("bounded raster input validation", () => {
  it("reads PNG dimensions from bytes rather than the extension", () => {
    expect(inspectRaster(png())).toEqual({ mimeType: "image/png", width: 640, height: 480 });
  });
  it("reads a JPEG SOF safely", () => {
    const jpeg = new Uint8Array([255, 216, 255, 192, 0, 8, 8, 0, 100, 0, 200, 0, 255, 217]);
    expect(inspectRaster(jpeg)).toEqual({ mimeType: "image/jpeg", width: 200, height: 100 });
  });
  it("reads static extended WebP", () => {
    expect(inspectRaster(webp())).toEqual({ mimeType: "image/webp", width: 100, height: 50 });
  });
  it("rejects animated WebP and PNG rather than silently losing frames", () => {
    expect(() => inspectRaster(webp(true))).toThrow("Animated");
    expect(() => inspectRaster(png(640, 480, true))).toThrow("Animated");
  });
  it("rejects invalid, zero-sized, oversize and huge-pixel inputs", () => {
    for (const value of [new Uint8Array(0), new Uint8Array(20), png(0, 100), png(8193, 1), png(5000, 5000), new Uint8Array(PHOTO_LIMITS.inputBytes + 1)]) {
      expect(() => inspectRaster(value)).toThrow();
    }
  });
  it("rejects SVG, executable bytes and GIF", () => {
    for (const value of ["<svg onload='alert(1)'></svg>", "MZ executable content", "GIF89a123456789012345"]) {
      expect(() => inspectRaster(new TextEncoder().encode(value))).toThrow("Unsupported");
    }
  });
  it("rejects truncated PNG, malformed JPEG markers and invalid WebP lengths", () => {
    const truncated = png(); new DataView(truncated.buffer).setUint32(8, 1000);
    const malformed = webp(); malformed[4] = 1;
    expect(() => inspectRaster(truncated)).toThrow("truncated");
    expect(() => inspectRaster(malformed)).toThrow("length");
    expect(() => inspectRaster(new Uint8Array([255, 216, 255, 224, 0, 1, 0, 0]))).toThrow();
  });
});

describe("non-destructive photo recipes", () => {
  const info = { mimeType: "image/png" as const, width: 800, height: 600 };
  it("preserves the original crop and uses neutral adjustments", () => {
    const initial = initialRecipe(info);
    expect(initial.crop).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(initial.brightness).toBe(100);
    expect(initialRecipe({ ...info, width: 8000, height: 1000 }).width).toBe(4096);
  });
  it("validates a bounded crop, transform and resize without mutating the source", () => {
    const recipe = { ...initialRecipe(info), crop: { x: 30, y: 50, width: 200, height: 100 }, rotation: 90, width: 100, height: 200 };
    expect(validateRecipe(recipe, info).rotation).toBe(90);
    expect(info).toEqual({ mimeType: "image/png", width: 800, height: 600 });
  });
  it("rejects out-of-source crops, invalid adjustments, transforms and outputs", () => {
    for (const patch of [
      { crop: { x: 700, y: 0, width: 200, height: 100 } },
      { crop: { x: -1, y: 0, width: 10, height: 10 } },
      { width: 0 }, { width: 4097 }, { width: 4096, height: 4096 },
      { height: Infinity }, { rotation: 45 }, { saturation: 201 }, { brightness: NaN },
    ]) expect(() => validateRecipe({ ...initialRecipe(info), ...patch }, info)).toThrow();
  });
  it("distinguishes input and output pixel limits", () => {
    expect(() => validateDimensions(8192, 1000)).not.toThrow();
    expect(() => validateDimensions(8192, 1000, true)).toThrow();
  });
});
