import { describe, expect, it } from "vitest";
import {
  BrandKitDocument,
  brandKitToThemePatch,
  createBrandKitDocument,
  createDesignDocument,
  DESIGN_LIMITS,
  DESIGN_PRESETS,
  DesignDocument,
  designAssetIds,
  makeLayer,
  parseProjectDocument,
  PhotoProjectDocument,
  projectAssetIds,
} from "../../src/core/creative/index.js";
import { initialRecipe } from "../../src/core/media/photo.js";

describe("design documents", () => {
  it("creates valid documents for every preset within the pixel budget", () => {
    for (const preset of DESIGN_PRESETS) {
      const doc = createDesignDocument(preset.width, preset.height);
      expect(doc.width * doc.height).toBeLessThanOrEqual(DESIGN_LIMITS.maxPixels);
      expect(DesignDocument.safeParse(doc).success).toBe(true);
    }
  });

  it("adds typed layers with sensible defaults and unique ids", () => {
    const doc = createDesignDocument(1080, 1080);
    const text = makeLayer("text", doc);
    const rect = makeLayer("rect", doc, { fill: "#ff0000" });
    const image = makeLayer("image", doc, { assetId: "lib_abcdef1234" });
    expect(text.type).toBe("text");
    expect(text.type === "text" && text.text).toBe("Your headline");
    expect(rect.type === "rect" && rect.fill).toBe("#ff0000");
    expect(new Set([text.id, rect.id, image.id]).size).toBe(3);
    const full = { ...doc, layers: [text, rect, image] };
    expect(DesignDocument.parse(full).layers).toHaveLength(3);
    expect(designAssetIds(full)).toEqual(["lib_abcdef1234"]);
  });

  it("rejects oversize, duplicate-id, unknown-type and unsafe-colour documents", () => {
    const doc = createDesignDocument(800, 600);
    expect(DesignDocument.safeParse({ ...doc, width: 5000, height: 5000 }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, width: 10 }).success).toBe(false);
    const layer = makeLayer("rect", doc);
    expect(DesignDocument.safeParse({ ...doc, layers: [layer, layer] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...layer, type: "script" }] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...layer, fill: "url(javascript:alert(1))" }] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...makeLayer("image", doc, { assetId: "lib_abcdef1234" }), assetId: "../etc/passwd" }] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, extra: true }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: Array.from({ length: DESIGN_LIMITS.maxLayers + 1 }, () => makeLayer("rect", doc)) }).success).toBe(false);
  });

  it("bounds text layers", () => {
    const doc = createDesignDocument(800, 600);
    const text = makeLayer("text", doc);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...text, text: "x".repeat(DESIGN_LIMITS.maxTextLength + 1) }] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...text, font: "Comic Sans" }] }).success).toBe(false);
    expect(DesignDocument.safeParse({ ...doc, layers: [{ ...text, fontSize: 1000 }] }).success).toBe(false);
  });
});

describe("brand kits", () => {
  it("creates a valid default kit and maps it onto a website theme patch", () => {
    const kit = createBrandKitDocument();
    expect(BrandKitDocument.safeParse(kit).success).toBe(true);
    const patch = brandKitToThemePatch(kit);
    expect(patch.colors).toMatchObject({ primary: "#1f6f4a", accent: "#e0397a", text: "#15201a", background: "#f4f7f5" });
    expect(patch.palette).toHaveLength(4);
    expect(patch.fonts).toEqual({ heading: "Inter", body: "Inter" });
  });

  it("falls back to positional roles when colours are unnamed", () => {
    const kit = { ...createBrandKitDocument(), colors: [{ name: "One", value: "#111111" }, { name: "Two", value: "#222222" }] };
    const patch = brandKitToThemePatch(kit);
    expect(patch.colors).toEqual({ primary: "#111111", accent: "#222222" });
  });

  it("rejects empty palettes, unsafe colours and unknown fonts", () => {
    const kit = createBrandKitDocument();
    expect(BrandKitDocument.safeParse({ ...kit, colors: [] }).success).toBe(false);
    expect(BrandKitDocument.safeParse({ ...kit, colors: [{ name: "x", value: "expression(alert(1))" }] }).success).toBe(false);
    expect(BrandKitDocument.safeParse({ ...kit, fonts: { heading: "Wingdings", body: "Inter" } }).success).toBe(false);
    expect(BrandKitDocument.safeParse({ ...kit, logoAssetId: "not an id" }).success).toBe(false);
  });
});

describe("project documents", () => {
  const info = { mimeType: "image/png" as const, width: 800, height: 600 };
  it("validates photo projects against their source and lists their assets", () => {
    const doc = { schemaVersion: 1, sourceAssetId: "lib_abcdef1234", source: info, recipe: initialRecipe(info) };
    expect(PhotoProjectDocument.parse(doc).recipe.width).toBe(800);
    expect(projectAssetIds("photo", doc)).toEqual(["lib_abcdef1234"]);
    expect(PhotoProjectDocument.safeParse({ ...doc, recipe: { ...doc.recipe, crop: { x: 700, y: 0, width: 200, height: 100 } } }).success).toBe(false);
  });
  it("dispatches on kind and refuses mismatched documents", () => {
    const design = createDesignDocument(640, 480);
    expect(parseProjectDocument("design", design).layers).toEqual([]);
    expect(parseProjectDocument("design-template", design).width).toBe(640);
    expect(() => parseProjectDocument("photo", design)).toThrow();
    expect(() => parseProjectDocument("design", { schemaVersion: 1, sourceAssetId: "lib_abcdef1234", source: info, recipe: initialRecipe(info) })).toThrow();
  });
});
