import { useSyncExternalStore } from "react";
import {
  applyOperations,
  findNode,
  OperationError,
  validateForPublish,
  type Breakpoint,
  type Node,
  type Operation,
  type SiteDocument,
  type ValidationReport,
} from "../../core/index.js";
import { api, ApiError, type AssetRecord, type PublicationSummary, type SiteDetail } from "../api.js";

export type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict" | "offline";
export type LeftTab = "pages" | "elements" | "layers" | "media" | "styles" | "sections" | "navigation";
export type DragInsert = { kind: "component"; componentType: Node["type"] } | { kind: "reusable"; reusableId: string } | { kind: "asset"; asset: AssetRecord } | null;

export interface EditorState {
  siteId: string;
  siteName: string;
  slug: string;
  liveUrl: string | null;
  publication: PublicationSummary | null;
  document: SiteDocument;
  revision: number;
  pageId: string;
  selection: string[];
  hoverId: string | null;
  editingTextId: string | null;
  breakpoint: Breakpoint;
  zoom: number;
  fitZoom: boolean;
  showGrid: boolean;
  snapping: boolean;
  leftTab: LeftTab;
  leftOpen: boolean;
  rightOpen: boolean;
  saveState: SaveState;
  saveError: string | null;
  conflict: { serverRevision: number; serverDocument: SiteDocument } | null;
  canUndo: boolean;
  canRedo: boolean;
  clipboard: Node[];
  dragInsert: DragInsert;
  validation: ValidationReport;
  assets: AssetRecord[];
  lastError: string | null;
  dirtySinceSave: boolean;
}

type Listener = () => void;

const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY_MS = 700;

export function randomBatchId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Editor state container. Every change goes through `dispatch(ops)`, which
 * applies the same pure reducer the server uses, so an invalid edit fails
 * locally before anything is sent. Accepted ops are queued and autosaved as
 * one batch against the last confirmed revision.
 */
export class EditorStore {
  private state: EditorState;
  private listeners = new Set<Listener>();
  private undoStack: SiteDocument[] = [];
  private redoStack: SiteDocument[] = [];
  private pendingOps: Operation[] = [];
  private pendingBatchId: string | null = null;
  private inFlight = false;
  private timer: number | null = null;
  private onFlushed = new Set<() => void>();

  constructor(site: SiteDetail) {
    const home = site.document.pages.find((p) => p.isHome) ?? site.document.pages[0]!;
    this.state = {
      siteId: site.id,
      siteName: site.name,
      slug: site.slug,
      liveUrl: site.liveUrl,
      publication: site.publication,
      document: site.document,
      revision: site.revision,
      pageId: home.id,
      selection: [],
      hoverId: null,
      editingTextId: null,
      breakpoint: "desktop",
      zoom: 1,
      fitZoom: true,
      showGrid: false,
      snapping: true,
      leftTab: "elements",
      leftOpen: true,
      rightOpen: true,
      saveState: "saved",
      saveError: null,
      conflict: null,
      canUndo: false,
      canRedo: false,
      clipboard: [],
      dragInsert: null,
      validation: validateForPublish(site.document),
      assets: [],
      lastError: null,
      dirtySinceSave: false,
    };
    window.addEventListener("online", () => this.state.saveState === "offline" && this.scheduleSave(0));
  }

  /* ---------------------------------------------------------- subscribe */
  getState = (): EditorState => this.state;
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private set(patch: Partial<EditorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /* ------------------------------------------------------------ selectors */
  get page() {
    return this.state.document.pages.find((p) => p.id === this.state.pageId) ?? this.state.document.pages[0]!;
  }
  node(id: string) {
    return findNode(this.state.document, id);
  }
  selectedNodes() {
    return this.state.selection.map((id) => findNode(this.state.document, id)).filter((f): f is NonNullable<typeof f> => !!f);
  }

  /* ----------------------------------------------------------- ui actions */
  select(ids: string[], opts: { toggle?: boolean } = {}) {
    let next = ids;
    if (opts.toggle) {
      const cur = new Set(this.state.selection);
      ids.forEach((id) => (cur.has(id) ? cur.delete(id) : cur.add(id)));
      next = Array.from(cur);
    }
    if (next.join() === this.state.selection.join()) return;
    this.set({ selection: next, editingTextId: null });
  }
  hover(id: string | null) {
    if (id !== this.state.hoverId) this.set({ hoverId: id });
  }
  setEditingText(id: string | null) {
    this.set({ editingTextId: id });
  }
  setPage(pageId: string) {
    if (!this.state.document.pages.some((p) => p.id === pageId)) return;
    this.set({ pageId, selection: [], hoverId: null, editingTextId: null });
  }
  setBreakpoint(bp: Breakpoint) {
    this.set({ breakpoint: bp, fitZoom: true });
  }
  setZoom(zoom: number, fit = false) {
    this.set({ zoom: Math.min(3, Math.max(0.1, zoom)), fitZoom: fit });
  }
  setLeftTab(tab: LeftTab) {
    this.set({ leftTab: tab, leftOpen: this.state.leftTab === tab ? !this.state.leftOpen : true });
  }
  toggleRight() {
    this.set({ rightOpen: !this.state.rightOpen });
  }
  toggleGrid() {
    this.set({ showGrid: !this.state.showGrid });
  }
  toggleSnapping() {
    this.set({ snapping: !this.state.snapping });
  }
  setDragInsert(d: DragInsert) {
    this.set({ dragInsert: d });
  }
  setAssets(assets: AssetRecord[]) {
    this.set({ assets });
  }
  setPublication(publication: PublicationSummary | null, liveUrl: string | null) {
    this.set({ publication, liveUrl });
  }
  setMeta(patch: { siteName?: string; slug?: string }) {
    this.set({ ...(patch.siteName !== undefined ? { siteName: patch.siteName } : {}), ...(patch.slug !== undefined ? { slug: patch.slug } : {}) });
  }
  clearError() {
    if (this.state.lastError) this.set({ lastError: null });
  }

  /* -------------------------------------------------------------- editing */
  /** Apply ops locally and queue them for autosave. Returns created ids, or null when rejected. */
  dispatch(ops: Operation[], opts: { select?: boolean; history?: boolean } = {}): string[] | null {
    if (!ops.length) return [];
    try {
      const before = this.state.document;
      const result = applyOperations(before, ops);
      if (opts.history !== false) {
        this.undoStack.push(before);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
        this.redoStack = [];
      }
      this.pendingOps.push(...ops);
      const selection = opts.select && result.createdIds.length ? [result.createdIds[0]!] : this.pruneSelection(result.document);
      this.set({
        document: result.document,
        selection,
        saveState: this.state.saveState === "conflict" ? "conflict" : "unsaved",
        dirtySinceSave: true,
        canUndo: this.undoStack.length > 0,
        canRedo: this.redoStack.length > 0,
        validation: validateForPublish(result.document),
        lastError: null,
        pageId: result.document.pages.some((p) => p.id === this.state.pageId) ? this.state.pageId : (result.document.pages.find((p) => p.isHome) ?? result.document.pages[0]!).id,
      });
      this.scheduleSave();
      return result.createdIds;
    } catch (e) {
      const message = e instanceof OperationError ? e.message : e instanceof Error ? e.message : "That change is not allowed";
      this.set({ lastError: message });
      return null;
    }
  }

  private pruneSelection(doc: SiteDocument): string[] {
    return this.state.selection.filter((id) => !!findNode(doc, id));
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.state.document);
    this.replaceDocument(prev, "undo");
  }
  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.state.document);
    this.replaceDocument(next, "redo");
  }
  private replaceDocument(document: SiteDocument, reason: "undo" | "redo" | "restore") {
    this.pendingOps.push({ type: "replaceDocument", document, reason });
    this.set({
      document,
      selection: this.pruneSelection(document),
      editingTextId: null,
      saveState: this.state.saveState === "conflict" ? "conflict" : "unsaved",
      dirtySinceSave: true,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      validation: validateForPublish(document),
      pageId: document.pages.some((p) => p.id === this.state.pageId) ? this.state.pageId : (document.pages.find((p) => p.isHome) ?? document.pages[0]!).id,
    });
    this.scheduleSave();
  }

  copy() {
    const nodes = this.selectedNodes().map((f) => f.node);
    if (nodes.length) this.set({ clipboard: structuredClone(nodes) });
  }
  cut() {
    this.copy();
    this.deleteSelection();
  }
  paste() {
    const clip = this.state.clipboard;
    if (!clip.length) return;
    const target = this.pasteTarget(clip[0]!);
    if (!target) return;
    this.dispatch([{ type: "pasteNodes", target, nodes: clip, offset: 16 }], { select: true });
  }
  private pasteTarget(first: Node): { parentId: string; index?: number } | null {
    const sel = this.selectedNodes()[0];
    if (first.type === "section") return { parentId: this.state.pageId, index: sel && !sel.parent ? sel.index + 1 : undefined };
    if (!sel) {
      const firstSection = this.page.sections[0];
      return firstSection ? { parentId: firstSection.id } : null;
    }
    if (sel.node.children) return { parentId: sel.node.id };
    if (sel.parent) return { parentId: sel.parent.id, index: sel.index + 1 };
    return { parentId: sel.node.id };
  }
  duplicateSelection() {
    const ops: Operation[] = this.state.selection.map((nodeId) => ({ type: "duplicateNode", nodeId }));
    this.dispatch(ops, { select: true });
  }
  deleteSelection() {
    const ids = this.state.selection.filter((id) => {
      const f = this.node(id);
      return f && !f.node.locked;
    });
    if (!ids.length) return;
    this.dispatch(ids.map((nodeId) => ({ type: "deleteNode", nodeId })));
    this.set({ selection: [] });
  }

  /* -------------------------------------------------------------- saving */
  private scheduleSave(delay = AUTOSAVE_DELAY_MS) {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), delay);
  }

  /** Send queued ops now. Resolves when the queue is empty or blocked. */
  async flush(): Promise<void> {
    if (this.inFlight) {
      await new Promise<void>((r) => this.onFlushed.add(r));
      return this.flush();
    }
    if (this.state.conflict) return;
    if (!this.pendingOps.length) {
      if (this.state.saveState !== "saved" && this.state.saveState !== "conflict") this.set({ saveState: "saved", saveError: null });
      return;
    }
    const count = this.pendingOps.length;
    const ops = this.compact(this.pendingOps.slice(0, count));
    const batchId = this.pendingBatchId ?? randomBatchId();
    this.pendingBatchId = batchId;
    const baseRevision = this.state.revision;
    this.inFlight = true;
    this.set({ saveState: "saving" });
    try {
      const res = await api.applyOps(this.state.siteId, { baseRevision, ops, batchId });
      this.pendingOps = this.pendingOps.slice(count);
      this.pendingBatchId = null;
      this.set({ revision: res.revision, saveState: "saved", saveError: null, dirtySinceSave: false });
      if (res.replayed && res.document) {
        // The server already had this batch (a retry): adopt its document to stay exact.
        this.set({ document: res.document, validation: validateForPublish(res.document) });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const d = e.details as { serverRevision: number; document: SiteDocument };
        this.set({ saveState: "conflict", conflict: { serverRevision: d.serverRevision, serverDocument: d.document }, saveError: e.message });
      } else if (e instanceof ApiError && e.status === 0) {
        this.set({ saveState: "offline", saveError: e.message });
        this.scheduleSave(5000);
      } else if (e instanceof ApiError && (e.status === 422 || e.status === 400)) {
        // The server rejected something our local reducer accepted. Reload truth and tell the user.
        this.set({ saveState: "error", saveError: e.message, lastError: `Not saved: ${e.message}. Reloading the saved version.` });
        await this.reloadFromServer();
      } else {
        this.set({ saveState: "error", saveError: e instanceof Error ? e.message : "Could not save" });
        this.scheduleSave(4000);
      }
    } finally {
      this.inFlight = false;
      const waiters = Array.from(this.onFlushed);
      this.onFlushed.clear();
      waiters.forEach((w) => w());
      if (this.pendingOps.length && this.state.saveState === "saved") this.scheduleSave(0);
    }
  }

  /** Merge runs of style/placement/prop updates on the same node so autosave batches stay small. */
  private compact(ops: Operation[]): Operation[] {
    const out: Operation[] = [];
    for (const op of ops) {
      const last = out[out.length - 1];
      if (last && last.type === "updatePlacement" && op.type === "updatePlacement" && last.nodeId === op.nodeId && last.breakpoint === op.breakpoint) {
        out[out.length - 1] = { ...op, placement: { ...last.placement, ...op.placement } };
        continue;
      }
      if (last && last.type === "updateStyle" && op.type === "updateStyle" && last.nodeId === op.nodeId && last.breakpoint === op.breakpoint && !last.unset && !op.unset) {
        out[out.length - 1] = { ...op, style: { ...last.style, ...op.style } };
        continue;
      }
      if (last && last.type === "updateProps" && op.type === "updateProps" && last.nodeId === op.nodeId) {
        out[out.length - 1] = { ...op, props: { ...last.props, ...op.props } };
        continue;
      }
      if (op.type === "replaceDocument") {
        // Everything before a snapshot is subsumed by it.
        out.length = 0;
      }
      out.push(op);
    }
    return out;
  }

  /** Conflict resolution: take the server's version (discarding local unsaved edits). */
  async resolveConflictUseServer() {
    const c = this.state.conflict;
    if (!c) return;
    this.pendingOps = [];
    this.pendingBatchId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.set({ document: c.serverDocument, revision: c.serverRevision, conflict: null, saveState: "saved", saveError: null, selection: [], canUndo: false, canRedo: false, validation: validateForPublish(c.serverDocument), dirtySinceSave: false });
  }

  /** Conflict resolution: keep the local document by writing it as a new revision on top of the server's. */
  async resolveConflictKeepMine() {
    const c = this.state.conflict;
    if (!c) return;
    const document = this.state.document;
    this.pendingOps = [{ type: "replaceDocument", document, reason: "restore" }];
    this.pendingBatchId = null;
    this.set({ conflict: null, revision: c.serverRevision, saveState: "unsaved" });
    await this.flush();
  }

  async reloadFromServer() {
    const r = await api.site(this.state.siteId);
    this.pendingOps = [];
    this.pendingBatchId = null;
    this.set({ document: r.site.document, revision: r.site.revision, saveState: "saved", conflict: null, selection: this.pruneSelection(r.site.document), validation: validateForPublish(r.site.document), publication: r.site.publication, liveUrl: r.site.liveUrl, siteName: r.site.name, slug: r.site.slug, dirtySinceSave: false });
  }

  /** Restore a revision: flush pending edits first so the base revision is exact. */
  async restoreRevision(revision: number): Promise<void> {
    await this.flush();
    const r = await api.restore(this.state.siteId, revision, this.state.revision);
    this.undoStack.push(this.state.document);
    this.redoStack = [];
    this.set({ document: r.document, revision: r.revision, saveState: "saved", selection: [], canUndo: true, canRedo: false, validation: validateForPublish(r.document), dirtySinceSave: false });
  }

  hasUnsavedChanges(): boolean {
    return this.pendingOps.length > 0 || this.state.saveState === "saving" || this.state.saveState === "conflict";
  }

  destroy() {
    if (this.timer) window.clearTimeout(this.timer);
  }
}

export function useEditorState<T>(store: EditorStore, selector: (s: EditorState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}
