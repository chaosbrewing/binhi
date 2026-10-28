import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, INVENTORY, LOCK, canonicalContent, countByStage, validateCatalog, validateInventory, type Manifest } from "../../src/core/templates/library/index.js";
import { DESIGN_CONTENT } from "../../src/core/templates/library/catalog/designs.js";
import { createSiteDocument, getTemplate } from "../../src/core/templates/index.js";
import { validateDocument } from "../../src/core/ops/apply.js";
import { allNodes } from "../../src/core/schema/traverse.js";
import { DesignDocument } from "../../src/core/creative/design.js";

const root = path.resolve(import.meta.dirname, "../..");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function contentOf(m: Manifest): unknown {
  if (m.content.type === "builtin-site") return createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
  if (m.content.type === "builtin-design") return DesignDocument.parse(DESIGN_CONTENT[m.content.key]);
  throw new Error("not a built-in template");
}

describe("shipped catalog", () => {
  it("is valid, with no duplicate identities and no invalid references", () => {
    const { issues } = validateCatalog(CATALOG);
    expect(issues).toEqual([]);
    expect(new Set(CATALOG.map((m) => m.id)).size).toBe(CATALOG.length);
  });

  it("only ships built-in, BINHI-authored, public, published templates", () => {
    for (const m of CATALOG) {
      expect(m.creator.kind, m.id).toBe("binhi");
      expect(m.visibility, m.id).toBe("public");
      expect(m.lifecycle, m.id).toBe("published");
      expect(["builtin-site", "builtin-design"], m.id).toContain(m.content.type);
    }
  });

  it("documents-are-valid: every template's content is a valid document that matches its declared features, fonts and palette", () => {
    for (const m of CATALOG) {
      const content = contentOf(m);
      if (m.documentKind === "site") {
        const doc = validateDocument(content);
        const hasForm = allNodes(doc).some((n) => n.type === "form");
        expect(m.requiredFeatures.includes("site.forms"), `${m.id}: site.forms must be declared exactly when the document has a form`).toBe(hasForm);
        expect(new Set(m.dependencies.fonts), `${m.id}: declared fonts must be the theme fonts`).toEqual(new Set([doc.theme.fonts.heading, doc.theme.fonts.body]));
        expect(m.palette[0], `${m.id}: first swatch is the primary colour`).toBe(doc.theme.colors.primary);
        expect(m.palette[1], `${m.id}: second swatch is the background`).toBe(doc.theme.colors.background);
        expect(doc.pages.length).toBeGreaterThanOrEqual(1);
        expect(doc.pages.some((p) => p.isHome)).toBe(true);
        expect(m.documentSchemaVersion).toBe(doc.schemaVersion);
      } else {
        const doc = DesignDocument.parse(content);
        const fonts = new Set(doc.layers.flatMap((l) => (l.type === "text" ? [l.font] : [])));
        expect(new Set(m.dependencies.fonts), `${m.id}: declared fonts must be the fonts used`).toEqual(fonts);
        expect(m.size).toMatchObject({ kind: "fixed", width: doc.width, height: doc.height });
        expect(doc.layers.some((l) => l.type === "image"), `${m.id}: shipped designs never reference private library images`).toBe(false);
      }
    }
  });

  it("keeps every legacy id resolving to the builder it came from", () => {
    for (const m of CATALOG) {
      if (m.content.type !== "builtin-site") continue;
      expect(getTemplate(m.content.builder), m.id).toBeTruthy();
      for (const legacy of m.legacyIds) expect(legacy, m.id).toBe(m.content.builder);
    }
    // Every website starter that existed before the library is registered.
    const registered = new Set(CATALOG.flatMap((m) => m.legacyIds));
    for (const id of ["blank", "portfolio", "studio", "freelancer", "business", "landing"]) expect(registered.has(id), id).toBe(true);
  });

  it("lock-and-previews: published content is immutable and previews were rendered from the current content", () => {
    expect(Object.keys(LOCK).sort()).toEqual(CATALOG.map((m) => `${m.id}@${m.version}`).sort());
    for (const m of CATALOG) {
      const key = `${m.id}@${m.version}`;
      const entry = (LOCK as Record<string, { contentSha256: string; preview: { file: string; width: number; height: number; renderedFrom: string } }>)[key]!;
      const current = sha(canonicalContent(contentOf(m)));
      expect(entry.contentSha256, `${key}: content changed without a version bump. Bump version and run scripts/templates/build-assets.ts`).toBe(current);
      expect(entry.preview.renderedFrom, `${key}: preview is stale`).toBe(current);
      expect(m.preview.thumbnail, key).toBe(entry.preview.file);
      const file = path.join(root, "public", entry.preview.file);
      expect(existsSync(file), `${key}: missing preview file`).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.length, `${key}: preview is empty`).toBeGreaterThan(2000);
      expect(bytes.subarray(0, 2).toString("hex"), `${key}: preview must be a JPEG`).toBe("ffd8");
    }
  });

  it("gives each template a distinct look (no recolor-only duplicates)", () => {
    const sig = (m: Manifest) => `${m.dependencies.fonts.join("+")}|${m.palette[0]}`;
    expect(new Set(CATALOG.map(sig)).size).toBe(CATALOG.length);
    for (const m of CATALOG) expect(m.palette.length).toBeGreaterThanOrEqual(2);
  });

  it("has an inventory entry per template with evidence that points at real files", () => {
    expect(validateInventory(CATALOG, INVENTORY)).toEqual([]);
    for (const e of INVENTORY) {
      for (const ref of Object.values(e.evidence)) {
        const file = ref.split("#")[0]!;
        if (file === "founder") continue;
        expect(existsSync(path.join(root, file)), `${e.id}: evidence file ${file} does not exist`).toBe(true);
      }
    }
    expect(countByStage(INVENTORY).approved).toBe(0); // approval is the founder's, never claimed by tooling
  });
});
