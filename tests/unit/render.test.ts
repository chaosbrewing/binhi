import { describe, it, expect } from "vitest";
import { applyOperation, createSiteDocument, renderAllPages, renderPage, sanitizeUrl, sanitizeMediaSrc, TEMPLATES, makeNode, type RenderOptions } from "../../src/core/index.js";

const opts: RenderOptions = { mode: "publish", baseHref: "/s/demo/", runtimeHref: "/s/_binhi/runtime.js", formAction: (id) => `/s/demo/__form/${id}` };

describe("renderer", () => {
  it("renders every page of every template as a complete, escaped HTML document", () => {
    for (const t of TEMPLATES) {
      const doc = t.build(`Test <Site> & "Co"`);
      const pages = renderAllPages(doc, opts);
      expect(pages.length).toBe(doc.pages.length);
      for (const p of pages) {
        expect(p.html.startsWith("<!doctype html>")).toBe(true);
        expect(p.html).toContain('<main id="b-main"');
        expect(p.html).not.toContain("<Site>");
        expect(p.html).toContain("&lt;Site&gt;");
        expect(p.html).toContain('<meta name="viewport"');
      }
      expect(pages[0]!.path).toBe("/s/demo/");
    }
  });

  it("escapes user text and never emits script from content", () => {
    const doc = createSiteDocument("blank", "x");
    const heading = doc.pages[0]!.sections[0]!.children![0]!;
    const d = applyOperation(doc, { type: "updateProps", nodeId: heading.id, props: { text: `<script>alert(1)</script><img src=x onerror=alert(1)>` } }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops unsafe links and media sources", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("data:text/html,hi")).toBeNull();
    expect(sanitizeUrl("https://example.com/a?b=c")).toBe("https://example.com/a?b=c");
    expect(sanitizeUrl("#top")).toBe("#top");
    expect(sanitizeUrl("//evil.com")).toBeNull();
    expect(sanitizeMediaSrc("data:image/png;base64,AAAA")).toBeNull();
    expect(sanitizeMediaSrc("/media/ast_abc123/photo.jpg")).toBe("/media/ast_abc123/photo.jpg");
    expect(sanitizeMediaSrc("/media/../../etc/passwd")).toBeNull();
    expect(sanitizeMediaSrc("http://insecure.example/x.png")).toBeNull();
  });

  it("button links resolve pages, external urls (noopener), email and phone", () => {
    const doc = createSiteDocument("portfolio", "x");
    const home = doc.pages[0]!;
    const sec = home.sections[0]!;
    let d = applyOperation(doc, { type: "insertComponent", target: { parentId: sec.id }, componentType: "button", props: { label: "Ext", link: { kind: "url", href: "https://example.org", newTab: true } } }).document;
    d = applyOperation(d, { type: "insertComponent", target: { parentId: sec.id }, componentType: "button", props: { label: "Mail", link: { kind: "email", address: "a@b.co", subject: "Hi there" } } }).document;
    d = applyOperation(d, { type: "insertComponent", target: { parentId: sec.id }, componentType: "button", props: { label: "Call", link: { kind: "phone", number: "+63 (900) 123-4567" } } }).document;
    d = applyOperation(d, { type: "insertComponent", target: { parentId: sec.id }, componentType: "button", props: { label: "Bad", link: { kind: "url", href: "javascript:alert(1)" } } }).document;
    const html = renderPage(d, home.id, opts);
    expect(html).toContain(`href="/s/demo/work/"`);
    expect(html).toContain(`href="https://example.org/" target="_blank" rel="noopener noreferrer"`);
    expect(html).toContain(`href="mailto:a@b.co?subject=Hi%20there"`);
    expect(html).toContain(`href="tel:+639001234567"`);
    expect(html).not.toContain("javascript:");
  });

  it("emits responsive overrides, visibility rules and freeform placement as percentages", () => {
    const doc = createSiteDocument("blank", "x");
    const sec = doc.pages[0]!.sections[0]!;
    const heading = sec.children![0]!;
    let d = applyOperation(doc, { type: "updateStyle", nodeId: heading.id, breakpoint: "tablet", style: { fontSize: 30 } }).document;
    d = applyOperation(d, { type: "setVisibility", nodeId: heading.id, visibility: { mobile: false } }).document;
    d = applyOperation(d, { type: "setLayout", nodeId: sec.id, layout: { mode: "free", designWidth: 1000, designHeight: 500 } }).document;
    d = applyOperation(d, { type: "updatePlacement", nodeId: heading.id, placement: { x: 250, y: 100, width: 500, height: 50, rotation: 10 } }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).toMatch(/@media \(max-width:1023px\)\{\.b-n-[a-z0-9_]+\{font-size:30px\}\}/);
    expect(html).toMatch(/@media \(max-width:639px\)\{\.b-n-[a-z0-9_]+\{display:none!important\}\}/);
    expect(html).toContain("left:25.0000%");
    expect(html).toContain("top:20.0000%");
    expect(html).toContain("width:50.0000%");
    expect(html).toContain("transform:rotate(10deg)");
    expect(html).toContain("aspect-ratio:1000 / 500");
  });

  it("editor mode annotates nodes and shows hidden ones; publish mode omits hidden nodes and marks publication", () => {
    const doc = createSiteDocument("blank", "x");
    const heading = doc.pages[0]!.sections[0]!.children![0]!;
    const d = applyOperation(doc, { type: "setHidden", nodeId: heading.id, hidden: true }).document;
    const editor = renderPage(d, d.pages[0]!.id, { ...opts, mode: "editor" });
    expect(editor).toContain(`data-b-id="${heading.id}"`);
    expect(editor).toContain(`data-b-hidden="1"`);
    expect(editor).toContain('data-binhi-editor="1"');
    expect(editor).toContain('name="robots" content="noindex');
    const pub = renderPage(d, d.pages[0]!.id, { ...opts, publicationId: "pub_test123" });
    expect(pub).not.toContain(`data-b-id`);
    expect(pub).not.toContain("Welcome");
    expect(pub).toContain('<meta name="binhi-publication" content="pub_test123">');
    expect(pub).not.toContain('name="robots"');
  });

  it("forms post to the form endpoint with a honeypot, and never in editor mode", () => {
    const doc = createSiteDocument("landing", "x");
    const html = renderPage(doc, doc.pages[0]!.id, opts);
    expect(html).toMatch(/<form class="b-n-form_[a-z0-9]+ b-form" method="post" action="\/s\/demo\/__form\/form_[a-z0-9]+"/);
    expect(html).toContain('name="website"');
    const editor = renderPage(doc, doc.pages[0]!.id, { ...opts, mode: "editor" });
    expect(editor).not.toContain('method="post"');
  });

  it("video and map embeds are sandboxed and only accept known ids", () => {
    const doc = createSiteDocument("blank", "x");
    const sec = doc.pages[0]!.sections[0]!;
    let d = applyOperation(doc, { type: "insertComponent", target: { parentId: sec.id }, componentType: "video", props: { provider: "youtube", videoId: "dQw4w9WgXcQ" } }).document;
    d = applyOperation(d, { type: "insertComponent", target: { parentId: sec.id }, componentType: "map", props: { address: "Manila <b>" } }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?");
    expect(html).toMatch(/<iframe[^>]+sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
    expect(html).toContain("maps?q=Manila%20%3Cb%3E");
    expect(() => applyOperation(d, { type: "insertComponent", target: { parentId: sec.id }, componentType: "video", props: { provider: "youtube", videoId: "x\"><script>" } })).toThrow();
  });

  it("scroll-triggered entrance animations include the runtime only when needed", () => {
    const doc = createSiteDocument("blank", "x");
    const plain = renderPage(doc, doc.pages[0]!.id, opts);
    expect(plain).not.toContain("runtime.js");
    const heading = doc.pages[0]!.sections[0]!.children![0]!;
    const d = applyOperation(doc, { type: "updateInteractions", nodeId: heading.id, interactions: { entrance: "fade" } }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).toContain('<script src="/s/_binhi/runtime.js" defer></script>');
    expect(html).toContain("prefers-reduced-motion");
  });

  it("rich text renders structured runs with lists and sanitized links", () => {
    const doc = createSiteDocument("blank", "x");
    const sec = doc.pages[0]!.sections[0]!;
    const d = applyOperation(doc, {
      type: "insertComponent",
      target: { parentId: sec.id },
      componentType: "richText",
      props: { blocks: [
        { type: "h2", runs: [{ text: "Title" }] },
        { type: "bullet", runs: [{ text: "one", bold: true }] },
        { type: "bullet", runs: [{ text: "two", link: { kind: "url", href: "javascript:x" } }] },
        { type: "paragraph", runs: [{ text: "<b>raw</b>" }] },
      ] },
    }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).toContain("<h2>Title</h2><ul><li><strong>one</strong></li><li>two</li></ul><p>&lt;b&gt;raw&lt;/b&gt;</p>");
  });

  it("columns stack at the configured breakpoint", () => {
    const doc = createSiteDocument("blank", "x");
    const sec = doc.pages[0]!.sections[0]!;
    const cols = makeNode("columns", { count: 3, stackBelow: "tablet" });
    const d = applyOperation(doc, { type: "insertNode", target: { parentId: sec.id }, node: cols }).document;
    const html = renderPage(d, d.pages[0]!.id, opts);
    expect(html).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(html).toMatch(/@media \(max-width:1023px\)\{\.b-n-colu[a-z0-9_]+\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  });
});
