import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  ICON_CATEGORIES,
  ICON_COUNT,
  ICON_LIST,
  ICON_SIZE_PRESETS,
  IconRegistryError,
  buildRegistry,
  getIcon,
  getIconByNumber,
  hasIcon,
  iconNodeProblem,
  iconProblem,
  iconSupportsVariant,
  isClosedNode,
  renderIconSvg,
  searchIcons,
  type IconNode,
} from "../../src/core/icons/index.js";
import { CATALOG_ENTRIES } from "../../src/core/icons/generated/catalog.js";
import { ALL_ICON_SHAPES } from "../../src/core/icons/shapes-all.js";
import { ensureCategoryLoaded, getLoadedShape, loadIconShape } from "../../src/core/icons/shapes.js";

const parse = (svg: string) => new JSDOM(svg, { contentType: "image/svg+xml" }).window.document;

describe("icon registry integrity", () => {
  it("has exactly 250 icons in 25 categories of 10, numbered 1–250 in order", () => {
    expect(ICON_LIST).toHaveLength(ICON_COUNT);
    expect(ICON_CATEGORIES).toHaveLength(25);
    for (const cat of ICON_CATEGORIES) expect(cat.icons).toHaveLength(10);
    expect(ICON_LIST.map((d) => d.number)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
    expect(getIconByNumber(1)?.name).toBe("Home");
    expect(getIconByNumber(12)?.name).toBe("Delete / Trash");
    expect(getIconByNumber(250)?.name).toBe("Verified Badge");
  });

  it("uses canonical, unique, stable ids", () => {
    const ids = ICON_LIST.map((d) => d.id);
    expect(new Set(ids).size).toBe(250);
    for (const id of ids) expect(id).toMatch(/^binhi\.icon\.[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(getIcon("binhi.icon.camera")?.name).toBe("Camera");
    expect(hasIcon("binhi.icon.camera")).toBe(true);
    expect(hasIcon("binhi.icon.nope")).toBe(false);
    expect(hasIcon(42)).toBe(false);
  });

  it("keeps the fixed category names", () => {
    expect(ICON_CATEGORIES.map((c) => c.name)).toEqual([
      "Navigation and Interface",
      "Editing and Actions",
      "Selection and Transformation",
      "Alignment and Distribution",
      "Layers and Object Management",
      "Typography and Text",
      "Photo Editing and Adjustments",
      "Photo Effects and Retouching",
      "Colors, Fills and Styles",
      "Shapes and Drawing",
      "Website Structure and Layout",
      "Website Elements",
      "Media and Assets",
      "File Conversion and Compression",
      "Devices and Responsive Preview",
      "Publishing and Web Operations",
      "Forms and Input Elements",
      "Communication and Social",
      "Business and Commerce",
      "People and Identity",
      "Time, Events and Productivity",
      "Maps, Places and Travel",
      "Creative, Art and Entertainment",
      "Nature, Lifestyle and Wellness",
      "Status, Feedback and Security",
    ]);
  });

  it("records source, licence, a11y, viewBox and version for every icon", () => {
    for (const d of ICON_LIST) {
      expect(["lucide", "original"]).toContain(d.source.kind);
      expect(d.licence.spdx).toBeTruthy();
      expect(d.licence.holder).toBeTruthy();
      expect(d.viewBox).toBe("0 0 24 24");
      expect(d.a11y.defaultLabel).toBe(d.name);
      expect(d.version).toBe(1);
      expect(d.keywords.length).toBeGreaterThan(0);
      expect(d.variants[0]).toBe("outline");
    }
    expect(ICON_LIST.filter((d) => d.source.kind === "original").map((d) => d.name).sort()).toEqual([
      "Color Swatches",
      "Landscape Orientation",
      "Opacity",
      "Portrait Orientation",
      "Tabs",
    ]);
    expect(ICON_LIST.filter((d) => d.source.kind === "lucide").every((d) => d.licence.spdx === "ISC")).toBe(true);
  });

  it("rejects duplicate ids, numbering gaps and wrong totals", () => {
    const dup = CATALOG_ENTRIES.map((e, i) => (i === 5 ? { ...e, slug: CATALOG_ENTRIES[4]!.slug } : e));
    expect(() => buildRegistry(dup)).toThrow(IconRegistryError);
    expect(() => buildRegistry(CATALOG_ENTRIES.slice(1))).toThrow(/expected 250/);
    const gap = CATALOG_ENTRIES.map((e, i) => (i === 10 ? { ...e, n: 99 } : e));
    expect(() => buildRegistry(gap)).toThrow(/numbering/);
    const badCat = CATALOG_ENTRIES.map((e, i) => (i === 0 ? { ...e, cat: "nope" } : e));
    expect(() => buildRegistry(badCat)).toThrow(/unknown category/);
    expect(() => buildRegistry()).not.toThrow();
  });
});

describe("icon geometry", () => {
  it("resolves every registry id to geometry and every geometry to a registry id", () => {
    for (const d of ICON_LIST) expect(ALL_ICON_SHAPES[d.id], d.id).toBeDefined();
    expect(Object.keys(ALL_ICON_SHAPES).sort()).toEqual(ICON_LIST.map((d) => d.id).sort());
  });

  it("passes the safety allowlist and stays inside the 24×24 grid", () => {
    for (const [id, nodes] of Object.entries(ALL_ICON_SHAPES)) {
      expect(iconProblem(nodes), id).toBeNull();
      const svg = renderIconSvg(nodes);
      const numbers = [...svg.matchAll(/(?:\s|=")(-?\d+\.?\d*)(?=[\s",])/g)].map((m) => Number(m[1]));
      expect(numbers.every((n) => Number.isFinite(n)), id).toBe(true);
    }
  });

  it("has no two identical glyphs", () => {
    const seen = new Map<string, string>();
    for (const [id, nodes] of Object.entries(ALL_ICON_SHAPES)) {
      const key = JSON.stringify(nodes);
      expect(seen.get(key), `${id} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("renders well-formed SVG with only allowlisted elements and attributes", () => {
    const tags = new Set(["svg", "g", "defs", "linearGradient", "stop", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
    for (const [id, nodes] of Object.entries(ALL_ICON_SHAPES)) {
      for (const variant of ["outline", "duotone", "inverted"] as const) {
        const doc = parse(renderIconSvg(nodes, { variant, label: "x", gradient: { from: "#fff", to: "#000", angle: 30 } }));
        expect(doc.querySelector("parsererror"), `${id} ${variant}`).toBeNull();
        for (const el of doc.querySelectorAll("*")) {
          expect(tags.has(el.localName), `${id}: <${el.localName}>`).toBe(true);
          for (const a of el.getAttributeNames()) expect(a.startsWith("on") || a.includes("href"), `${id}: ${a}`).toBe(false);
        }
      }
    }
  });

  it("derives duotone support from closed shapes and keeps the generated flags honest", () => {
    for (const e of CATALOG_ENTRIES) {
      const nodes = ALL_ICON_SHAPES[`binhi.icon.${e.slug}`] as readonly IconNode[];
      const closed = nodes.some((n) => n[1].fill !== "currentColor" && isClosedNode(n));
      expect(e.d === 1, e.slug).toBe(closed);
      expect(iconSupportsVariant(`binhi.icon.${e.slug}`, "duotone")).toBe(closed);
      expect(iconSupportsVariant(`binhi.icon.${e.slug}`, "filled")).toBe(e.f === 1);
      expect(iconSupportsVariant(`binhi.icon.${e.slug}`, "inverted")).toBe(true);
    }
  });

  it("loads category chunks lazily through the same geometry the server uses", async () => {
    expect(getLoadedShape("binhi.icon.camera")).toBeUndefined();
    const nodes = await loadIconShape("binhi.icon.camera");
    expect(nodes).toEqual(ALL_ICON_SHAPES["binhi.icon.camera"]);
    expect(getLoadedShape("binhi.icon.camera")).toBeDefined();
    expect(await loadIconShape("binhi.icon.not-real")).toBeUndefined();
    await expect(ensureCategoryLoaded("nope")).rejects.toThrow();
  });
});

describe("icon renderer", () => {
  const star = ALL_ICON_SHAPES["binhi.icon.star"] as readonly IconNode[];

  it("is decorative by default and meaningful when labelled (escaped)", () => {
    expect(renderIconSvg(star)).toContain('aria-hidden="true"');
    const labelled = renderIconSvg(star, { label: 'Rate "5" <b>' });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Rate &quot;5&quot; &lt;b&gt;"');
    expect(labelled).not.toContain("<b>");
  });

  it("applies size, stroke weight, colour, rotation and flips; clamps junk", () => {
    const svg = renderIconSvg(star, { size: 48, strokeWidth: 1.5, color: "#ff0000", rotation: 90, flipX: true });
    expect(svg).toContain('width="48"');
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain("rotate(90)");
    expect(svg).toContain("scale(-1 1)");
    const junk = renderIconSvg(star, { size: 99999, strokeWidth: -4, rotation: Number.NaN });
    expect(junk).toContain('width="400"');
    expect(junk).toContain('stroke-width="0.5"');
    expect(junk).not.toContain("rotate(");
    for (const preset of ICON_SIZE_PRESETS) expect(renderIconSvg(star, { size: preset })).toContain(`width="${preset}"`);
  });

  it("refuses unsafe colours and gradient stops", () => {
    expect(renderIconSvg(star, { color: 'red" onload="alert(1)' })).toContain('stroke="currentColor"');
    expect(renderIconSvg(star, { color: "url(http://evil/x)" })).toContain('stroke="currentColor"');
    const g = renderIconSvg(star, { gradient: { from: "#fff", to: "javascript:1", angle: 10 } });
    expect(g).not.toContain("linearGradient");
    const ok = renderIconSvg(star, { gradient: { from: "#fff", to: "#000", angle: 10 }, idPrefix: 'a"b c' });
    expect(ok).toContain('id="abc-g"');
    expect(ok).toContain('stroke="url(#abc-g)"');
  });

  it("supports duotone, filled (when listed) and inverted variants", () => {
    const duo = renderIconSvg(star, { variant: "duotone" });
    expect(duo).toContain('fill-opacity="0.22"');
    const inv = renderIconSvg(star, { variant: "inverted", color: "#336699", inverseColor: "#ffffff" });
    expect(inv).toContain('<rect width="24" height="24" rx="5.5" fill="#336699"');
    expect(inv).toContain('stroke="#ffffff"');
    expect(renderIconSvg(star, { variant: "filled" })).toContain('fill="currentColor"');
  });

  it("drops nodes that fail the allowlist instead of rendering them", () => {
    const evil = [["path", { d: "M0 0L1 1" }], ["script", { src: "x" }], ["path", { d: "M0 0<script>" }], ["circle", { cx: 1, cy: 1, r: 1, onload: "x" }]] as unknown as IconNode[];
    const svg = renderIconSvg(evil);
    expect(svg).toContain("M0 0L1 1");
    expect(svg).not.toMatch(/script|onload/);
  });
});

describe("icon safety allowlist", () => {
  it.each([
    [["script", { src: "x" }], "not allowed"],
    [["path", { d: "M0 0", onclick: "x" }], "not allowed"],
    [["path", { d: "M0 0 <svg onload=1>" }], "illegal"],
    [["path", { d: "url(#x)" }], "illegal"],
    [["circle", { cx: "1", cy: "1", r: "calc(1px)" }], "number"],
    [["rect", { x: 0, y: 0, width: 1, height: 1, style: "x" }], "not allowed"],
    [["path", { d: "M0 0", fill: "red" }], "currentColor"],
    [["use", { href: "http://x" }], "not allowed"],
    [["foreignObject", {}], "not allowed"],
    [["path", {}], "no geometry"],
    ["path", "[tag, attrs]"],
  ])("rejects %j", (node, text) => {
    expect(iconNodeProblem(node)).toContain(text);
  });

  it("rejects empty and oversized icons", () => {
    expect(iconProblem([])).toBeTruthy();
    expect(iconProblem(Array.from({ length: 25 }, () => ["path", { d: "M0 0" }]))).toBeTruthy();
    expect(iconProblem([["path", { d: "M0 0L1 1" }]])).toBeNull();
  });
});

describe("icon search", () => {
  const top = (q: string, n = 3) => searchIcons(q, { limit: n }).map((d) => d.slug);

  it("returns every icon for an empty query, in library order", () => {
    const all = searchIcons("");
    expect(all).toHaveLength(250);
    expect(all[0]!.slug).toBe("home");
  });

  it("finds by name, by synonym and by intent", () => {
    expect(top("camera")[0]).toBe("camera");
    expect(top("photo")).toContain("camera");
    expect(top("trash")).toContain("delete");
    expect(top("remove")).toContain("delete");
    expect(top("cut")).toContain("cut");
    expect(top("gear")).toContain("site-settings");
    expect(top("mail")).toContain("email");
    expect(top("idea")).toContain("lightbulb");
    expect(top("shopping basket")).toContain("shopping-cart");
    expect(top("security", 6)).toEqual(expect.arrayContaining(["shield"]));
    expect(top("camra")).toContain("camera");
  });

  it("requires every word to match, and filters by category and variant", () => {
    expect(searchIcons("camera zzzzqq")).toHaveLength(0);
    const nav = searchIcons("", { category: "navigation" });
    expect(nav).toHaveLength(10);
    expect(nav.every((d) => d.category === "navigation")).toBe(true);
    const duo = searchIcons("", { variant: "duotone" });
    expect(duo.length).toBeGreaterThan(100);
    expect(duo.every((d) => d.variants.includes("duotone"))).toBe(true);
    expect(searchIcons("", { within: ["binhi.icon.camera", "binhi.icon.heart"] })).toHaveLength(2);
  });

  it("does not choke on hostile input", () => {
    for (const q of ["<script>", "%%%", "a".repeat(5000), "((((", "\u0000", "   "]) expect(() => searchIcons(q)).not.toThrow();
  });
});

describe("generated documentation matches the registry", () => {
  it("lists all 250 icons in the inventory with their canonical ids", () => {
    const inventory = readFileSync(new URL("../../docs/ICON_INVENTORY.md", import.meta.url), "utf8");
    for (const d of ICON_LIST) expect(inventory).toContain(`\`${d.id}\``);
    expect([...inventory.matchAll(/^\| \d{3} \|/gm)]).toHaveLength(250);
  });
});
