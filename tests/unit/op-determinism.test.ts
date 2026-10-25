// @vitest-environment jsdom
/**
 * Invariant: what the editor has on screen after a burst of edits must equal what the server produces when it
 * replays the queued batch. Any operation that mints ids (composite components, duplicates, pastes, groups, pages,
 * reusable sections, inserted sections) must therefore mint the *same* ids on both sides, otherwise an edit made
 * before the first autosave references an element the server never created and the save is rejected (data loss).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const applyOps = vi.fn();
vi.mock("../../src/client/api.js", () => ({
  api: { applyOps: (...a: unknown[]) => applyOps(...a), site: vi.fn(), restore: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) {
      super(message);
    }
  },
}));

import { EditorStore } from "../../src/client/editor/store.js";
import { applyOperations, createSiteDocument, findNode, getTemplate, OperationBatch, type Node, type Operation, type SiteDocument } from "../../src/core/index.js";

type Batch = { ops: Operation[]; seeds?: string[]; baseRevision: number; batchId: string };

function newStore(templateId = "blank") {
  const document = createSiteDocument(templateId as never, "Determinism");
  const store = new EditorStore({ id: "site_abcdefghij", name: "Determinism", slug: "determinism", templateId, revision: 0, livePublicationId: null, createdAt: "", updatedAt: "", publication: null, liveUrl: null, document });
  return { store, base: structuredClone(document) as SiteDocument };
}

/** Flush the store's queue and replay exactly what would be sent, through the real wire schema, as the server does. */
async function serverReplay(store: EditorStore, base: SiteDocument): Promise<SiteDocument> {
  applyOps.mockResolvedValue({ revision: 1, createdIds: [], replayed: false });
  await vi.advanceTimersByTimeAsync(1000);
  expect(applyOps).toHaveBeenCalledTimes(1);
  const [, sent] = applyOps.mock.calls[0] as [string, Batch];
  const wire = OperationBatch.parse(JSON.parse(JSON.stringify(sent)));
  return applyOperations(base, wire.ops, wire.idSeeds).document;
}

/** Wall-clock stamps legitimately differ between the two applications; ids and content must not. */
const comparable = (doc: SiteDocument) => ({ ...doc, reusableSections: doc.reusableSections.map(({ updatedAt: _t, ...r }) => r) });

const firstSectionId = (s: EditorStore) => s.page.sections[0]!.id;
const anyNodeOfType = (doc: SiteDocument, type: string): Node => {
  let found: Node | undefined;
  const visit = (n: Node) => { if (n.type === type && !found) found = n; n.children?.forEach(visit); };
  doc.pages.flatMap((p) => p.sections).forEach(visit);
  return found!;
};

describe("operations mint identical ids on the client and the server", () => {
  beforeEach(() => {
    applyOps.mockReset();
    vi.useFakeTimers();
  });

  it("a composite component (card with default children), then an edit to one of its children", async () => {
    const { store, base } = newStore();
    const [cardId] = store.dispatch([{ type: "insertComponent", target: { parentId: firstSectionId(store) }, componentType: "card" }], { select: true })!;
    const card = findNode(store.getState().document, cardId!)!.node;
    expect(card.children?.length).toBeGreaterThan(0);
    store.dispatch([{ type: "updateProps", nodeId: card.children![0]!.id, props: { text: "Edited child" } }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("duplicate, then edit the copy's child", async () => {
    const { store, base } = newStore("portfolio");
    const card = anyNodeOfType(store.getState().document, "card");
    store.select([card.id]);
    store.duplicateSelection();
    const copyId = store.getState().selection[0]!;
    const copy = findNode(store.getState().document, copyId)!.node;
    store.dispatch([{ type: "updateProps", nodeId: copy.children![0]!.id, props: { text: "Copy edited" } }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("copy and paste a container, then edit a pasted descendant", async () => {
    const { store, base } = newStore("portfolio");
    const card = anyNodeOfType(store.getState().document, "card");
    store.select([card.id]);
    store.copy();
    store.paste();
    const pastedId = store.getState().selection[0]!;
    const pasted = findNode(store.getState().document, pastedId)!.node;
    expect(pasted.id).not.toBe(card.id);
    store.dispatch([{ type: "updateStyle", nodeId: pasted.children![0]!.id, breakpoint: "desktop", style: { color: "#cc0000" } }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("insert a whole node tree (sections panel / template section), then edit inside it", async () => {
    const { store, base } = newStore("portfolio");
    const donor = structuredClone(anyNodeOfType(store.getState().document, "card"));
    store.dispatch([{ type: "insertNode", target: { parentId: firstSectionId(store) }, node: donor }], { select: true });
    const inserted = findNode(store.getState().document, store.getState().selection[0]!)!.node;
    store.dispatch([{ type: "updateProps", nodeId: inserted.children![0]!.id, props: { text: "In the new tree" } }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("group two elements, then rename the group", async () => {
    const { store, base } = newStore();
    const section = store.page.sections[0]!;
    for (const componentType of ["heading", "paragraph"] as const) store.dispatch([{ type: "insertComponent", target: { parentId: section.id }, componentType }]);
    store.dispatch([{ type: "setLayout", nodeId: section.id, layout: { mode: "free" } }]); // grouping needs a free-layout parent
    const ids = (store.page.sections[0]!.children ?? []).slice(0, 2).map((c) => c.id);
    expect(store.dispatch([{ type: "groupNodes", nodeIds: ids }], { select: true }), store.getState().lastError ?? "").not.toBeNull();
    store.dispatch([{ type: "renameNode", nodeId: store.getState().selection[0]!, name: "My group" }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("add a page (and a duplicate of a page), then edit inside the new page", async () => {
    const { store, base } = newStore("portfolio");
    const home = store.getState().document.pages[0]!;
    store.dispatch([{ type: "addPage", page: { name: "Extra" }, fromPageId: home.id }]);
    const added = store.getState().document.pages.at(-1)!;
    const heading = anyNodeOfType({ ...store.getState().document, pages: [added] }, "heading");
    store.dispatch([{ type: "updateProps", nodeId: heading.id, props: { text: "Edited on the new page" } }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("save a section as reusable, insert it, then edit the inserted copy", async () => {
    const { store, base } = newStore("portfolio");
    const section = store.page.sections[0]!;
    store.dispatch([{ type: "saveReusableSection", nodeId: section.id, name: "Reusable" }]);
    const reusableId = store.getState().document.reusableSections?.[0]?.id ?? (store.getState().document as unknown as { reusable: { id: string }[] }).reusable?.[0]?.id;
    expect(reusableId).toBeTruthy();
    store.dispatch([{ type: "insertReusableSection", reusableId: reusableId!, target: { parentId: store.getState().pageId } }], { select: true });
    const inserted = findNode(store.getState().document, store.getState().selection[0]!)!.node;
    store.dispatch([{ type: "renameNode", nodeId: inserted.id, name: "Inserted reusable" }]);
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("a burst: insert several components and edit each before the autosave fires", async () => {
    const { store, base } = newStore();
    for (const type of ["heading", "button", "icon", "hero"] as const) {
      const [id] = store.dispatch([{ type: "insertComponent", target: { parentId: firstSectionId(store) }, componentType: type }], { select: true })!;
      store.dispatch([{ type: "renameNode", nodeId: id!, name: `Edited ${type}` }]);
    }
    expect(comparable(await serverReplay(store, base))).toEqual(comparable(store.getState().document));
  });

  it("keeps working for clients that send no seeds (older builds)", () => {
    const { base } = newStore();
    const ops: Operation[] = [{ type: "insertComponent", target: { parentId: base.pages[0]!.sections[0]!.id }, componentType: "card" }];
    expect(() => applyOperations(base, ops)).not.toThrow();
    expect(getTemplate).toBeTruthy();
  });
});
