import { describe, expect, it } from "vitest";
import { CATALOG, DESIGN_CONTENT, parseDesignContent, parseManifest, type TemplateManifestInput } from "../../src/core/templates/library/index.js";
import { createSiteDocument } from "../../src/core/templates/index.js";
import { renderPage } from "../../src/core/render/html.js";
import { allNodes } from "../../src/core/schema/traverse.js";
import { designTemplate } from "../template-fixtures.js";

const ALLOWED_HOSTS = new Set(["example.com", "instagram.com", "facebook.com", "youtube.com", "www.instagram.com", "www.facebook.com", "www.youtube.com"]);

describe("template security", () => {
  it("accepts thumbnails only as generated files under /template-previews", () => {
    const ok = designTemplate({ preview: { thumbnail: "/template-previews/tpl.design.quote-card@1.jpg", alt: "x" } });
    expect(() => parseManifest(ok)).not.toThrow();
    for (const bad of ["javascript:alert(1)", "//evil.example/x.jpg", "https://evil.example/x.jpg", "/template-previews/../secret.jpg", "/other/x.jpg", "/template-previews/x.svg", "data:image/png;base64,AAAA", "/template-previews/a b.jpg", "/template-previews/x.jpg?x=1"]) {
      expect(() => parseManifest({ ...ok, preview: { thumbnail: bad, alt: "x" } } as TemplateManifestInput), bad).toThrow();
    }
  });

  it("rejects fields a record may not have, so nothing executable can be attached", () => {
    for (const extra of [{ onload: "x" }, { html: "<b>" }, { script: "1" }, JSON.parse('{"__proto__":{"polluted":true}}'), { constructor: "x" }]) {
      expect(() => parseManifest({ ...designTemplate(), ...extra }), JSON.stringify(extra)).toThrow();
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("limits array sizes and string lengths in records", () => {
    expect(() => parseManifest(designTemplate({ keywords: Array.from({ length: 50 }, (_, i) => `k${i}`) }))).toThrow();
    expect(() => parseManifest(designTemplate({ name: "x".repeat(200) }))).toThrow();
    expect(() => parseManifest(designTemplate({ description: "x".repeat(1000) }))).toThrow();
  });

  it("shipped design templates contain only plain text: no markup, scripts or links", () => {
    for (const [key, raw] of Object.entries(DESIGN_CONTENT)) {
      const { document } = parseDesignContent(raw);
      for (const l of document.layers) {
        if (l.type !== "text") continue;
        expect(l.text, `${key}/${l.name}`).not.toMatch(/<[a-z!/]/i);
        expect(l.text, `${key}/${l.name}`).not.toMatch(/javascript:|data:|on\w+\s*=/i);
        expect(l.text, `${key}/${l.name}`).not.toMatch(/https?:\/\//i);
      }
    }
  });

  it("shipped website templates render without scripts or inline handlers and link only to safe, expected hosts", () => {
    for (const m of CATALOG) {
      if (m.content.type !== "builtin-site") continue;
      const doc = createSiteDocument(m.content.builder, m.content.sampleName ?? m.name);
      for (const page of doc.pages) {
        const html = renderPage(doc, page.id, { mode: "preview", baseHref: "/", formAction: () => "#" });
        expect(html, `${m.id}/${page.slug}`).not.toMatch(/<script/i);
        expect(html, `${m.id}/${page.slug}`).not.toMatch(/\son[a-z]+\s*=/i);
        expect(html, `${m.id}/${page.slug}`).not.toMatch(/href=["']\s*javascript:/i);
      }
      for (const n of allNodes(doc)) {
        const props = n.props as { link?: { kind?: string; href?: string }; links?: { url: string }[] };
        const urls = [props.link?.kind === "url" ? props.link.href : undefined, ...(props.links?.map((l) => l.url) ?? [])].filter((u): u is string => !!u && /^https?:/i.test(u));
        for (const u of urls) {
          const url = new URL(u);
          expect(url.protocol, `${m.id}: ${u}`).toBe("https:");
          expect(ALLOWED_HOSTS.has(url.hostname), `${m.id}: unexpected host ${url.hostname}`).toBe(true);
        }
      }
    }
  });

  it("shipped templates never depend on a user's private assets, icons or elements that do not exist", () => {
    for (const m of CATALOG) {
      expect(m.dependencies.bundledAssets, m.id).toEqual([]);
      expect(m.dependencies.icons, m.id).toEqual([]);
      expect(m.dependencies.elements, m.id).toEqual([]);
      if (m.content.type === "builtin-design") {
        const { document } = parseDesignContent(DESIGN_CONTENT[m.content.key]);
        expect(document.layers.some((l) => l.type === "image"), m.id).toBe(false);
      }
    }
  });
});
