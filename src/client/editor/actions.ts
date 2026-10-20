import { getDefinition, type ComponentType, type Operation, type Node } from "../../core/index.js";
import type { EditorStore } from "./store.js";

/** Insert a component relative to the current selection (or at the end of the first section). */
export function insertComponent(store: EditorStore, componentType: ComponentType, props?: Record<string, unknown>): string[] | null {
  const s = store.getState();
  const def = getDefinition(componentType);
  if (def.rootOnly) {
    const sel = store.selectedNodes()[0];
    const index = sel && !sel.parent && sel.location.kind === "page" ? sel.index + 1 : undefined;
    return store.dispatch([{ type: "insertComponent", target: { parentId: s.pageId, index }, componentType, props }], { select: true });
  }
  const target = insertTargetFromSelection(store);
  if (!target) return null;
  return store.dispatch([{ type: "insertComponent", target, componentType, props }], { select: true });
}

export function insertTargetFromSelection(store: EditorStore): { parentId: string; index?: number } | null {
  const sel = store.selectedNodes()[0];
  if (!sel) {
    const first = store.page.sections[0];
    return first ? { parentId: first.id } : null;
  }
  if (sel.node.children && getDefinition(sel.node.type).container) return { parentId: sel.node.id };
  if (sel.parent) return { parentId: sel.parent.id, index: sel.index + 1 };
  return { parentId: sel.node.id };
}

export function insertNode(store: EditorStore, node: Node): string[] | null {
  const target = node.type === "section" ? { parentId: store.getState().pageId } : insertTargetFromSelection(store);
  if (!target) return null;
  return store.dispatch([{ type: "insertNode", target, node }], { select: true });
}

export function toggleLock(store: EditorStore) {
  const ops: Operation[] = store.selectedNodes().map((f) => ({ type: "setLocked", nodeId: f.node.id, locked: !f.node.locked }));
  store.dispatch(ops);
}

export function toggleHidden(store: EditorStore) {
  const ops: Operation[] = store.selectedNodes().map((f) => ({ type: "setHidden", nodeId: f.node.id, hidden: !f.node.hidden }));
  store.dispatch(ops);
}

export function reorder(store: EditorStore, direction: "forward" | "backward" | "front" | "back") {
  const ops: Operation[] = store.getState().selection.map((nodeId) => ({ type: "reorderLayer", nodeId, direction }));
  store.dispatch(ops);
}

export function group(store: EditorStore) {
  const ids = store.getState().selection;
  if (ids.length < 2) return;
  store.dispatch([{ type: "groupNodes", nodeIds: ids }], { select: true });
}

export function ungroup(store: EditorStore) {
  const groups = store.selectedNodes().filter((f) => f.node.type === "group");
  if (!groups.length) return;
  const childIds = groups.flatMap((g) => (g.node.children ?? []).map((c) => c.id));
  store.dispatch(groups.map((g) => ({ type: "ungroupNode" as const, nodeId: g.node.id })));
  store.select(childIds);
}

export function align(store: EditorStore, alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") {
  const ids = store.getState().selection;
  if (!ids.length) return;
  store.dispatch([{ type: "alignNodes", nodeIds: ids, alignment, breakpoint: store.getState().breakpoint }]);
}

export function distribute(store: EditorStore, axis: "horizontal" | "vertical") {
  const ids = store.getState().selection;
  if (ids.length < 3) return;
  store.dispatch([{ type: "distributeNodes", nodeIds: ids, axis, breakpoint: store.getState().breakpoint }]);
}

/** Nudge free-positioned selection with the arrow keys; reorder flow children. */
export function nudge(store: EditorStore, dx: number, dy: number) {
  const bp = store.getState().breakpoint;
  const ops: Operation[] = [];
  for (const f of store.selectedNodes()) {
    if (f.node.locked) continue;
    if (f.parent?.layout?.mode === "free" && f.node.placement) {
      const p = bp === "desktop" ? f.node.placement.desktop : (f.node.placement[bp] ?? (bp === "mobile" ? f.node.placement.tablet : undefined) ?? f.node.placement.desktop);
      ops.push({ type: "updatePlacement", nodeId: f.node.id, breakpoint: bp, placement: { x: p.x + dx, y: p.y + dy } });
    } else if (dy !== 0 && dx === 0) {
      ops.push({ type: "reorderLayer", nodeId: f.node.id, direction: dy < 0 ? "backward" : "forward" });
    }
  }
  if (ops.length) store.dispatch(ops);
}

export function selectionIsFree(store: EditorStore): boolean {
  const nodes = store.selectedNodes();
  return nodes.length > 0 && nodes.every((f) => f.parent?.layout?.mode === "free" && !!f.node.placement);
}

export function nodeLabel(node: Node): string {
  return node.name || getDefinition(node.type).label;
}
