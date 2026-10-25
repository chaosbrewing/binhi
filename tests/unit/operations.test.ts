import { describe, it, expect } from "vitest";
import {
  applyOperation,
  applyOperations,
  createSiteDocument,
  findNode,
  makeNode,
  OperationError,
  Operation,
  type SiteDocument,
} from "../../src/core/index.js";

function blank(): SiteDocument {
  return createSiteDocument("blank", "Ops");
}
function firstSection(doc: SiteDocument) {
  return doc.pages[0]!.sections[0]!;
}

describe("operations", () => {
  it("validates operation payloads", () => {
    expect(Operation.safeParse({ type: "updateProps", nodeId: "nope", props: {} }).success).toBe(false);
    expect(Operation.safeParse({ type: "insertComponent", target: { parentId: "sect_abcdefgh" }, componentType: "nothing" }).success).toBe(false);
  });

  it("inserts a component and selects the created id", () => {
    const doc = blank();
    const sec = firstSection(doc);
    const r = applyOperation(doc, { type: "insertComponent", target: { parentId: sec.id }, componentType: "button" });
    expect(r.createdIds).toHaveLength(1);
    const f = findNode(r.document, r.createdIds[0]!);
    expect(f?.node.type).toBe("button");
    expect(f?.parent?.id).toBe(sec.id);
    // original untouched
    expect(findNode(doc, r.createdIds[0]!)).toBeNull();
  });

  it("refuses to put a section inside a container and a column cell outside columns", () => {
    const doc = blank();
    const sec = firstSection(doc);
    expect(() => applyOperation(doc, { type: "insertComponent", target: { parentId: sec.id }, componentType: "section" })).toThrow(OperationError);
    expect(() => applyOperation(doc, { type: "insertComponent", target: { parentId: doc.pages[0]!.id }, componentType: "heading" })).toThrow(/Only sections/);
  });

  it("validates props against the registry", () => {
    const doc = blank();
    const heading = firstSection(doc).children![0]!;
    expect(() => applyOperation(doc, { type: "updateProps", nodeId: heading.id, props: { level: 9 } })).toThrow();
    const ok = applyOperation(doc, { type: "updateProps", nodeId: heading.id, props: { level: 1, text: "Hello" } });
    expect(findNode(ok.document, heading.id)!.node.props.text).toBe("Hello");
  });

  it("applies breakpoint style overrides without touching desktop", () => {
    const doc = blank();
    const heading = firstSection(doc).children![0]!;
    const r = applyOperation(doc, { type: "updateStyle", nodeId: heading.id, breakpoint: "mobile", style: { fontSize: 24 } });
    const n = findNode(r.document, heading.id)!.node;
    expect(n.responsive?.mobile?.fontSize).toBe(24);
    expect(n.style.fontSize).toBeUndefined();
    const r2 = applyOperation(r.document, { type: "updateStyle", nodeId: heading.id, breakpoint: "mobile", style: {}, unset: ["fontSize"] });
    expect(findNode(r2.document, heading.id)!.node.responsive?.mobile?.fontSize).toBeUndefined();
  });

  it("locked elements cannot be changed or deleted, but can be unlocked", () => {
    const doc = blank();
    const heading = firstSection(doc).children![0]!;
    const locked = applyOperation(doc, { type: "setLocked", nodeId: heading.id, locked: true }).document;
    expect(() => applyOperation(locked, { type: "deleteNode", nodeId: heading.id })).toThrow(/locked/i);
    expect(() => applyOperation(locked, { type: "updateProps", nodeId: heading.id, props: { text: "x" } })).toThrow(/locked/i);
    const unlocked = applyOperation(locked, { type: "setLocked", nodeId: heading.id, locked: false }).document;
    expect(() => applyOperation(unlocked, { type: "deleteNode", nodeId: heading.id })).not.toThrow();
  });

  it("switching a section to freeform gives children placements; group and ungroup keep geometry", () => {
    const doc = blank();
    const sec = firstSection(doc);
    let d = applyOperation(doc, { type: "setLayout", nodeId: sec.id, layout: { mode: "free", designWidth: 1000, designHeight: 500 } }).document;
    const kids = findNode(d, sec.id)!.node.children!;
    expect(kids.every((k) => k.placement?.desktop)).toBe(true);
    d = applyOperation(d, { type: "updatePlacement", nodeId: kids[0]!.id, placement: { x: 100, y: 50, width: 300, height: 60 } }).document;
    d = applyOperation(d, { type: "updatePlacement", nodeId: kids[1]!.id, placement: { x: 200, y: 200, width: 200, height: 100 } }).document;
    const g = applyOperation(d, { type: "groupNodes", nodeIds: [kids[0]!.id, kids[1]!.id] });
    const group = findNode(g.document, g.createdIds[0]!)!.node;
    expect(group.type).toBe("group");
    expect(group.placement!.desktop).toMatchObject({ x: 100, y: 50, width: 300, height: 250 });
    const inner = group.children!.find((c) => c.id === kids[1]!.id)!;
    expect(inner.placement!.desktop).toMatchObject({ x: 100, y: 150 });
    const u = applyOperation(g.document, { type: "ungroupNode", nodeId: group.id }).document;
    expect(findNode(u, group.id)).toBeNull();
    expect(findNode(u, kids[1]!.id)!.node.placement!.desktop).toMatchObject({ x: 200, y: 200 });
  });

  it("aligns and distributes freeform elements", () => {
    const doc = blank();
    const sec = firstSection(doc);
    let d = applyOperation(doc, { type: "setLayout", nodeId: sec.id, layout: { mode: "free", designWidth: 1000, designHeight: 500 } }).document;
    const ins = applyOperations(d, [
      { type: "insertComponent", target: { parentId: sec.id, placement: { x: 0, y: 0, width: 100, height: 50, rotation: 0, z: 0 } }, componentType: "shape" },
      { type: "insertComponent", target: { parentId: sec.id, placement: { x: 300, y: 80, width: 100, height: 50, rotation: 0, z: 0 } }, componentType: "shape" },
      { type: "insertComponent", target: { parentId: sec.id, placement: { x: 900, y: 10, width: 100, height: 50, rotation: 0, z: 0 } }, componentType: "shape" },
    ]);
    d = ins.document;
    const ids = ins.createdIds;
    const aligned = applyOperation(d, { type: "alignNodes", nodeIds: ids, alignment: "top" }).document;
    expect(ids.every((id) => findNode(aligned, id)!.node.placement!.desktop.y === 0)).toBe(true);
    const dist = applyOperation(aligned, { type: "distributeNodes", nodeIds: ids, axis: "horizontal" }).document;
    expect(findNode(dist, ids[1]!)!.node.placement!.desktop.x).toBe(450);
    const centered = applyOperation(d, { type: "alignNodes", nodeIds: [ids[0]!], alignment: "centerX" }).document;
    expect(findNode(centered, ids[0]!)!.node.placement!.desktop.x).toBe(450);
  });

  it("reorders layers in flow and z-order in free layouts", () => {
    const doc = blank();
    const sec = firstSection(doc);
    const [h, p] = sec.children!;
    const d = applyOperation(doc, { type: "reorderLayer", nodeId: h!.id, direction: "front" }).document;
    expect(findNode(d, sec.id)!.node.children!.map((c) => c.id)).toEqual([p!.id, h!.id]);
    const free = applyOperation(doc, { type: "setLayout", nodeId: sec.id, layout: { mode: "free" } }).document;
    const z = applyOperation(free, { type: "reorderLayer", nodeId: h!.id, direction: "front" }).document;
    expect(findNode(z, h!.id)!.node.placement!.desktop.z).toBe(1);
  });

  it("duplicate, copy/paste and delete keep ids unique and the page editable", () => {
    const doc = blank();
    const sec = firstSection(doc);
    const dup = applyOperation(doc, { type: "duplicateNode", nodeId: sec.id });
    expect(dup.document.pages[0]!.sections).toHaveLength(2);
    expect(dup.createdIds).not.toContain(sec.id);
    const pasted = applyOperation(doc, { type: "pasteNodes", target: { parentId: sec.id }, nodes: [sec.children![0]!] });
    expect(findNode(pasted.document, sec.id)!.node.children).toHaveLength(3);
    const del = applyOperation(doc, { type: "deleteNode", nodeId: sec.id }).document;
    expect(del.pages[0]!.sections).toHaveLength(1);
    expect(del.pages[0]!.sections[0]!.id).not.toBe(sec.id);
  });

  it("moves nodes between parents and refuses cycles", () => {
    const doc = createSiteDocument("portfolio", "P");
    const home = doc.pages[0]!;
    const hero = home.sections[0]!.children![0]!;
    const target = home.sections[1]!;
    const d = applyOperation(doc, { type: "moveNode", nodeId: hero.id, target: { parentId: target.id, index: 0 } }).document;
    expect(findNode(d, hero.id)!.parent!.id).toBe(target.id);
    expect(() => applyOperation(doc, { type: "moveNode", nodeId: home.sections[0]!.id, target: { parentId: hero.id } })).toThrow();
  });

  it("page operations: add, duplicate, rename slug uniqueness, reorder, home, delete", () => {
    const doc = blank();
    let d = applyOperation(doc, { type: "addPage", page: { name: "About us" } }).document;
    expect(d.pages[1]!.slug).toBe("about-us");
    d = applyOperation(d, { type: "addPage", page: { name: "About us" } }).document;
    expect(d.pages[2]!.slug).toBe("about-us-2");
    expect(() => applyOperation(d, { type: "updatePage", pageId: d.pages[2]!.id, patch: { slug: "about-us" } })).toThrow(/already uses/);
    const dupe = applyOperation(d, { type: "addPage", page: { name: "Copy" }, fromPageId: d.pages[0]!.id }).document;
    expect(dupe.pages[3]!.sections[0]!.id).not.toBe(d.pages[0]!.sections[0]!.id);
    const re = applyOperation(d, { type: "reorderPages", pageIds: [d.pages[2]!.id, d.pages[0]!.id] }).document;
    expect(re.pages.map((p) => p.name)).toEqual(["About us", "Home", "About us"]);
    const home = applyOperation(re, { type: "setHomePage", pageId: re.pages[0]!.id }).document;
    expect(home.pages.filter((p) => p.isHome).map((p) => p.id)).toEqual([re.pages[0]!.id]);
    const del = applyOperation(home, { type: "deletePage", pageId: home.pages[0]!.id }).document;
    expect(del.pages.some((p) => p.isHome)).toBe(true);
    expect(() => applyOperation(blank(), { type: "deletePage", pageId: blank().pages[0]!.id })).toThrow();
  });

  it("theme and text style updates are validated and merged", () => {
    const doc = blank();
    const d = applyOperation(doc, { type: "updateTheme", patch: { colors: { primary: "#123456" }, fonts: { heading: "Lora" } } }).document;
    expect(d.theme.colors.primary).toBe("#123456");
    expect(d.theme.fonts.body).toBe("Inter");
    expect(() => applyOperation(doc, { type: "updateTheme", patch: { colors: { primary: "red;x" } } })).toThrow();
    const t = applyOperation(doc, { type: "updateTextStyle", key: "heading1", style: { fontSize: 72 } }).document;
    expect(t.theme.textStyles.heading1.fontSize).toBe(72);
  });

  it("reusable sections: save, insert, update propagates, detach", () => {
    const doc = blank();
    const sec = firstSection(doc);
    const saved = applyOperation(doc, { type: "saveReusableSection", nodeId: sec.id, name: "Intro" });
    const rid = saved.createdIds[0]!;
    let d = applyOperation(saved.document, { type: "insertReusableSection", reusableId: rid, target: { parentId: d0(saved.document) } }).document;
    expect(d.pages[0]!.sections).toHaveLength(2);
    expect(d.pages[0]!.sections[1]!.reusableId).toBe(rid);
    const headingId = d.pages[0]!.sections[0]!.children![0]!.id;
    d = applyOperation(d, { type: "updateProps", nodeId: headingId, props: { text: "Changed" } }).document;
    d = applyOperation(d, { type: "updateReusableSection", reusableId: rid, fromNodeId: sec.id }).document;
    expect(d.pages[0]!.sections[1]!.children![0]!.props.text).toBe("Changed");
    d = applyOperation(d, { type: "detachReusable", nodeId: d.pages[0]!.sections[1]!.id }).document;
    expect(d.pages[0]!.sections[1]!.reusableId).toBeUndefined();
  });

  it("a batch is atomic: a failing op leaves the input untouched", () => {
    const doc = blank();
    const heading = firstSection(doc).children![0]!;
    expect(() =>
      applyOperations(doc, [
        { type: "updateProps", nodeId: heading.id, props: { text: "applied?" } },
        { type: "deleteNode", nodeId: "node_doesnotexist" },
      ]),
    ).toThrow();
    expect(findNode(doc, heading.id)!.node.props.text).not.toBe("applied?");
  });

  it("replaceDocument validates the whole document", () => {
    const doc = blank();
    const bad = structuredClone(doc) as unknown as Record<string, unknown>;
    bad.pages = [];
    expect(() => applyOperation(doc, { type: "replaceDocument", document: bad as never, reason: "undo" })).toThrow();
  });
});

function d0(doc: SiteDocument) {
  return doc.pages[0]!.id;
}

describe("editing never discards props this build does not understand", () => {
  it("keeps already-stored unknown props across updateProps, but still strips unknown props sent in the op", () => {
    const doc = createSiteDocument("blank", "x");
    const section = doc.pages[0]!.sections[0]!;
    let d = applyOperation(doc, { type: "insertComponent", target: { parentId: section.id }, componentType: "icon", nodeId: "icon_keepme0001", props: { name: "star", size: 32 } }).document;
    // simulate content written by a newer build
    const node = d.pages[0]!.sections[0]!.children!.find((n) => n.id === "icon_keepme0001")!;
    node.props.futureSetting = { mode: "x" };
    d = applyOperation(d, { type: "updateProps", nodeId: "icon_keepme0001", props: { size: 40, injected: "<script>" } }).document;
    const after = d.pages[0]!.sections[0]!.children!.find((n) => n.id === "icon_keepme0001")!;
    expect(after.props.size).toBe(40);
    expect(after.props.futureSetting).toEqual({ mode: "x" });
    expect(after.props).not.toHaveProperty("injected");
  });
});
