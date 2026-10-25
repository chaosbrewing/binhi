import { describe, expect, it } from "vitest";
import { applyOperation, createSiteDocument, renderAllPages, renderPage, SiteDocument, TEMPLATES, validateForPublish, walk, type Node, type RenderOptions } from "../../src/core/index.js";
import { resolveIconShapeSync } from "../../src/core/icons/shapes-all.js";
import { getLoadedShape } from "../../src/core/icons/shapes.js";

const publish: RenderOptions = { mode: "publish", baseHref: "/s/demo/", runtimeHref: "/s/_binhi/runtime.js", formAction: () => "#", iconShape: resolveIconShapeSync };

function withIcon(props: Record<string, unknown>, a11y?: Record<string, unknown>) {
  const doc = createSiteDocument("blank", "x");
  const section = doc.pages[0]!.sections[0]!;
  let d = applyOperation(doc, { type: "insertComponent", target: { parentId: section.id }, componentType: "icon", props }).document;
  const node = findIcon(d)!;
  if (a11y) d = applyOperation(d, { type: "updateA11y", nodeId: node.id, a11y }).document;
  return { doc: d, node: findIcon(d)!, section };
}

function findIcon(doc: ReturnType<typeof createSiteDocument>): Node | undefined {
  let found: Node | undefined;
  for (const s of doc.pages[0]!.sections) walk(s, (n) => void (n.type === "icon" && (found = n)));
  return found;
}

describe("website icon component", () => {
  it("keeps documents written before the library rendering exactly as before", () => {
    const { doc } = withIcon({ name: "mail", size: 28 });
    const html = renderPage(doc, doc.pages[0]!.id, publish);
    expect(html).toMatch(/<span class="b-n-icon_[a-z0-9]+ b-icon">/);
    expect(html).toContain('d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6"');
    expect(html).not.toContain("data-icon=");
  });

  it("every template's icons are valid (legacy names or registry ids) and render in publish mode", () => {
    for (const t of TEMPLATES) {
      const doc = t.build("T");
      expect(SiteDocument.safeParse(doc).success).toBe(true);
      expect(validateForPublish(doc).errors.filter((e) => e.code === "UNKNOWN_ICON")).toEqual([]);
      expect(() => renderAllPages(doc, publish)).not.toThrow();
    }
  });

  it("renders a library icon from its canonical id with presentation settings", () => {
    const { doc, node } = withIcon({ icon: "binhi.icon.camera", size: 48, variant: "duotone", strokeWidth: 1.5, rotation: 90, flipX: true });
    expect(node.props.icon).toBe("binhi.icon.camera");
    const html = renderPage(doc, doc.pages[0]!.id, publish);
    expect(html).toContain('data-icon="binhi.icon.camera"');
    expect(html).toContain('width="48"');
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain("rotate(90)");
    expect(html).toContain("fill-opacity");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<script");
  });

  it("embeds only the icons a page uses, never the whole library", () => {
    const { doc } = withIcon({ icon: "binhi.icon.camera" });
    const html = renderPage(doc, doc.pages[0]!.id, publish);
    const camera = resolveIconShapeSync("binhi.icon.camera")!;
    const heart = resolveIconShapeSync("binhi.icon.heart")!;
    expect(html).toContain(String(camera[0]![1].d));
    expect(html).not.toContain(String(heart[0]![1].d));
    expect(html.length).toBeLessThan(40_000);
  });

  it("rejects unknown ids, unsupported variants, bad colours and markup in props", () => {
    const bad = (props: Record<string, unknown>) => {
      const doc = createSiteDocument("blank", "x");
      return () => applyOperation(doc, { type: "insertComponent", target: { parentId: doc.pages[0]!.sections[0]!.id }, componentType: "icon", props });
    };
    expect(bad({ icon: "binhi.icon.not-real" })).toThrow();
    expect(bad({ icon: "binhi.icon.camera", variant: "filled" })).toThrow(/does not support/);
    expect(bad({ icon: '<svg onload="x">' })).toThrow();
    expect(bad({ icon: "binhi.icon.camera", gradient: { from: "#fff", to: "url(http://evil)", angle: 10 } })).toThrow();
    expect(bad({ icon: "binhi.icon.camera", size: 9999 })).toThrow();
    expect(bad({ icon: "binhi.icon.camera", strokeWidth: 9 })).toThrow();
    expect(bad({ name: "star", variant: "duotone" })).toThrow(/library icon/);
    expect(bad({ icon: "binhi.icon.star", variant: "filled" })).not.toThrow();
  });

  it("gives linked icons an accessible name and honours decorative/meaningful", () => {
    const linked = withIcon({ icon: "binhi.icon.email", link: { kind: "email", address: "a@b.co" } });
    expect(renderPage(linked.doc, linked.doc.pages[0]!.id, publish)).toMatch(/<a[^>]*data-icon="binhi\.icon\.email"[^>]*>.*aria-label="Email \/ Envelope"/s);

    const meaningful = withIcon({ icon: "binhi.icon.star" }, { label: "Rated 5 stars" });
    expect(renderPage(meaningful.doc, meaningful.doc.pages[0]!.id, publish)).toContain('role="img" aria-label="Rated 5 stars"');

    const decorative = withIcon({ icon: "binhi.icon.star" }, { label: "ignored", decorative: true });
    const html = renderPage(decorative.doc, decorative.doc.pages[0]!.id, publish);
    expect(html).not.toContain("ignored");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders a placeholder while the editor is still loading a category, but refuses to publish without geometry", () => {
    const { doc } = withIcon({ icon: "binhi.icon.leaf" });
    const editor = renderPage(doc, doc.pages[0]!.id, { mode: "editor", baseHref: "/", formAction: () => "#", iconShape: getLoadedShape });
    expect(editor).toContain("data-icon-pending");
    expect(() => renderPage(doc, doc.pages[0]!.id, { ...publish, iconShape: undefined })).toThrow(/could not be resolved/);
  });

  it("blocks publishing a document that holds an unresolvable icon id", () => {
    const { doc, node } = withIcon({ icon: "binhi.icon.star" });
    node.props.icon = "binhi.icon.gone";
    const report = validateForPublish(doc);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === "UNKNOWN_ICON")).toBe(true);
  });

  it("survives a save/reload round trip unchanged", () => {
    const { doc } = withIcon({ icon: "binhi.icon.heart", variant: "filled", size: 64 }, { label: "Favourite" });
    const reloaded = SiteDocument.parse(JSON.parse(JSON.stringify(doc)));
    expect(findIcon(reloaded)!.props).toEqual(findIcon(doc)!.props);
    expect(renderPage(reloaded, reloaded.pages[0]!.id, publish)).toEqual(renderPage(doc, doc.pages[0]!.id, publish));
  });
});
