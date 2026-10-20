import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore, useSel } from "../context.js";
import { dragBridge } from "../dragBridge.js";
import { BREAKPOINT_WIDTHS, findNode, getDefinition, renderPage, type Breakpoint, type Node, type Operation, type Placement } from "../../../core/index.js";
import { angleFrom, dropIndex, normalizeAngle, rectsIntersect, resizePlacement, round, snapMove, type Guide, type HandleName, type Rect } from "./geometry.js";
import { I } from "../../components/Icons.js";
import { nodeLabel, reorder } from "../actions.js";

const DRAG_THRESHOLD = 4;
const GRID = 8;

type Drag =
  | { kind: "pending"; startX: number; startY: number; targetId: string | null; shift: boolean }
  | { kind: "move"; startX: number; startY: number; items: { id: string; start: Placement; el: HTMLElement }[]; parentId: string; parentBox: Rect; layout: { designWidth: number; designHeight: number }; scale: number; siblings: Rect[]; guides: Guide[] }
  | { kind: "reorder"; startX: number; startY: number; id: string; el: HTMLElement }
  | { kind: "resize"; id: string; el: HTMLElement; start: Placement; handle: HandleName; startX: number; startY: number; scale: number; layout: { designWidth: number; designHeight: number } }
  | { kind: "resizeFlow"; id: string; el: HTMLElement; handle: HandleName; startX: number; startY: number; startW: number; startH: number }
  | { kind: "rotate"; id: string; el: HTMLElement; start: Placement; cx: number; cy: number; startAngle: number }
  | { kind: "marquee"; startX: number; startY: number; rect: Rect }
  | { kind: "insert" };

interface DropTarget {
  parentId: string;
  index?: number;
  placement?: Placement;
  line?: Rect;
  box?: Rect;
}

function placementFor(node: Node, bp: Breakpoint): Placement | undefined {
  if (!node.placement) return undefined;
  if (bp === "desktop") return node.placement.desktop;
  return node.placement[bp] ?? (bp === "mobile" ? node.placement.tablet : undefined) ?? node.placement.desktop;
}

function toRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

export function Canvas() {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const pageId = useSel((s) => s.pageId);
  const selection = useSel((s) => s.selection);
  const hoverId = useSel((s) => s.hoverId);
  const breakpoint = useSel((s) => s.breakpoint);
  const zoom = useSel((s) => s.zoom);
  const fitZoom = useSel((s) => s.fitZoom);
  const editingTextId = useSel((s) => s.editingTextId);
  const snapping = useSel((s) => s.snapping);
  const showGrid = useSel((s) => s.showGrid);
  const dragInsert = useSel((s) => s.dragInsert);

  const areaRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [frameHeight, setFrameHeight] = useState(800);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [sectionRects, setSectionRects] = useState<{ id: string; rect: Rect }[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [enteredGroup, setEnteredGroup] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const width = BREAKPOINT_WIDTHS[breakpoint];

  const html = useMemo(() => renderPage(doc, pageId, { mode: "editor", baseHref: "/", formAction: () => "#" }), [doc, pageId]);

  /* ------------------------------------------------------- fit + sizing */
  const recomputeFit = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const availW = area.clientWidth - 48;
    const availH = area.clientHeight - 48;
    const z = store.getState().fitZoom ? Math.min(1, availW / width) : store.getState().zoom;
    if (store.getState().fitZoom && Math.abs(z - store.getState().zoom) > 0.001) store.setZoom(z, true);
    setFrameHeight(Math.max(400, Math.floor(availH / z)));
  }, [store, width]);
  useLayoutEffect(() => {
    recomputeFit();
    const ro = new ResizeObserver(() => recomputeFit());
    if (areaRef.current) ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, [recomputeFit, fitZoom, zoom]);

  /* --------------------------------------------------- iframe document */
  const iframeDoc = () => iframeRef.current?.contentDocument ?? null;
  const iframeWin = () => iframeRef.current?.contentWindow ?? null;

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    setReady(false);
    frame.srcdoc = html;
    const onLoad = () => {
      setReady(true);
      const w = frame.contentWindow;
      w?.addEventListener("scroll", () => measure(), { passive: true });
      measure();
    };
    frame.addEventListener("load", onLoad, { once: true });
    return () => frame.removeEventListener("load", onLoad);
    // Only on page/breakpoint change: subsequent document changes are patched in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, breakpoint]);

  const lastHtml = useRef(html);
  useEffect(() => {
    if (!ready) return;
    if (lastHtml.current === html) return;
    lastHtml.current = html;
    if (store.getState().editingTextId) return; // don't clobber an in-progress text edit
    const d = iframeDoc();
    if (!d) return;
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const newStyle = parsed.querySelector("style")?.textContent ?? "";
    const style = d.querySelector("style");
    if (style && style.textContent !== newStyle) style.textContent = newStyle;
    d.body.innerHTML = parsed.body.innerHTML;
    requestAnimationFrame(() => measure());
  });

  /* ---------------------------------------------------------- measuring */
  const measure = useCallback(() => {
    const d = iframeDoc();
    if (!d) return;
    const ids = new Set<string>([...store.getState().selection]);
    const h = store.getState().hoverId;
    if (h) ids.add(h);
    const out: Record<string, Rect> = {};
    ids.forEach((id) => {
      const el = d.querySelector<HTMLElement>(`[data-b-id="${id}"]`);
      if (el) out[id] = toRect(el.getBoundingClientRect());
    });
    setRects(out);
    const secs = Array.from(d.querySelectorAll<HTMLElement>('main > [data-b-type="section"]')).map((el) => ({ id: el.dataset.bId!, rect: toRect(el.getBoundingClientRect()) }));
    setSectionRects(secs);
  }, [store]);
  useEffect(() => {
    measure();
  }, [selection, hoverId, measure, zoom, frameHeight]);

  /* ----------------------------------------------------- coordinate utils */
  const toFrame = (clientX: number, clientY: number) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
  };
  const hitElement = (x: number, y: number, exclude?: HTMLElement): HTMLElement | null => {
    const d = iframeDoc();
    if (!d) return null;
    let prev: string | null = null;
    if (exclude) {
      prev = exclude.style.pointerEvents;
      exclude.style.pointerEvents = "none";
    }
    const el = d.elementFromPoint(x, y) as HTMLElement | null;
    if (exclude) exclude.style.pointerEvents = prev ?? "";
    return el?.closest<HTMLElement>("[data-b-id]") ?? null;
  };
  /** Resolve what a click on `el` should select, respecting groups and locked parents. */
  const resolveSelectable = (el: HTMLElement): string | null => {
    const id = el.dataset.bId;
    if (!id) return null;
    const found = findNode(doc, id);
    if (!found) return null;
    const groups = found.ancestors.filter((a) => a.type === "group");
    const outer = groups.find((g) => g.id !== enteredGroup && !isInsideEntered(found.ancestors, g.id));
    return outer ? outer.id : id;
  };
  const isInsideEntered = (ancestors: Node[], groupId: string) => {
    if (!enteredGroup) return false;
    const i = ancestors.findIndex((a) => a.id === enteredGroup);
    const j = ancestors.findIndex((a) => a.id === groupId);
    return i >= 0 && j > i;
  };
  const freeBoxFor = (parentId: string): { box: HTMLElement; rect: Rect } | null => {
    const d = iframeDoc();
    if (!d) return null;
    const el = d.querySelector<HTMLElement>(`[data-b-id="${parentId}"]`);
    if (!el) return null;
    const box = el.dataset.bType === "section" ? (el.querySelector<HTMLElement>(":scope > .b-inner") ?? el) : el;
    return { box, rect: toRect(box.getBoundingClientRect()) };
  };

  /* ---------------------------------------------------------- drop target */
  const computeDrop = useCallback(
    (x: number, y: number, exclude?: HTMLElement, forNode?: Node | null): DropTarget | null => {
      const d = iframeDoc();
      if (!d) return null;
      const hit = hitElement(x, y, exclude);
      const isSection = forNode?.type === "section";
      if (isSection) {
        const secs = Array.from(d.querySelectorAll<HTMLElement>('main > [data-b-type="section"]')).filter((s) => s !== exclude);
        const rs = secs.map((s) => toRect(s.getBoundingClientRect()));
        const index = dropIndex(rs, { x, y }, "column");
        const lineY = index < rs.length ? rs[index]!.y : rs.length ? rs[rs.length - 1]!.y + rs[rs.length - 1]!.height : 0;
        return { parentId: pageId, index, line: { x: 0, y: lineY, width, height: 3 } };
      }
      let container = hit?.closest<HTMLElement>("[data-b-container]") ?? null;
      if (!container) return null;
      // Walk up while the container cannot accept this type.
      while (container) {
        const t = container.dataset.bType as Node["type"];
        const canAccept = forNode ? getDefinition(t).acceptsChildren === "*" || (getDefinition(t).acceptsChildren as string[]).includes(forNode.type) : true;
        if (canAccept && !container.dataset.bLocked) break;
        container = container.parentElement?.closest<HTMLElement>("[data-b-container]") ?? null;
      }
      if (!container) return null;
      const parentId = container.dataset.bId!;
      const parentNode = findNode(doc, parentId)?.node;
      if (!parentNode) return null;
      if (container.dataset.bContainer === "free") {
        const fb = freeBoxFor(parentId)!;
        const scale = fb.rect.width / (parentNode.layout?.designWidth ?? 1200);
        const def = forNode ? getDefinition(forNode.type) : null;
        const w = forNode?.placement?.desktop.width ?? def?.defaultSize.width ?? 200;
        const h = forNode?.placement?.desktop.height ?? def?.defaultSize.height ?? 100;
        const px = round((x - fb.rect.x) / scale - w / 2), py = round((y - fb.rect.y) / scale - h / 2);
        return { parentId, placement: { x: Math.max(0, px), y: Math.max(0, py), width: w, height: h, rotation: 0, z: (parentNode.children?.length ?? 0) }, box: fb.rect };
      }
      const box = container.dataset.bType === "section" ? (container.querySelector<HTMLElement>(":scope > .b-inner") ?? container) : container;
      const children = Array.from(box.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !!c.dataset.bId && c !== exclude);
      const cs = iframeWin()!.getComputedStyle(box);
      const direction: "row" | "column" = cs.display === "grid" ? "row" : cs.flexDirection?.startsWith("row") && cs.display === "flex" ? "row" : "column";
      const rs = children.map((c) => toRect(c.getBoundingClientRect()));
      const index = dropIndex(rs, { x, y }, direction);
      const boxRect = toRect(box.getBoundingClientRect());
      let line: Rect;
      if (!rs.length) line = { x: boxRect.x, y: boxRect.y + 4, width: boxRect.width, height: 3 };
      else if (direction === "column") {
        const yy = index < rs.length ? rs[index]!.y - 2 : rs[rs.length - 1]!.y + rs[rs.length - 1]!.height + 2;
        line = { x: boxRect.x, y: yy, width: boxRect.width, height: 3 };
      } else {
        const xx = index < rs.length ? rs[index]!.x - 2 : rs[rs.length - 1]!.x + rs[rs.length - 1]!.width + 2;
        line = { x: xx, y: boxRect.y, width: 3, height: boxRect.height };
      }
      return { parentId, index, line, box: boxRect };
    },
    [doc, pageId, width],
  );

  /* ------------------------------------------------- panel → canvas drags */
  useEffect(() => {
    dragBridge.hover = (cx, cy) => {
      const over = overlayRef.current?.getBoundingClientRect();
      if (!over || cx < over.left || cx > over.right || cy < over.top || cy > over.bottom) {
        setDrop(null);
        return;
      }
      const p = toFrame(cx, cy);
      const ins = store.getState().dragInsert;
      const fake: Node | null = ins?.kind === "component" ? ({ type: ins.componentType } as Node) : ins?.kind === "asset" ? ({ type: "image" } as Node) : ins?.kind === "reusable" ? ((doc.reusableSections.find((r) => r.id === ins.reusableId)?.node as Node) ?? null) : null;
      setDrop(computeDrop(p.x, p.y, undefined, fake));
    };
    dragBridge.drop = (cx, cy) => {
      const ins = store.getState().dragInsert;
      const over = overlayRef.current?.getBoundingClientRect();
      setDrop(null);
      if (!ins || !over || cx < over.left || cx > over.right || cy < over.top || cy > over.bottom) return false;
      const p = toFrame(cx, cy);
      const fake: Node | null = ins.kind === "component" ? ({ type: ins.componentType } as Node) : ins.kind === "asset" ? ({ type: "image" } as Node) : (doc.reusableSections.find((r) => r.id === ins.reusableId)?.node as Node) ?? null;
      const t = computeDrop(p.x, p.y, undefined, fake);
      if (!t) return false;
      const target = { parentId: t.parentId, index: t.index, placement: t.placement };
      let ops: Operation[];
      if (ins.kind === "component") ops = [{ type: "insertComponent", target, componentType: ins.componentType }];
      else if (ins.kind === "asset") ops = [{ type: "insertComponent", target, componentType: "image", props: { src: ins.asset.url, alt: ins.asset.alt, naturalWidth: ins.asset.width ?? undefined, naturalHeight: ins.asset.height ?? undefined } }];
      else ops = [{ type: "insertReusableSection", reusableId: ins.reusableId, target }];
      return store.dispatch(ops, { select: true }) !== null;
    };
    dragBridge.cancel = () => setDrop(null);
    return () => {
      dragBridge.hover = null;
      dragBridge.drop = null;
      dragBridge.cancel = null;
    };
  }, [computeDrop, doc, store, zoom]);

  /* ------------------------------------------------------ pointer events */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".handle, .ctx-toolbar, .insert-point")) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    const p = toFrame(e.clientX, e.clientY);
    if (editingTextId) commitTextEdit();
    const hit = hitElement(p.x, p.y);
    const targetId = hit ? resolveSelectable(hit) : null;
    const sel = store.getState().selection;
    if (targetId) {
      if (e.shiftKey) store.select([targetId], { toggle: true });
      else if (!sel.includes(targetId)) store.select([targetId]);
    } else if (!e.shiftKey) {
      store.select([]);
      setEnteredGroup(null);
    }
    dragRef.current = { kind: "pending", startX: e.clientX, startY: e.clientY, targetId, shift: e.shiftKey };
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, pending: Extract<Drag, { kind: "pending" }>) => {
    const d = iframeDoc();
    if (!d) return;
    if (!pending.targetId) {
      const p = toFrame(pending.startX, pending.startY);
      dragRef.current = { kind: "marquee", startX: p.x, startY: p.y, rect: { x: p.x, y: p.y, width: 0, height: 0 } };
      return;
    }
    const found = findNode(doc, pending.targetId);
    if (!found || found.node.locked || found.ancestors.some((a) => a.locked)) {
      dragRef.current = null;
      return;
    }
    const el = d.querySelector<HTMLElement>(`[data-b-id="${pending.targetId}"]`);
    if (!el) return;
    if (found.parent?.layout?.mode === "free" && found.node.placement) {
      const parentId = found.parent.id;
      const fb = freeBoxFor(parentId);
      if (!fb) return;
      const layout = { designWidth: found.parent.layout.designWidth, designHeight: found.parent.layout.designHeight };
      const scale = fb.rect.width / layout.designWidth;
      const ids = store.getState().selection.filter((id) => {
        const f = findNode(doc, id);
        return f && f.parent?.id === parentId && f.node.placement && !f.node.locked;
      });
      const items = ids
        .map((id) => {
          const n = findNode(doc, id)!.node;
          const elx = d.querySelector<HTMLElement>(`[data-b-id="${id}"]`)!;
          return { id, start: placementFor(n, breakpoint)!, el: elx };
        })
        .filter((i) => i.el);
      const siblings = (found.parent.children ?? []).filter((c) => !ids.includes(c.id) && c.placement && !c.hidden).map((c) => {
        const pl = placementFor(c, breakpoint)!;
        return { x: pl.x, y: pl.y, width: pl.width, height: pl.height };
      });
      dragRef.current = { kind: "move", startX: pending.startX, startY: pending.startY, items, parentId, parentBox: fb.rect, layout, scale, siblings, guides: [] };
      return;
    }
    dragRef.current = { kind: "reorder", startX: pending.startX, startY: pending.startY, id: pending.targetId, el };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      const p = toFrame(e.clientX, e.clientY);
      const hit = hitElement(p.x, p.y);
      store.hover(hit ? resolveSelectable(hit) : null);
      return;
    }
    if (drag.kind === "pending") {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startDrag(e, drag);
      return;
    }
    if (drag.kind === "move") {
      const dx = (e.clientX - drag.startX) / zoom / drag.scale;
      const dy = (e.clientY - drag.startY) / zoom / drag.scale;
      const first = drag.items[0]!;
      let nx = first.start.x + dx, ny = first.start.y + dy;
      if (showGrid) {
        nx = round(nx, GRID);
        ny = round(ny, GRID);
      }
      const snapped = snapMove({ x: nx, y: ny, width: first.start.width, height: first.start.height }, { width: drag.layout.designWidth, height: drag.layout.designHeight }, drag.siblings, 6 / drag.scale, snapping && !e.altKey);
      const offX = snapped.x - first.start.x, offY = snapped.y - first.start.y;
      drag.items.forEach((it) => {
        it.el.style.left = `${((it.start.x + offX) / drag.layout.designWidth) * 100}%`;
        it.el.style.top = `${((it.start.y + offY) / drag.layout.designHeight) * 100}%`;
      });
      drag.guides = snapped.guides;
      setGuides(snapped.guides.map((g) => ({ ...g, at: g.axis === "x" ? drag.parentBox.x + g.at * drag.scale : drag.parentBox.y + g.at * drag.scale, from: (g.axis === "x" ? drag.parentBox.y : drag.parentBox.x) + g.from * drag.scale, to: (g.axis === "x" ? drag.parentBox.y : drag.parentBox.x) + g.to * drag.scale })));
      measure();
      return;
    }
    if (drag.kind === "reorder") {
      const p = toFrame(e.clientX, e.clientY);
      const node = findNode(doc, drag.id)?.node ?? null;
      setDrop(computeDrop(p.x, p.y, drag.el, node));
      return;
    }
    if (drag.kind === "resize") {
      const dx = (e.clientX - drag.startX) / zoom / drag.scale;
      const dy = (e.clientY - drag.startY) / zoom / drag.scale;
      const next = resizePlacement(drag.start, drag.handle, dx, dy, { keepAspect: e.shiftKey || isImage(drag.id) });
      drag.el.style.left = `${(next.x / drag.layout.designWidth) * 100}%`;
      drag.el.style.top = `${(next.y / drag.layout.designHeight) * 100}%`;
      drag.el.style.width = `${(next.width / drag.layout.designWidth) * 100}%`;
      drag.el.style.height = `${(next.height / drag.layout.designHeight) * 100}%`;
      measure();
      return;
    }
    if (drag.kind === "resizeFlow") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      if (drag.handle.includes("e")) drag.el.style.width = `${Math.max(16, drag.startW + dx)}px`;
      if (drag.handle.includes("s")) drag.el.style.height = `${Math.max(16, drag.startH + dy)}px`;
      measure();
      return;
    }
    if (drag.kind === "rotate") {
      const p = toFrame(e.clientX, e.clientY);
      const a = normalizeAngle(drag.start.rotation + (angleFrom(drag.cx, drag.cy, p.x, p.y) - drag.startAngle), e.shiftKey);
      drag.el.style.transform = `rotate(${a}deg)`;
      drag.el.style.transformOrigin = "center";
      measure();
      return;
    }
    if (drag.kind === "marquee") {
      const p = toFrame(e.clientX, e.clientY);
      const rect = { x: Math.min(p.x, drag.startX), y: Math.min(p.y, drag.startY), width: Math.abs(p.x - drag.startX), height: Math.abs(p.y - drag.startY) };
      drag.rect = rect;
      setMarquee(rect);
    }
  };

  const isImage = (id: string) => findNode(doc, id)?.node.type === "image";

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGuides([]);
    if (!drag) return;
    const bp = breakpoint;
    if (drag.kind === "move") {
      const ops: Operation[] = drag.items.map((it) => {
        const left = parseFloat(it.el.style.left) / 100 * drag.layout.designWidth;
        const top = parseFloat(it.el.style.top) / 100 * drag.layout.designHeight;
        return { type: "updatePlacement", nodeId: it.id, breakpoint: bp, placement: { x: round(left), y: round(top) } };
      });
      store.dispatch(ops);
      return;
    }
    if (drag.kind === "reorder") {
      const t = drop;
      setDrop(null);
      if (!t) return;
      const found = findNode(doc, drag.id);
      if (!found) return;
      const samePlace = t.parentId === (found.parent?.id ?? pageId) && (t.index === found.index || t.index === found.index + 1) && !t.placement;
      if (samePlace) return;
      let index = t.index;
      if (index !== undefined && t.parentId === (found.parent?.id ?? pageId) && index > found.index) index -= 1;
      store.dispatch([{ type: "moveNode", nodeId: drag.id, target: { parentId: t.parentId, index, placement: t.placement } }]);
      return;
    }
    if (drag.kind === "resize") {
      const W = drag.layout.designWidth, H = drag.layout.designHeight;
      const placement = {
        x: round(parseFloat(drag.el.style.left) / 100 * W),
        y: round(parseFloat(drag.el.style.top) / 100 * H),
        width: round(parseFloat(drag.el.style.width) / 100 * W),
        height: round(parseFloat(drag.el.style.height) / 100 * H),
      };
      store.dispatch([{ type: "updatePlacement", nodeId: drag.id, breakpoint: bp, placement }]);
      return;
    }
    if (drag.kind === "resizeFlow") {
      const style: Record<string, number> = {};
      if (drag.handle.includes("e")) style.width = round(parseFloat(drag.el.style.width));
      if (drag.handle.includes("s")) style.height = round(parseFloat(drag.el.style.height));
      store.dispatch([{ type: "updateStyle", nodeId: drag.id, breakpoint: bp, style }]);
      return;
    }
    if (drag.kind === "rotate") {
      const m = /rotate\((-?[\d.]+)deg\)/.exec(drag.el.style.transform);
      store.dispatch([{ type: "updatePlacement", nodeId: drag.id, breakpoint: bp, placement: { rotation: m ? parseFloat(m[1]!) : 0 } }]);
      return;
    }
    if (drag.kind === "marquee") {
      setMarquee(null);
      const d = iframeDoc();
      if (!d || drag.rect.width < 4 || drag.rect.height < 4) return;
      const picked: string[] = [];
      d.querySelectorAll<HTMLElement>("[data-b-id]").forEach((el) => {
        const t = el.dataset.bType;
        if (t === "section" || !el.dataset.bId) return;
        if (el.closest("[data-b-hidden]")) return;
        const r = toRect(el.getBoundingClientRect());
        if (rectsIntersect(r, drag.rect)) picked.push(el.dataset.bId);
      });
      // Keep only the outermost picked elements (no parent/child pairs).
      const outer = picked.filter((id) => !findNode(doc, id)?.ancestors.some((a) => picked.includes(a.id)));
      store.select(e.shiftKey ? Array.from(new Set([...store.getState().selection, ...outer])) : outer);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = toFrame(e.clientX, e.clientY);
    const hit = hitElement(p.x, p.y);
    if (!hit) return;
    const found = findNode(doc, hit.dataset.bId!);
    if (!found) return;
    const selectedGroup = store.selectedNodes().find((f) => f.node.type === "group");
    if (selectedGroup && found.ancestors.some((a) => a.id === selectedGroup.node.id)) {
      setEnteredGroup(selectedGroup.node.id);
      store.select([found.node.id]);
      return;
    }
    if (hit.dataset.bText && hit.dataset.bText !== "rich" && !found.node.locked) startTextEdit(hit, found.node);
  };

  /* ------------------------------------------------------- text editing */
  const editingRef = useRef<{ el: HTMLElement; node: Node } | null>(null);
  const startTextEdit = (el: HTMLElement, node: Node) => {
    const target = node.type === "button" ? (el.querySelector<HTMLElement>(".b-btn-label") ?? el) : el;
    target.contentEditable = "true";
    target.focus();
    const sel = iframeWin()?.getSelection();
    const range = iframeDoc()?.createRange();
    if (sel && range) {
      range.selectNodeContents(target);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    editingRef.current = { el: target, node };
    store.setEditingText(node.id);
    const onKey = (ke: KeyboardEvent) => {
      if (ke.key === "Escape") {
        ke.preventDefault();
        cancelTextEdit();
      } else if (ke.key === "Enter" && (node.type !== "paragraph" || ke.metaKey || ke.ctrlKey)) {
        ke.preventDefault();
        commitTextEdit();
      }
      ke.stopPropagation();
    };
    const onBlur = () => commitTextEdit();
    target.addEventListener("keydown", onKey);
    target.addEventListener("blur", onBlur, { once: true });
    (target as HTMLElement & { __binhiCleanup?: () => void }).__binhiCleanup = () => {
      target.removeEventListener("keydown", onKey);
      target.removeEventListener("blur", onBlur);
    };
  };
  const finishTextEdit = () => {
    const cur = editingRef.current;
    if (!cur) return null;
    editingRef.current = null;
    (cur.el as HTMLElement & { __binhiCleanup?: () => void }).__binhiCleanup?.();
    cur.el.contentEditable = "false";
    store.setEditingText(null);
    return cur;
  };
  const commitTextEdit = () => {
    const cur = finishTextEdit();
    if (!cur) return;
    const text = cur.el.innerText.replace(/ /g, " ").replace(/\n+$/, "");
    const key = cur.node.type === "button" ? "label" : "text";
    if (text !== String(cur.node.props[key] ?? "")) store.dispatch([{ type: "updateProps", nodeId: cur.node.id, props: { [key]: text } }]);
    else lastHtml.current = ""; // force a repaint to drop any stray markup from the edit
  };
  const cancelTextEdit = () => {
    finishTextEdit();
    lastHtml.current = "";
  };

  /* ------------------------------------------------------------- wheel */
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      store.setZoom(zoom * (e.deltaY > 0 ? 0.9 : 1.1));
      return;
    }
    iframeWin()?.scrollBy(e.deltaX, e.deltaY);
  };
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) ev.preventDefault();
    };
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  /* ----------------------------------------------------------- handles */
  const startResize = (e: ReactPointerEvent, id: string, handle: HandleName) => {
    e.stopPropagation();
    e.preventDefault();
    const d = iframeDoc();
    const found = findNode(doc, id);
    const el = d?.querySelector<HTMLElement>(`[data-b-id="${id}"]`);
    if (!d || !found || !el || found.node.locked) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    if (found.parent?.layout?.mode === "free" && found.node.placement) {
      const fb = freeBoxFor(found.parent.id)!;
      const layout = { designWidth: found.parent.layout.designWidth, designHeight: found.parent.layout.designHeight };
      dragRef.current = { kind: "resize", id, el, start: placementFor(found.node, breakpoint)!, handle, startX: e.clientX, startY: e.clientY, scale: fb.rect.width / layout.designWidth, layout };
    } else {
      const r = el.getBoundingClientRect();
      dragRef.current = { kind: "resizeFlow", id, el, handle, startX: e.clientX, startY: e.clientY, startW: r.width, startH: r.height };
    }
  };
  const startRotate = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const found = findNode(doc, id);
    const el = iframeDoc()?.querySelector<HTMLElement>(`[data-b-id="${id}"]`);
    const r = rects[id];
    if (!found || !el || !r || !found.node.placement) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const p = toFrame(e.clientX, e.clientY);
    dragRef.current = { kind: "rotate", id, el, start: placementFor(found.node, breakpoint)!, cx, cy, startAngle: angleFrom(cx, cy, p.x, p.y) };
  };

  const insertSectionAt = (index: number) => {
    store.dispatch([{ type: "insertComponent", target: { parentId: pageId, index }, componentType: "section" }], { select: true });
  };

  /* ------------------------------------------------------------- render */
  const selectedFound = selection.map((id) => findNode(doc, id)).filter((f): f is NonNullable<typeof f> => !!f);
  const single = selectedFound.length === 1 ? selectedFound[0]! : null;
  const singleRect = single ? rects[single.node.id] : undefined;
  const singleFree = !!single && single.parent?.layout?.mode === "free" && !!single.node.placement;
  const singleResizable = !!single && !single.node.locked && (singleFree || ["image", "button", "container", "card", "stack", "shape", "video", "map", "gallery", "columns", "form", "divider", "icon"].includes(single.node.type));
  const page = doc.pages.find((p) => p.id === pageId);

  return (
    <div className="canvas-area" ref={areaRef} data-testid="canvas-area">
      <div className="canvas-scroll">
        <div className="canvas-frame" style={{ width: width * zoom, height: frameHeight * zoom }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width, height: frameHeight, position: "relative" }}>
            <iframe ref={iframeRef} title={`Canvas preview of ${page?.name ?? "page"}`} width={width} height={frameHeight} sandbox="allow-same-origin allow-scripts" />
            <div
              ref={overlayRef}
              className={`canvas-overlay ${editingTextId ? "text-editing" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
              onWheel={onWheel}
              onPointerLeave={() => store.hover(null)}
              role="application"
              aria-label="Page canvas. Click elements to select them; double-click text to edit."
            >
              {hoverId && !selection.includes(hoverId) && rects[hoverId] && (
                <div className="sel-box hover" style={rectStyle(rects[hoverId]!)}><span className="sel-label">{nodeLabel(findNode(doc, hoverId)?.node ?? ({ type: "container", props: {} } as Node))}</span></div>
              )}
              {selectedFound.map((f) => {
                const r = rects[f.node.id];
                if (!r) return null;
                return (
                  <div key={f.node.id} className={`sel-box ${f.node.locked ? "locked" : ""} ${selectedFound.length > 1 ? "multi" : ""}`} style={rectStyle(r)}>
                    {selectedFound.length === 1 && <span className="sel-label">{nodeLabel(f.node)}{f.node.locked ? " · locked" : ""}</span>}
                  </div>
                );
              })}
              {single && singleRect && singleResizable && !editingTextId && (
                <>
                  {(singleFree ? (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleName[]) : (["e", "se", "s"] as HandleName[])).map((h) => (
                    <div key={h} className="handle" style={handleStyle(singleRect, h)} onPointerDown={(e) => startResize(e, single.node.id, h)} role="presentation" />
                  ))}
                  {singleFree && <div className="handle rot" style={{ left: singleRect.x + singleRect.width / 2 - 5, top: singleRect.y - 28 }} onPointerDown={(e) => startRotate(e, single.node.id)} title="Rotate (hold Shift for 15° steps)" role="presentation" />}
                </>
              )}
              {single && singleRect && !editingTextId && (
                <div className="ctx-toolbar" style={{ left: Math.max(0, Math.min(singleRect.x, width - 180)), top: singleRect.y + singleRect.height + 6 }} onPointerDown={(e) => e.stopPropagation()}>
                  {single.node.type === "section" && (
                    <>
                      <button className="icon-btn" title="Move section up" aria-label="Move section up" onClick={() => reorder(store, "backward")}><I.up /></button>
                      <button className="icon-btn" title="Move section down" aria-label="Move section down" onClick={() => reorder(store, "forward")}><I.down /></button>
                    </>
                  )}
                  <button className="icon-btn" title="Duplicate" aria-label="Duplicate" onClick={() => store.duplicateSelection()}><I.copy /></button>
                  <button className="icon-btn" title={single.node.locked ? "Unlock" : "Lock"} aria-label={single.node.locked ? "Unlock" : "Lock"} onClick={() => store.dispatch([{ type: "setLocked", nodeId: single.node.id, locked: !single.node.locked }])}>{single.node.locked ? <I.lock /> : <I.unlock />}</button>
                  <button className="icon-btn" title="Delete" aria-label="Delete" disabled={single.node.locked} onClick={() => store.deleteSelection()}><I.trash /></button>
                </div>
              )}
              {guides.map((g, i) => (
                <div key={i} className={`guide-line ${g.axis}`} style={g.axis === "x" ? { left: g.at, top: g.from, height: g.to - g.from } : { top: g.at, left: g.from, width: g.to - g.from }} />
              ))}
              {drop?.box && <div className="drop-box" style={rectStyle(drop.box)} />}
              {drop?.line && <div className="drop-line" style={rectStyle(drop.line)} />}
              {drop?.placement && drop.box && (
                <div className="drop-box" style={{ left: drop.box.x + (drop.placement.x / (findNode(doc, drop.parentId)?.node.layout?.designWidth ?? 1200)) * drop.box.width, top: drop.box.y + (drop.placement.y / (findNode(doc, drop.parentId)?.node.layout?.designHeight ?? 600)) * drop.box.height, width: (drop.placement.width / (findNode(doc, drop.parentId)?.node.layout?.designWidth ?? 1200)) * drop.box.width, height: (drop.placement.height / (findNode(doc, drop.parentId)?.node.layout?.designHeight ?? 600)) * drop.box.height }} />
              )}
              {marquee && <div className="marquee" style={rectStyle(marquee)} />}
              {!dragInsert && !dragRef.current && sectionRects.map((s, i) => (
                <div key={s.id} className="insert-point" style={{ top: s.rect.y + s.rect.height }}>
                  <button onClick={() => insertSectionAt(i + 1)} aria-label={`Add a section after ${nodeLabel(findNode(doc, s.id)?.node ?? ({ type: "section", props: {} } as Node))}`}><I.plus /> Add section</button>
                </div>
              ))}
              {sectionRects[0] && !dragInsert && (
                <div className="insert-point" style={{ top: sectionRects[0].rect.y }}>
                  <button onClick={() => insertSectionAt(0)} aria-label="Add a section at the top"><I.plus /> Add section</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {dragInsert && <DragGhost />}
    </div>
  );
}

function rectStyle(r: Rect) {
  return { left: r.x, top: r.y, width: r.width, height: r.height };
}

function handleStyle(r: Rect, h: HandleName) {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const pos: Record<HandleName, { left: number; top: number; cursor: string }> = {
    n: { left: cx, top: r.y, cursor: "ns-resize" },
    s: { left: cx, top: r.y + r.height, cursor: "ns-resize" },
    e: { left: r.x + r.width, top: cy, cursor: "ew-resize" },
    w: { left: r.x, top: cy, cursor: "ew-resize" },
    ne: { left: r.x + r.width, top: r.y, cursor: "nesw-resize" },
    nw: { left: r.x, top: r.y, cursor: "nwse-resize" },
    se: { left: r.x + r.width, top: r.y + r.height, cursor: "nwse-resize" },
    sw: { left: r.x, top: r.y + r.height, cursor: "nesw-resize" },
  };
  const p = pos[h];
  return { left: p.left - 5, top: p.top - 5, cursor: p.cursor };
}

function DragGhost() {
  const dragInsert = useSel((s) => s.dragInsert);
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  useEffect(() => {
    const move = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  if (!dragInsert) return null;
  const label = dragInsert.kind === "component" ? getDefinition(dragInsert.componentType).label : dragInsert.kind === "asset" ? dragInsert.asset.filename : "Saved section";
  return <div className="drag-ghost" style={{ left: pos.x, top: pos.y }}>{label}</div>;
}
