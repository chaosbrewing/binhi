import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  EDITOR_IDS,
  EDITORS,
  FORMAT_FILTERS,
  STYLE_IDS,
  SUBCATEGORIES,
  allowedTransitions,
  canTransition,
  editorCanOpenTemplates,
  evaluateAvailability,
  getSubcategory,
  parseManifest,
  slugify,
  validateCatalog,
  validateTaxonomy,
  type TemplateManifestInput,
} from "../../src/core/templates/library/index.js";
import { countByStage, completedCount, validateInventory, type InventoryEntry } from "../../src/core/templates/library/inventory.js";
import { designTemplate, siteTemplate } from "../template-fixtures.js";

describe("taxonomy", () => {
  it("has exactly 30 canonical categories numbered 1 to 30 with stable unique ids", () => {
    expect(CATEGORIES).toHaveLength(30);
    expect(CATEGORIES.map((c) => c.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(30);
    expect(validateTaxonomy()).toEqual([]);
  });

  it("freezes the category ids so a rename cannot silently break saved references", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      "social-media", "websites-landing-pages", "logos-brand-identity", "posters-flyers", "presentations-pitch-decks",
      "documents-reports", "forms-surveys", "marketing-advertising", "invitations-events", "business-essentials",
      "food-hospitality", "packaging-product-labels", "books-publishing", "education-learning", "infographics-diagrams",
      "ui-ux-digital-products", "video-motion-graphics", "photography-collages", "fashion-beauty-lifestyle", "real-estate-architecture",
      "travel-tourism", "health-fitness-wellness", "nonprofits-community", "email-newsletters", "planners-productivity",
      "merchandise-print-on-demand", "seasonal-holiday", "portfolios-personal-branding", "music-podcasts-entertainment", "blank-custom-creations",
    ]);
  });

  it("has 300 subcategories with namespaced ids, so repeated names in two categories never collide", () => {
    expect(SUBCATEGORIES).toHaveLength(300);
    expect(new Set(SUBCATEGORIES.map((s) => s.id)).size).toBe(300);
    expect(getSubcategory("business-essentials/certificates")?.categoryId).toBe("business-essentials");
    expect(getSubcategory("education-learning/certificates")?.categoryId).toBe("education-learning");
    expect(getSubcategory("books-publishing/childrens-book-layouts")?.name).toBe("Children’s book layouts");
    expect(slugify("Valentine’s Day")).toBe("valentines-day");
  });

  it("offers the nine format filters and the twelve curated styles", () => {
    expect(FORMAT_FILTERS.map((f) => f.id)).toEqual(["all", "social", "websites", "print", "documents", "presentations", "forms", "video", "custom"]);
    expect(STYLE_IDS).toHaveLength(12);
  });

  it("detects a broken taxonomy", () => {
    const broken = [...CATEGORIES.slice(0, 29)];
    expect(validateTaxonomy(broken).some((i) => /exactly 30/.test(i.message))).toBe(true);
  });
});

describe("editor availability", () => {
  it("only the Website Builder and Design Studio open templates in v1.0", () => {
    expect(EDITOR_IDS.filter(editorCanOpenTemplates)).toEqual(["website", "design"]);
    for (const id of ["form", "document", "presentation", "video", "email"] as const) {
      expect(EDITORS[id].available).toBe(false);
      expect(EDITORS[id].unavailableReason).toBeTruthy();
    }
    // The Photo Editor exists but has no template support yet.
    expect(EDITORS.photo.available).toBe(true);
    expect(EDITORS.photo.templates).toBe(false);
  });

  it("explains why a template is unavailable", () => {
    const a = evaluateAvailability({ editor: "presentation", requiredFeatures: [], lifecycle: "published" });
    expect(a.usable).toBe(false);
    expect(a.reasons[0]?.code).toBe("editor-unavailable");
    const b = evaluateAvailability({ editor: "design", requiredFeatures: ["design.icons"], lifecycle: "published" });
    expect(b.reasons.map((r) => r.code)).toEqual(["feature-missing"]);
    expect(evaluateAvailability({ editor: "design", requiredFeatures: ["design.text"], lifecycle: "draft" }).reasons[0]?.code).toBe("not-published");
    expect(evaluateAvailability({ editor: "design", requiredFeatures: ["design.text"], lifecycle: "published" }).usable).toBe(true);
  });
});

describe("lifecycle", () => {
  it("follows draft -> review -> approved -> published and never skips review", () => {
    expect(canTransition("draft", "ready-for-review")).toBe(true);
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("ready-for-review", "published")).toBe(false);
    expect(canTransition("approved", "published")).toBe(true);
    expect(canTransition("published", "deprecated")).toBe(true);
    expect(canTransition("published", "draft")).toBe(false);
    expect(allowedTransitions("archived")).toEqual(["draft"]);
  });
});

describe("manifest schema", () => {
  it("accepts a valid design and website record", () => {
    expect(parseManifest(designTemplate()).id).toBe("tpl.design.quote-card");
    expect(parseManifest(siteTemplate()).legacyIds).toEqual(["portfolio"]);
  });

  it("rejects unknown fields so nothing can be smuggled into a record", () => {
    expect(() => parseManifest({ ...designTemplate(), script: "alert(1)" })).toThrow();
    expect(() => parseManifest(designTemplate({ content: { type: "builtin-design", key: "x", html: "<b>" } as never }))).toThrow();
  });

  it("rejects invalid ids, premium access and unknown styles", () => {
    expect(() => parseManifest(designTemplate({ id: "Quote Card" }))).toThrow();
    expect(() => parseManifest({ ...designTemplate(), access: "premium" })).toThrow();
    expect(() => parseManifest(designTemplate({ styles: ["glitchy" as never] }))).toThrow();
  });
});

describe("catalog validation", () => {
  const ok = [designTemplate(), siteTemplate()];

  it("passes a consistent catalog", () => {
    expect(validateCatalog(ok).issues).toEqual([]);
  });

  it("rejects duplicate ids and versions", () => {
    const { issues } = validateCatalog([designTemplate(), designTemplate()]);
    expect(issues.some((i) => /Duplicate \(id, version\)/.test(i.message))).toBe(true);
  });

  it("rejects a legacy id claimed twice", () => {
    const { issues } = validateCatalog([siteTemplate(), siteTemplate({ id: "tpl.site.other", name: "Other" })]);
    expect(issues.some((i) => /already claimed/.test(i.message))).toBe(true);
  });

  it("rejects references to unknown categories and mismatched subcategories", () => {
    expect(validateCatalog([designTemplate({ primaryCategory: "nope" })]).issues.some((i) => /Unknown primary category/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ subcategory: "posters-flyers/event-posters" })]).issues.some((i) => /does not belong/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ secondaryCategories: ["social-media"] })]).issues.some((i) => /must differ/.test(i.message))).toBe(true);
  });

  it("enforces format and editor compatibility with the category", () => {
    expect(validateCatalog([designTemplate({ format: "forms" })]).issues.some((i) => /Format "forms"/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ editor: "website", documentKind: "site", content: { type: "builtin-site", builder: "x" } })]).issues.some((i) => /Editor "website" is not allowed/.test(i.message))).toBe(true);
  });

  it("blocks publication when the required editor is unavailable", () => {
    const presentation = designTemplate({ id: "tpl.design.pitch", primaryCategory: "presentations-pitch-decks", subcategory: "presentations-pitch-decks/startup-pitch-decks", format: "presentations", editor: "presentation" });
    const { issues } = validateCatalog([presentation]);
    expect(issues.some((i) => /cannot open document kind/.test(i.message))).toBe(true);
    expect(issues.some((i) => /not usable/.test(i.message))).toBe(true);
  });

  it("blocks publication of templates that need features that do not exist", () => {
    const { issues } = validateCatalog([designTemplate({ requiredFeatures: ["design.icons"] })]);
    expect(issues.some((i) => /not usable/.test(i.message))).toBe(true);
  });

  it("requires every dependency to resolve and never assumes it does", () => {
    const withIcon = designTemplate({ dependencies: { fonts: ["Inter"], icons: ["binhi.icon.heart"], elements: ["binhi.el.star"], bundledAssets: ["texture-paper"], brandTokens: [], components: [] } });
    expect(validateCatalog([withIcon]).issues.map((i) => i.message)).toEqual([
      'Icon dependency "binhi.icon.heart" does not resolve',
      'Element dependency "binhi.el.star" does not resolve',
      'Bundled asset "texture-paper" does not resolve',
    ]);
    expect(validateCatalog([withIcon], { resolveIcon: () => true, resolveElement: () => true, resolveBundledAsset: () => true }).issues).toEqual([]);
  });

  it("keeps size, orientation and kind consistent", () => {
    expect(validateCatalog([designTemplate({ orientation: "portrait" })]).issues.some((i) => /does not match 1080x1080/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ size: { kind: "responsive", breakpoints: ["desktop"] }, orientation: "responsive" })]).issues.some((i) => /fixed dimensions/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ documentSchemaVersion: 99 })]).issues.some((i) => /does not match the current design schema/.test(i.message))).toBe(true);
    expect(validateCatalog([siteTemplate({ outputFormats: ["png"] })]).issues.some((i) => /not produced by site/.test(i.message))).toBe(true);
  });

  it("requires a real preview, a publish date and approved moderation for published templates", () => {
    expect(validateCatalog([designTemplate({ preview: { thumbnail: null, alt: "x" } })]).issues.some((i) => /preview thumbnail/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ publishedAt: null })]).issues.some((i) => /publishedAt/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ moderation: "pending" })]).issues.some((i) => /Moderation/.test(i.message))).toBe(true);
  });

  it("treats community and user templates as untrusted and private", () => {
    expect(validateCatalog([designTemplate({ creator: { kind: "community", handle: "someone" } })]).issues.some((i) => /untrusted/.test(i.message))).toBe(true);
    const user = designTemplate({ creator: { kind: "user", ownerId: "usr_abc123" }, license: { id: "user-owned", attribution: null }, visibility: "public", lifecycle: "draft", publishedAt: null });
    expect(validateCatalog([user]).issues.some((i) => /private and user-owned/.test(i.message))).toBe(true);
    const privateUser = designTemplate({ creator: { kind: "user", ownerId: "usr_abc123" }, license: { id: "user-owned", attribution: null }, visibility: "private", lifecycle: "draft", publishedAt: null, preview: { thumbnail: null, alt: "x" } });
    expect(validateCatalog([privateUser]).issues).toEqual([]);
  });

  it("requires deprecation details exactly when deprecated, and a real replacement", () => {
    const deprecated = designTemplate({ lifecycle: "deprecated", deprecation: { since: "2026-12-01", reason: "Superseded", replacedBy: "tpl.design.missing" } });
    expect(validateCatalog([deprecated]).issues.some((i) => /replacedBy/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ deprecation: { since: "2026-12-01", reason: "x" } })]).issues.some((i) => /Only deprecated/.test(i.message))).toBe(true);
    expect(validateCatalog([designTemplate({ lifecycle: "deprecated" })]).issues.some((i) => /must record a deprecation/.test(i.message))).toBe(true);
  });

  it("allows archived older versions beside one live version but not two live versions", () => {
    const v1 = designTemplate({ version: 1, lifecycle: "archived", visibility: "public", publishedAt: null });
    const v2 = designTemplate({ version: 2 });
    expect(validateCatalog([v1, v2]).issues).toEqual([]);
    expect(validateCatalog([designTemplate({ version: 1 }), v2]).issues.some((i) => /More than one published version/.test(i.message))).toBe(true);
  });

  it("reports malformed records without throwing", () => {
    const { issues, valid } = validateCatalog([{ id: "tpl.design.bad" }, null, designTemplate()]);
    expect(valid).toHaveLength(1);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("ships an empty catalog until templates have evidence (no placeholder records)", async () => {
    const { CATALOG } = await import("../../src/core/templates/library/catalog/index.js");
    expect(CATALOG.length).toBe(0);
  });
});

describe("inventory", () => {
  const m = parseManifest(designTemplate());
  it("requires an entry per template and evidence for every stage claimed", () => {
    expect(validateInventory([m], []).some((i) => /no inventory entry/.test(i.message))).toBe(true);
    const bad: InventoryEntry = { id: m.id, version: 1, stage: "editor-verified", evidence: { implemented: "unit", "preview-verified": "p" } };
    expect(validateInventory([m], [bad]).some((i) => /without evidence for "editor-verified"/.test(i.message))).toBe(true);
  });

  it("a published template must be fully approved", () => {
    const e: InventoryEntry = { id: m.id, version: 1, stage: "implemented", evidence: { implemented: "unit" } };
    expect(validateInventory([m], [e]).some((i) => /requires inventory stage "approved"/.test(i.message))).toBe(true);
    const full: InventoryEntry = { id: m.id, version: 1, stage: "approved", evidence: { implemented: "a", "preview-verified": "b", "editor-verified": "c", "export-verified": "d", approved: "founder" } };
    expect(validateInventory([m], [full])).toEqual([]);
    expect(completedCount([full, e])).toBe(1);
    expect(countByStage([full, e]).implemented).toBe(1);
  });

  it("flags orphan entries", () => {
    expect(validateInventory([], [{ id: "tpl.design.x", version: 1, stage: "planned", evidence: {} }]).some((i) => /no matching template/.test(i.message))).toBe(true);
  });
});
