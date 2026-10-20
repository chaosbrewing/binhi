// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { createSiteDocument } from "../../src/core/index.js";

function makeStore() {
  const document = createSiteDocument("blank", "Store Test");
  return new EditorStore({ id: "site_abcdefghij", name: "Store Test", slug: "store-test", templateId: "blank", revision: 0, livePublicationId: null, createdAt: "", updatedAt: "", publication: null, liveUrl: null, document });
}

describe("EditorStore autosave", () => {
  beforeEach(() => {
    applyOps.mockReset();
    vi.useFakeTimers();
  });

  it("applies locally, queues the ops and posts one batch against the base revision", async () => {
    const store = makeStore();
    applyOps.mockResolvedValue({ revision: 1, createdIds: [], replayed: false });
    const heading = store.page.sections[0]!.children![0]!;
    const created = store.dispatch([{ type: "updateProps", nodeId: heading.id, props: { text: "Changed" } }]);
    expect(created).toEqual([]);
    expect(store.getState().saveState).toBe("unsaved");
    expect(store.node(heading.id)!.node.props.text).toBe("Changed");
    await vi.advanceTimersByTimeAsync(800);
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [, batch] = applyOps.mock.calls[0] as [string, { baseRevision: number; ops: unknown[]; batchId: string }];
    expect(batch.baseRevision).toBe(0);
    expect(batch.ops).toHaveLength(1);
    expect(batch.batchId.length).toBeGreaterThanOrEqual(8);
    expect(store.getState().saveState).toBe("saved");
    expect(store.getState().revision).toBe(1);
  });

  it("rejects invalid edits locally without queuing anything", async () => {
    const store = makeStore();
    const r = store.dispatch([{ type: "deleteNode", nodeId: "node_missing12" }]);
    expect(r).toBeNull();
    expect(store.getState().lastError).toMatch(/does not exist/);
    await vi.advanceTimersByTimeAsync(1000);
    expect(applyOps).not.toHaveBeenCalled();
  });

  it("compacts consecutive style updates and keeps ops added during a save", async () => {
    const store = makeStore();
    let resolveFirst: (v: unknown) => void = () => undefined;
    applyOps.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r))).mockResolvedValueOnce({ revision: 2, createdIds: [], replayed: false });
    const heading = store.page.sections[0]!.children![0]!;
    store.dispatch([{ type: "updateStyle", nodeId: heading.id, style: { fontSize: 20 } }]);
    store.dispatch([{ type: "updateStyle", nodeId: heading.id, style: { color: "#ff0000" } }]);
    await vi.advanceTimersByTimeAsync(800);
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect((applyOps.mock.calls[0]![1] as { ops: unknown[] }).ops).toHaveLength(1);
    // an edit while the first batch is in flight
    store.dispatch([{ type: "updateProps", nodeId: heading.id, props: { text: "Later" } }]);
    resolveFirst({ revision: 1, createdIds: [], replayed: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(applyOps).toHaveBeenCalledTimes(2);
    expect((applyOps.mock.calls[1]![1] as { baseRevision: number }).baseRevision).toBe(1);
    expect(store.getState().revision).toBe(2);
  });

  it("undo and redo are sent as validated document snapshots", async () => {
    const store = makeStore();
    applyOps.mockResolvedValue({ revision: 1, createdIds: [], replayed: false });
    const heading = store.page.sections[0]!.children![0]!;
    const before = store.node(heading.id)!.node.props.text;
    store.dispatch([{ type: "updateProps", nodeId: heading.id, props: { text: "Changed" } }]);
    store.undo();
    expect(store.node(heading.id)!.node.props.text).toBe(before);
    expect(store.getState().canRedo).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    const ops = (applyOps.mock.calls[0]![1] as { ops: { type: string }[] }).ops;
    expect(ops[ops.length - 1]!.type).toBe("replaceDocument");
  });

  it("enters the conflict state on 409 and can adopt the server copy", async () => {
    const store = makeStore();
    const { ApiError } = await import("../../src/client/api.js");
    const serverDoc = createSiteDocument("blank", "Server copy");
    applyOps.mockRejectedValue(new ApiError(409, "CONFLICT", "stale", { serverRevision: 5, document: serverDoc }));
    const heading = store.page.sections[0]!.children![0]!;
    store.dispatch([{ type: "updateProps", nodeId: heading.id, props: { text: "Mine" } }]);
    await vi.advanceTimersByTimeAsync(800);
    expect(store.getState().saveState).toBe("conflict");
    await store.resolveConflictUseServer();
    expect(store.getState().revision).toBe(5);
    expect(store.getState().document.name).toBe("Server copy");
    expect(store.getState().saveState).toBe("saved");
  });
});
