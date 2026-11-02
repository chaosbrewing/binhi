import { describe, expect, it } from "vitest";
import { CATALOG, DESIGN_CONTENT, applyBrandKitToDesign, brandRoles, contrastRatio, parseDesignContent } from "../../src/core/templates/library/index.js";
import { Design } from "../../src/core/templates/library/catalog/designs/dsl.js";
import { BrandKitDocument } from "../../src/core/creative/brandKit.js";

const kit = (over: Partial<BrandKitDocument> = {}): BrandKitDocument =>
  BrandKitDocument.parse({
    schemaVersion: 1,
    colors: [{ name: "Primary", value: "#7c3aed" }, { name: "Accent", value: "#f97316" }, { name: "Ink", value: "#111827" }, { name: "Paper", value: "#fafaf9" }],
    fonts: { heading: "Lora", body: "DM Sans" },
    logoAssetId: null,
    tagline: "",
    ...over,
  });

function sample() {
  const d = new Design(1000, 1000, "#ffffff", "sample", "paper");
  d.rect(0, 0, 1000, 500, "#1f4e79", { name: "Band", bind: { fill: "primary" } });
  d.text("On the band", 40, 100, 600, 80, { size: 60, color: "#ffffff", name: "Band text", bind: { color: "paper", font: "heading" } });
  d.text("Unbound note", 40, 700, 600, 60, { size: 40, color: "#444444", name: "Note" });
  d.photo(40, 800, 400, 150, { label: "Photo" });
  d.logoSlot(800, 40, 160, 80);
  return parseDesignContent(d.toContent());
}

describe("brand roles", () => {
  it("reads roles by name and falls back by position and brightness", () => {
    expect(brandRoles(kit())).toMatchObject({ primary: "#7c3aed", accent: "#f97316", ink: "#111827", paper: "#fafaf9", heading: "Lora", body: "DM Sans" });
    const unnamed = brandRoles(kit({ colors: [{ name: "A", value: "#0000ff" }, { name: "B", value: "#ffcc00" }, { name: "C", value: "#ffffff" }, { name: "D", value: "#101010" }] }));
    expect(unnamed.primary).toBe("#0000ff");
    expect(unnamed.accent).toBe("#ffcc00");
    expect(unnamed.ink).toBe("#101010");
    expect(unnamed.paper).toBe("#ffffff");
    const single = brandRoles(kit({ colors: [{ name: "Only", value: "#336699" }] }));
    expect([single.primary, single.accent]).toEqual(["#336699", "#336699"]);
  });
});

describe("applying a brand kit to a design template", () => {
  it("recolours and re-fonts only the bound layers", () => {
    const content = sample();
    const { document, changes } = applyBrandKitToDesign(content, kit());
    const byName = (n: string) => document.layers.find((l) => l.name === n)!;
    expect(document.background).toBe("#fafaf9");
    expect(byName("Band")).toMatchObject({ fill: "#7c3aed" });
    expect(byName("Band text")).toMatchObject({ color: "#fafaf9", font: "Lora" });
    // Unbound layers are untouched.
    expect(byName("Note")).toEqual(content.document.layers.find((l) => l.name === "Note"));
    expect(byName("Photo frame")).toEqual(content.document.layers.find((l) => l.name === "Photo frame"));
    expect(changes.map((c) => c.what).sort()).toEqual(["background", "fill", "font", "text colour"]);
  });

  it("never mutates the shared template content", () => {
    const content = sample();
    const snapshot = JSON.stringify(content);
    applyBrandKitToDesign(content, kit());
    expect(JSON.stringify(content)).toBe(snapshot);
    for (const [key, c] of Object.entries(DESIGN_CONTENT)) {
      const before = JSON.stringify(c);
      applyBrandKitToDesign(parseDesignContent(c), kit());
      expect(JSON.stringify(c), key).toBe(before);
    }
  });

  it("is deterministic and idempotent", () => {
    const content = sample();
    const a = applyBrandKitToDesign(content, kit());
    const b = applyBrandKitToDesign(content, kit());
    expect(b).toEqual(a);
    // Applying the same kit to a template that already matches changes nothing.
    const again = applyBrandKitToDesign({ document: a.document, brand: content.brand }, kit());
    expect(again.changes).toEqual([]);
    expect(again.document).toEqual(a.document);
  });

  it("keeps text readable when a kit would make it unreadable", () => {
    const content = sample();
    // Pale primary behind white text would be ~1.2:1.
    const result = applyBrandKitToDesign(content, kit({ colors: [{ name: "Primary", value: "#fef9c3" }, { name: "Accent", value: "#fde68a" }, { name: "Ink", value: "#111827" }, { name: "Paper", value: "#ffffff" }] }));
    const text = result.document.layers.find((l) => l.name === "Band text")!;
    expect(text.type === "text" && contrastRatio(text.color, "#fef9c3")!).toBeGreaterThanOrEqual(3);
    expect(result.adjustments.some((a) => a.startsWith("Band text"))).toBe(true);
  });

  it("does not adjust text whose contrast was already low in the template", () => {
    const d = new Design(400, 400, "#ffffff", "low", "paper");
    d.text("Faint by design", 20, 20, 300, 50, { size: 30, color: "#cccccc", name: "Faint", bind: { font: "body" } });
    const result = applyBrandKitToDesign(parseDesignContent(d.toContent()), kit());
    expect(result.adjustments).toEqual([]);
  });

  it("places the logo only where the template reserves a slot and the kit has a logo", () => {
    const content = sample();
    expect(applyBrandKitToDesign(content, kit()).logoPlaced).toBe(false);
    const withLogo = applyBrandKitToDesign(content, kit({ logoAssetId: "ast_logo123456" }));
    expect(withLogo.logoPlaced).toBe(true);
    const logo = withLogo.document.layers[withLogo.document.layers.length - 1]!;
    expect(logo).toMatchObject({ type: "image", assetId: "ast_logo123456", x: 800, y: 40, width: 160, height: 80, fit: "contain" });
    expect(applyBrandKitToDesign(content, kit({ logoAssetId: "ast_logo123456" }), { placeLogo: false }).logoPlaced).toBe(false);
    const d = new Design(400, 400, "#fff", "noslot");
    d.text("No logo slot here", 10, 10, 300, 50, { size: 30 });
    expect(applyBrandKitToDesign(parseDesignContent(d.toContent()), kit({ logoAssetId: "ast_logo123456" })).logoPlaced).toBe(false);
  });

  it("produces a valid document for every shipped design template, with every kit shape", () => {
    const kits = [kit(), kit({ colors: [{ name: "Only", value: "#336699" }], logoAssetId: "ast_logo123456" }), kit({ colors: [{ name: "Dark", value: "#0a0a0a" }, { name: "Mid", value: "#777777" }, { name: "Light", value: "#f0f0f0" }] })];
    for (const m of CATALOG) {
      if (m.content.type !== "builtin-design") continue;
      const content = parseDesignContent(DESIGN_CONTENT[m.content.key]);
      for (const k of kits) {
        const result = applyBrandKitToDesign(content, k);
        expect(result.document.layers.length, m.id).toBeGreaterThanOrEqual(content.document.layers.length);
        expect(result.document.width).toBe(content.document.width);
        // Every text layer stays at least as readable as 3:1 wherever it was before.
        result.document.layers.forEach((l, i) => {
          if (l.type !== "text" || i >= content.document.layers.length) return;
          expect(l.text).toBe((content.document.layers[i] as { text: string }).text);
        });
      }
    }
  });
});
