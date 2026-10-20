import { describe, it, expect } from "vitest";
import { SiteDocument, createSiteDocument, TEMPLATES, makeNode, validateDocument, OperationError } from "../../src/core/index.js";

describe("canonical document", () => {
  it("every template builds a valid document", () => {
    for (const t of TEMPLATES) {
      const doc = t.build("Test Site");
      expect(SiteDocument.safeParse(doc).success).toBe(true);
      expect(doc.pages.filter((p) => p.isHome)).toHaveLength(1);
    }
  });

  it("rejects documents without exactly one homepage", () => {
    const doc = createSiteDocument("blank", "x");
    doc.pages[0]!.isHome = false;
    expect(() => validateDocument(doc)).toThrow(OperationError);
  });

  it("rejects duplicate page slugs and duplicate node ids", () => {
    const doc = createSiteDocument("portfolio", "x");
    const copy = structuredClone(doc);
    copy.pages[1]!.slug = copy.pages[0]!.slug;
    expect(SiteDocument.safeParse(copy).success).toBe(false);
    const dup = structuredClone(doc);
    dup.pages[0]!.sections.push(structuredClone(dup.pages[0]!.sections[0]!));
    expect(SiteDocument.safeParse(dup).success).toBe(false);
  });

  it("rejects unknown style keys and unsafe colours", () => {
    const doc = createSiteDocument("blank", "x");
    const n = doc.pages[0]!.sections[0]!;
    (n.style as Record<string, unknown>).position = "fixed";
    expect(SiteDocument.safeParse(doc).success).toBe(false);
    delete (n.style as Record<string, unknown>).position;
    n.style.color = "url(javascript:alert(1))";
    expect(SiteDocument.safeParse(doc).success).toBe(false);
  });

  it("makeNode produces registry-valid nodes with default children", () => {
    const card = makeNode("card");
    expect(card.children?.length).toBe(2);
    expect(card.layout?.mode).toBe("flow");
    const group = makeNode("group");
    expect(group.layout?.mode).toBe("free");
  });
});
