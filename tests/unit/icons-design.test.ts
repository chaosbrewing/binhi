import { beforeAll, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { DesignDocument, createDesignDocument, designIconIds, makeLayer, parseProjectDocument, projectAssetIds, type DesignLayer } from "../../src/core/creative/index.js";
import { loadIconShapes } from "../../src/core/icons/index.js";
import { renderDesignSvg } from "../../src/client/studio/design/exportSvg.js";
import { iconLayerSvg } from "../../src/client/studio/design/renderDesign.js";

const doc = createDesignDocument(1080, 1080);
const iconLayer = (extra: Record<string, unknown> = {}) => makeLayer("icon", doc, { icon: "binhi.icon.camera", ...extra });
const measure = { font: "", measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };

beforeAll(async () => {
  await loadIconShapes(["binhi.icon.camera", "binhi.icon.heart", "binhi.icon.star"]);
});

describe("design icon layer", () => {
  it("is an editable vector element with sensible defaults", () => {
    const layer = iconLayer();
    expect(layer).toMatchObject({ type: "icon", icon: "binhi.icon.camera", variant: "outline", strokeWidth: 2, flipX: false, flipY: false, rotation: 0, opacity: 1, locked: false, hidden: false, label: "" });
    expect(layer.width).toBe(layer.height);
    const full = DesignDocument.parse({ ...doc, layers: [layer] });
    expect(designIconIds(full)).toEqual(["binhi.icon.camera"]);
    // icons are not library assets: no usage tracking, no delete protection involved
    expect(projectAssetIds("design", full)).toEqual([]);
  });

  it("supports position, size, rotation, opacity, lock, hide, flip, colour, stroke and gradient", () => {
    const layer = iconLayer({ x: 10, y: 20, width: 300, height: 300, rotation: 45, opacity: 0.5, locked: true, hidden: true, flipX: true, flipY: true, color: "#112233", strokeWidth: 3, variant: "duotone", gradient: { from: "#ff0000", to: "#0000ff", angle: 90 } });
    expect(layer).toMatchObject({ x: 10, y: 20, width: 300, rotation: 45, opacity: 0.5, locked: true, hidden: true, flipX: true, flipY: true, color: "#112233", strokeWidth: 3, variant: "duotone" });
    expect(parseProjectDocument("design", { ...doc, layers: [layer] })).toBeTruthy();
  });

  it("rejects unknown ids, unsupported variants, unsafe colours, markup fields and malformed values", () => {
    const base = iconLayer();
    const bad = (patch: Record<string, unknown>) => DesignDocument.safeParse({ ...doc, layers: [{ ...base, ...patch }] }).success;
    expect(bad({ icon: "binhi.icon.nope" })).toBe(false);
    expect(bad({ icon: "../../etc/passwd" })).toBe(false);
    expect(bad({ icon: '<svg onload="x">' })).toBe(false);
    expect(bad({ variant: "filled" })).toBe(false); // camera has no filled variant
    expect(bad({ variant: "wobbly" })).toBe(false);
    expect(bad({ color: "url(javascript:alert(1))" })).toBe(false);
    expect(bad({ strokeWidth: 20 })).toBe(false);
    expect(bad({ gradient: { from: "#fff", to: "calc(1)", angle: 0 } })).toBe(false);
    expect(bad({ label: "x".repeat(201) })).toBe(false);
    expect(bad({ icon: undefined })).toBe(false);
    expect(bad({})).toBe(true);
  });

  it("duplicates and pastes as a valid layer (also into another design)", () => {
    const source = iconLayer({ variant: "duotone", color: "#336699" });
    const copy = makeLayer(source.type, doc, { ...source, id: undefined, x: source.x + 24, y: source.y + 24, name: "" });
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ icon: "binhi.icon.camera", variant: "duotone", color: "#336699" });
    const other = createDesignDocument(800, 600);
    const pasted = makeLayer("icon", other, { ...source, id: undefined });
    expect(DesignDocument.safeParse({ ...other, layers: [pasted] }).success).toBe(true);
    expect(DesignDocument.safeParse({ ...doc, layers: [source, copy] }).success).toBe(true);
  });

  it("keeps template-style copies valid by round-tripping through JSON", () => {
    const full = DesignDocument.parse({ ...doc, layers: [iconLayer({ icon: "binhi.icon.heart", variant: "filled" }), makeLayer("rect", doc)] });
    expect(DesignDocument.parse(JSON.parse(JSON.stringify(full)))).toEqual(full);
  });
});

describe("design icon rendering", () => {
  it("produces the same SVG the website renderer uses, at the layer's on-canvas size", () => {
    const layer = iconLayer({ width: 200, height: 120, color: "#336699", strokeWidth: 3 }) as Extract<DesignLayer, { type: "icon" }>;
    const svg = iconLayerSvg(layer, 120, "t");
    expect(svg).toContain('width="120"');
    expect(svg).toContain('stroke="#336699"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).not.toMatch(/<script|onload|href/);
  });

  it("exports an SVG that keeps icons, shapes and text as vectors and is well-formed", async () => {
    const full = DesignDocument.parse({
      ...doc,
      background: "#ffffff",
      layers: [
        iconLayer({ rotation: 30, opacity: 0.8, flipX: true, variant: "duotone", color: "#336699", label: "Camera icon" }),
        iconLayer({ icon: "binhi.icon.heart", variant: "filled", hidden: true }),
        makeLayer("rect", doc),
        makeLayer("text", doc, { text: 'Fish & "chips" <3' }),
      ],
    });
    const svg = await renderDesignSvg(full, async () => ({ mime: "image/png", base64: "AAAA" }), measure);
    const xml = new JSDOM(svg, { contentType: "image/svg+xml" }).window.document;
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('data-layer="' + full.layers[0]!.id + '"');
    expect(svg).toContain("rotate(30)");
    expect(svg).toContain('aria-label="Camera icon"');
    expect(svg).toContain("<path");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;3");
    expect(svg).not.toContain(full.layers[1]!.id); // hidden layers are not exported
    expect(svg).not.toMatch(/<script|foreignObject|onload=|javascript:/);
    expect(svg).not.toContain("<image"); // no raster layers here
  });

  it("embeds library images as data URIs and still avoids scripts", async () => {
    const full = DesignDocument.parse({ ...doc, layers: [makeLayer("image", doc, { assetId: "lib_abcdef1234" })] });
    const svg = await renderDesignSvg(full, async (id) => ({ mime: "image/png", base64: id === "lib_abcdef1234" ? "iVBORw0KGgo=" : "" }), measure);
    expect(svg).toContain('href="data:image/png;base64,iVBORw0KGgo="');
    expect(new JSDOM(svg, { contentType: "image/svg+xml" }).window.document.querySelector("parsererror")).toBeNull();
  });

  it("fails clearly when an icon's geometry is unavailable", async () => {
    const full = DesignDocument.parse({ ...doc, layers: [iconLayer({ icon: "binhi.icon.leaf" })] });
    await expect(renderDesignSvg(full, async () => ({ mime: "image/png", base64: "" }), measure)).rejects.toThrow(/could not be loaded/);
  });
});
