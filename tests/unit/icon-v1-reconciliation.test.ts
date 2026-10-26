import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ICON_LIST, LEGACY_ICON_LIST, getIcon, buildCanonicalRegistry, IconAssetId, iconUsageProblem,
  renderIconSvg, iconProblem, iconSupportsVariant,
} from "../../src/core/icons/index.js";
import { V1_ENTRIES } from "../../src/core/icons/canonical/catalog.js";
import { ALL_ICON_SHAPES, LEGACY_ICON_SHAPES, resolveIconShapeSync } from "../../src/core/icons/shapes-all.js";
import { searchIcons } from "../../src/core/icons/search.js";
import { loadIconShape } from "../../src/core/icons/shapes.js";
import { createSiteDocument, applyOperation, renderPage } from "../../src/core/index.js";
import { createDesignDocument, makeLayer, validateDesignDocument } from "../../src/core/creative/design.js";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const manifest = JSON.parse(read("docs/ICON_V1_MANIFEST.json"));
const inventory = read("scripts/icons/v1-catalog/catalog-v1.tsv").trim().split("\n").map(s => s.split("\t"));
const mapping = read("scripts/icons/v1-catalog/v1-mapping.tsv").trim().split("\n").map(s => s.split("\t"));

describe("canonical v1 reconciliation and permanent aliases", () => {
  it("implements the exact 250 concepts in canonical order, not 250 arbitrary records", () => {
    expect(ICON_LIST).toHaveLength(250);
    expect(manifest.counts).toEqual({ S: 75, L: 70, C: 80, O: 25 });
    expect(new Set(ICON_LIST.map(d => d.id)).size).toBe(250);
    for (let i = 0; i < 250; i++) {
      const d = ICON_LIST[i]!;
      const [n, , name, cat] = inventory[i]!;
      expect(d.name).toBe(name);
      expect(d.category).toBe(cat!.toLowerCase());
      expect(d.classification).toBe(mapping[i]![1]);
      expect(d.aliases).toEqual([`ICN-${n}`]);
      expect(getIcon(`ICN-${n}`)).toBe(d);
      expect(IconAssetId.parse(`ICN-${n}`)).toBe(d.id);
      expect(d.artworkReview).toBe("pending");
      expect(manifest.entries[i].provenance).toBeTruthy();
      expect(hash(ALL_ICON_SHAPES[d.id])).toBe(manifest.entries[i].sha256);
    }
  });

  it("preserves every old id, supported variant and exact geometry without semantic remapping", () => {
    expect(LEGACY_ICON_LIST).toHaveLength(250);
    for (const old of LEGACY_ICON_LIST) {
      expect(getIcon(old.id)).toBeDefined();
      expect(resolveIconShapeSync(old.id)).toEqual(LEGACY_ICON_SHAPES[old.id]);
      for (const variant of old.variants) {
        expect(iconSupportsVariant(old.id, variant)).toBe(true);
        expect(renderIconSvg(resolveIconShapeSync(old.id)!, { variant })).toBe(
          renderIconSvg(LEGACY_ICON_SHAPES[old.id]!, { variant }),
        );
      }
    }
    const inherited = ICON_LIST.filter(d => LEGACY_ICON_LIST.some(l => l.id === d.id));
    expect(inherited).toHaveLength(75);
    expect(inherited.every(d => d.classification === "S")).toBe(true);
    // A shared convention is not a semantic alias: mention is not an email input.
    expect(getIcon("ICN-233")?.id).not.toBe("binhi.icon.email-input");
    expect(getIcon("binhi.icon.email-input")?.name).toBe("Email Input");
    const matrix = read("docs/ICON_V1_COLLISION_MATRIX.tsv");
    expect(matrix.trim().split("\n")).toHaveLength(251);
    expect(matrix.match(/Explicit collision decision:/g)).toHaveLength(10);
  });

  it("rejects numbering/alias/id collisions, unknown categories and legacy meaning overwrites", () => {
    expect(() => buildCanonicalRegistry(V1_ENTRIES.slice(1))).toThrow();
    expect(() => buildCanonicalRegistry(V1_ENTRIES.map((e, i) => i === 1 ? { ...e, alias: "ICN-001" } : e))).toThrow(/alias/);
    expect(() => buildCanonicalRegistry(V1_ENTRIES.map((e, i) => i === 1 ? { ...e, slug: "camera" } : e))).toThrow(/legacy/);
    expect(() => buildCanonicalRegistry(V1_ENTRIES.map((e, i) => i === 1 ? { ...e, cat: "evil" } : e))).toThrow(/category/);
    for (const id of ["ICN-000", "ICN-251", "icn-001", "ICN-01", "<svg onload=alert(1)>"]) expect(IconAssetId.safeParse(id).success).toBe(false);
    expect(getIcon("ICN-251")).toBeUndefined();
  });

  it("has real safe distinct geometry and meaningful variants for every canonical entry", () => {
    const hashes = new Set<string>();
    for (const d of ICON_LIST) {
      const nodes = resolveIconShapeSync(d.id)!;
      expect(iconProblem(nodes), d.id).toBeNull();
      expect(nodes.length).toBeGreaterThan(0);
      expect(hashes.has(hash(nodes)), d.id).toBe(false);
      hashes.add(hash(nodes));
      for (const v of d.variants) {
        expect(iconUsageProblem(d.id, v)).toBeNull();
        const svg = renderIconSvg(nodes, { variant: v, label: d.name, size: 24 });
        expect(svg).toContain("<svg");
        expect(svg).not.toMatch(/<(script|use|foreignObject|image|text)\b|href=|onload=|http[s]?:\/\/(?!www.w3.org)/);
      }
    }
  });

  it("resolves aliases in lazy geometry and search and keeps old favorites accessible without duplicate browse results", async () => {
    for (const alias of ["ICN-001", "ICN-007", "ICN-035", "ICN-250"]) {
      expect(await loadIconShape(alias)).toEqual(resolveIconShapeSync(alias));
      expect(searchIcons(alias)[0]?.id).toBe(getIcon(alias)?.id);
    }
    expect(searchIcons("")).toHaveLength(250);
    expect(searchIcons("", { within: ["binhi.icon.camera", "ICN-001"] }).map(d => d.id).sort()).toEqual(
      ["binhi.icon.camera", getIcon("ICN-001")!.id].sort(),
    );
  });

  it("inserts alias ids through canonical website operations and design validation without storing aliases or SVG", () => {
    const base = createSiteDocument("blank", "compatibility");
    for (const alias of ["ICN-001", "ICN-003", "ICN-035", "ICN-007"]) {
      const doc = applyOperation(base, {
        type: "insertComponent", target: { parentId: base.pages[0]!.sections[0]!.id },
        componentType: "icon", props: { icon: alias, strokeWidth: 1.5 },
      }).document;
      const json = JSON.stringify(doc);
      expect(json).toContain(getIcon(alias)!.id);
      expect(json).not.toContain(`"${alias}"`);
      const page = renderPage(doc, doc.pages[0]!.id, { mode: "publish", baseHref: "/s/test/", formAction: () => "#", iconShape: resolveIconShapeSync });
      expect(page).toContain("<svg");
      const design = createDesignDocument(1080, 1080);
      design.layers.push(makeLayer("icon", design, { icon: alias }));
      const parsed = validateDesignDocument(JSON.parse(JSON.stringify(design)));
      expect(parsed.layers[0]).toMatchObject({ icon: getIcon(alias)!.id });
    }
  });
});
