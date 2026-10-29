import { describe, expect, it } from "vitest";
import { colorFamily, parseManifest, searchTemplates, tokenize, type Manifest, type TemplateManifestInput } from "../../src/core/templates/library/index.js";
import { designTemplate, siteTemplate } from "../template-fixtures.js";

function m(over: TemplateManifestInput): Manifest {
  return parseManifest(over);
}

const catalog: Manifest[] = [
  m(designTemplate({ id: "tpl.design.quote-card", name: "Quote card", description: "A calm square post for one line of text.", tags: [], keywords: ["quote", "inspiration"], styles: ["minimal"], publishedAt: "2026-10-01" })),
  m(designTemplate({ id: "tpl.design.story-sale", name: "Story sale", description: "A bold vertical story announcing a sale.", tags: [], subcategory: "social-media/instagram-stories", size: { kind: "fixed", width: 1080, height: 1920 }, orientation: "portrait", styles: ["playful"], keywords: ["discount"], aliases: ["promo"], publishedAt: "2026-10-20" })),
  m(designTemplate({ id: "tpl.design.event-poster", name: "Event poster", description: "Large type and a date block for a gig or show.", tags: [], primaryCategory: "posters-flyers", subcategory: "posters-flyers/event-posters", secondaryCategories: ["invitations-events"], format: "print", size: { kind: "fixed", width: 2480, height: 3508 }, orientation: "portrait", styles: ["editorial", "modern"], keywords: ["concert", "leaflet"], publishedAt: "2026-10-10" })),
  m(siteTemplate({ id: "tpl.site.portfolio", name: "Personal portfolio", description: "Introduce yourself and show selected work.", tags: [], keywords: ["cv", "work"], styles: ["elegant"], publishedAt: "2026-09-01" })),
  m(siteTemplate({ id: "tpl.site.landing", name: "Minimal landing page", description: "One page with one clear action.", tags: [], keywords: [], primaryCategory: "websites-landing-pages", subcategory: "websites-landing-pages/product-landing-pages", legacyIds: ["landing"], styles: ["minimal"], publishedAt: "2026-09-15" })),
];

const names = (q: Parameters<typeof searchTemplates>[1]) => searchTemplates(catalog, q).items.map((t) => t.name);

describe("colour families", () => {
  it("names the colours people see", () => {
    expect(colorFamily("#e11d48")).toBe("red");
    expect(colorFamily("#f97316")).toBe("orange");
    expect(colorFamily("#fde047")).toBe("yellow");
    expect(colorFamily("#16a34a")).toBe("green");
    expect(colorFamily("#0e7490")).toBe("teal");
    expect(colorFamily("#2563eb")).toBe("blue");
    expect(colorFamily("#7c3aed")).toBe("purple");
    expect(colorFamily("#db2777")).toBe("pink");
    for (const c of ["#000000", "#ffffff", "#111827", "#f5f5f4", "#777777", "#fafaf9"]) expect(colorFamily(c), c).toBe("neutral");
    expect(colorFamily("not-a-colour")).toBe("neutral");
  });
});

describe("template search", () => {
  it("tokenizes without stop words and folds apostrophes", () => {
    expect(tokenize("The Valentine’s day template for my Business")).toEqual(["valentines", "day", "business"]);
  });

  it("searches by name", () => {
    expect(names({ q: "quote" })).toEqual(["Quote card"]);
    expect(names({ q: "portfolio" })).toEqual(["Personal portfolio"]);
  });

  it("searches by keyword, tag-like words and category names", () => {
    expect(names({ q: "inspiration" })).toEqual(["Quote card"]);
    expect(names({ q: "invitations" })).toEqual(["Event poster"]); // secondary category
    expect(names({ q: "landing" })[0]).toBe("Minimal landing page");
  });

  it("understands common aliases without an AI model", () => {
    expect(names({ q: "ig" })).toEqual(expect.arrayContaining(["Quote card", "Story sale"]));
    expect(names({ q: "cv" })).toEqual(["Personal portfolio"]);
    expect(names({ q: "flyer" })).toContain("Event poster"); // via "leaflet" keyword and category
    expect(names({ q: "promo" })).toEqual(["Story sale"]);
  });

  it("matches plurals and prefixes", () => {
    expect(names({ q: "posters" })).toEqual(["Event poster"]);
    expect(names({ q: "insta" })).toEqual(expect.arrayContaining(["Quote card"]));
  });

  it("requires every word to match", () => {
    expect(names({ q: "quote sale" })).toEqual([]);
    expect(names({ q: "story sale" })).toEqual(["Story sale"]);
  });

  it("ranks a name match above a description match", () => {
    const r = names({ q: "sale" });
    expect(r[0]).toBe("Story sale");
  });

  it("filters by format, category, style and orientation", () => {
    expect(names({ format: "websites" }).sort()).toEqual(["Minimal landing page", "Personal portfolio"]);
    expect(names({ format: "print" })).toEqual(["Event poster"]);
    expect(names({ category: "invitations-events" })).toEqual(["Event poster"]); // discoverable under a secondary category, one record
    expect(names({ style: "minimal" }).sort()).toEqual(["Minimal landing page", "Quote card"]);
    expect(names({ orientation: "portrait" }).sort()).toEqual(["Event poster", "Story sale"]);
    expect(names({ format: "social", style: "playful" })).toEqual(["Story sale"]);
  });

  it("filters by colour family and by editor", () => {
    expect(names({ color: "purple" })).toEqual([]);
    expect(names({ color: "orange" })).toEqual([]);
    expect(names({ editor: "website" }).sort()).toEqual(["Minimal landing page", "Personal portfolio"]);
    expect(names({ editor: "design" }).sort()).toEqual(["Event poster", "Quote card", "Story sale"]);
    // The fixture palette is #111111 and #f4f1ea, so every template is neutral.
    expect(names({ color: "neutral" })).toHaveLength(5);
  });

  it("combines search and filters", () => {
    expect(names({ q: "poster", format: "social" })).toEqual([]);
    expect(names({ q: "poster", format: "print" })).toEqual(["Event poster"]);
  });

  it("sorts by the real publication date or by name", () => {
    expect(names({ sort: "latest" })).toEqual(["Story sale", "Event poster", "Quote card", "Minimal landing page", "Personal portfolio"]);
    expect(names({ sort: "name" })).toEqual(["Event poster", "Minimal landing page", "Personal portfolio", "Quote card", "Story sale"]);
  });

  it("returns an empty result, not an error, when nothing matches", () => {
    const r = searchTemplates(catalog, { q: "zzzz" });
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("counts facets without letting a filter hide its own alternatives", () => {
    const r = searchTemplates(catalog, { format: "print" });
    expect(r.facets.formats.print).toBe(1);
    expect(r.facets.formats.social).toBe(2); // still shows what switching format would give
    expect(r.facets.formats.websites).toBe(2);
    expect(r.facets.categories["posters-flyers"]).toBe(1);
    expect(r.facets.categories["invitations-events"]).toBe(1);
    const q = searchTemplates(catalog, { q: "quote" });
    expect(q.facets.formats.social).toBe(1);
    expect(q.facets.formats.websites).toBe(0);
  });

  it("is deterministic", () => {
    const a = searchTemplates(catalog, { q: "ig" }).items.map((t) => t.id);
    const b = searchTemplates([...catalog].reverse(), { q: "ig" }).items.map((t) => t.id);
    expect(b).toEqual(a);
  });
});
