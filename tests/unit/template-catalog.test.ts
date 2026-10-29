import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, LOCK, canonicalContent, countByStage, validateApprovals, validateCatalog, validateInventory, type ApprovalRecord, type InventoryEntry, type Manifest } from "../../src/core/templates/library/index.js";
import { DESIGN_CONTENT } from "../../src/core/templates/library/index.js";
import { createSiteDocument, getTemplate } from "../../src/core/templates/index.js";
import { validateDocument } from "../../src/core/ops/apply.js";
import { allNodes } from "../../src/core/schema/traverse.js";
import { parseDesignContent } from "../../src/core/templates/library/index.js";

const root = path.resolve(import.meta.dirname, "../..");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function contentOf(m: Manifest): unknown {
  if (m.content.type === "builtin-site") return createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
  if (m.content.type === "builtin-design") return parseDesignContent(DESIGN_CONTENT[m.content.key]);
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
        const { document: doc, brand } = content as ReturnType<typeof parseDesignContent>;
        const fonts = new Set(doc.layers.flatMap((l) => (l.type === "text" ? [l.font] : [])));
        expect(new Set(m.dependencies.fonts), `${m.id}: declared fonts must be the fonts used`).toEqual(fonts);
        expect(m.size).toMatchObject({ kind: "fixed", width: doc.width, height: doc.height });
        expect(doc.layers.some((l) => l.type === "image"), `${m.id}: shipped designs never reference private library images`).toBe(false);
        const tokens = new Set<string>([...brand.colors.map((c) => `brand.${c.token}`), ...brand.fonts.map((f) => `brand.${f.token}-font`), ...(brand.background ? [`brand.${brand.background}`] : []), ...(brand.logoSlot ? ["brand.logo"] : [])]);
        expect(new Set(m.dependencies.brandTokens), `${m.id}: declared brand tokens must be the bound ones`).toEqual(tokens);
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

  it("gives each template a distinct look: no near-identical layouts, no recolor-only duplicates", () => {
    // Website starters differ by theme (fonts + primary colour).
    const sites = CATALOG.filter((m) => m.editor === "website");
    expect(new Set(sites.map((m) => `${m.dependencies.fonts.join("+")}|${m.palette[0]}`)).size).toBe(sites.length);
    // Designs are compared by layout: where text and shapes sit, ignoring every colour.
    const GRID = 12;
    const vec = (key: string): number[] => {
      const { document: d } = parseDesignContent(DESIGN_CONTENT[key]);
      const v = new Array<number>(GRID * GRID * 2).fill(0);
      for (const l of d.layers) {
        const kind = l.type === "text" ? 0 : 1;
        if (kind === 1 && l.width * l.height > d.width * d.height * 0.9) continue; // full-canvas backgrounds say nothing about layout
        for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
          const cx = ((gx + 0.5) / GRID) * d.width, cy = ((gy + 0.5) / GRID) * d.height;
          if (cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height) v[(kind * GRID + gy) * GRID + gx]! += 1;
        }
      }
      return v;
    };
    const cos = (a: number[], b: number[]) => {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
      return na && nb ? dot / Math.sqrt(na * nb) : 0;
    };
    const designs = CATALOG.filter((m) => m.content.type === "builtin-design");
    let worst = { score: 0, pair: "" };
    for (let i = 0; i < designs.length; i++) for (let j = i + 1; j < designs.length; j++) {
      const a = designs[i]!, b = designs[j]!;
      if (a.orientation !== b.orientation) continue;
      const score = cos(vec((a.content as { key: string }).key), vec((b.content as { key: string }).key));
      if (score > worst.score) worst = { score, pair: `${a.id} / ${b.id}` };
    }
    expect(worst.score, `most similar layouts: ${worst.pair}`).toBeLessThan(0.96);
  });

  it("meets the seed-catalog target of 60 usable templates across editors, with real variety of categories and styles", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(60);
    expect(CATALOG.filter((m) => m.editor === "website").length).toBeGreaterThanOrEqual(10);
    expect(new Set(CATALOG.map((m) => m.primaryCategory)).size).toBeGreaterThanOrEqual(12);
    expect(new Set(CATALOG.flatMap((m) => m.styles)).size).toBeGreaterThanOrEqual(10);
  });

  it("has a machine-verifiable inventory written by the browser journey, bound to the current content", () => {
    const file = JSON.parse(readFileSync(path.join(root, "docs/TEMPLATE_INVENTORY.json"), "utf8")) as { entries: (InventoryEntry & { contentSha256: string | null })[]; counts: Record<string, number> };
    const entries: InventoryEntry[] = file.entries.map(({ id, version, stage, evidence }) => ({ id, version, stage, evidence }));
    expect(validateInventory(CATALOG, entries), "run npm run test:e2e:templates to regenerate docs/TEMPLATE_INVENTORY.json").toEqual([]);
    for (const e of file.entries) {
      const lock = (LOCK as Record<string, { contentSha256: string }>)[`${e.id}@${e.version}`];
      expect(e.contentSha256, `${e.id}: inventory was proven against different content. Re-run the template journey`).toBe(lock?.contentSha256);
      for (const ref of Object.values(e.evidence)) expect(existsSync(path.join(root, ref.split("#")[0]!)), `${e.id}: evidence file ${ref} does not exist`).toBe(true);
    }
    // Approval is the founder's: it appears only where a recorded approval matches the proven content (see the next test).
    const record = JSON.parse(readFileSync(path.join(root, "docs/TEMPLATE_APPROVALS.json"), "utf8")) as ApprovalRecord;
    const approvedKeys = file.entries.filter((e) => e.stage === "approved").map((e) => `${e.id}@${e.version}`).sort();
    expect(approvedKeys, "inventory approvals must equal the recorded founder approvals").toEqual(Object.keys(record.entries).sort());
    expect(file.counts.approved).toBe(approvedKeys.length);
  });

  it("records founder approvals that still describe the shipped content", () => {
    const record = JSON.parse(readFileSync(path.join(root, "docs/TEMPLATE_APPROVALS.json"), "utf8")) as ApprovalRecord;
    expect(record.approvedBy).toBeTruthy();
    expect(record.basis).toBeTruthy();
    expect(validateApprovals(record, LOCK as Record<string, { contentSha256: string }>), "a template changed after approval: re-approve it or revert the change").toEqual([]);
  });
});
