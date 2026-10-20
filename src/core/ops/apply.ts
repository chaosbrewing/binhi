import { ZodError } from "zod";
import {
  SiteDocument,
  type Node,
  type Page,
  type Placement,
  type Breakpoint,
  NodeSchema,
  TextStyle as TextStyleSchema,
} from "../schema/document.js";
import { cloneDocument, findNode, findPage, siblingsOf, collectIds, isDescendant, type FoundNode } from "../schema/traverse.js";
import { canContain, getDefinition, makeNode, validateProps } from "../registry/components.js";
import { newId } from "../ids.js";
import { Operation as OperationSchema, type Operation } from "./operations.js";

export class OperationError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID"
      | "LOCKED"
      | "NOT_ALLOWED"
      | "LAST_PAGE"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "OperationError";
  }
}

export interface ApplyResult {
  document: SiteDocument;
  /** Ids of nodes created by the operation (for selection after insert/paste/duplicate). */
  createdIds: string[];
}

function fail(code: OperationError["code"], message: string): never {
  throw new OperationError(code, message);
}

function mustFind(doc: SiteDocument, id: string): FoundNode {
  const f = findNode(doc, id);
  if (!f) fail("NOT_FOUND", `Element ${id} does not exist`);
  return f;
}

function assertUnlocked(f: FoundNode): void {
  if (f.node.locked) fail("LOCKED", `"${f.node.name ?? getDefinition(f.node.type).label}" is locked`);
  if (f.ancestors.some((a) => a.locked)) fail("LOCKED", "A parent of this element is locked");
}

/** Give a subtree fresh ids (for duplicate/paste/reusable insert). */
export function reidentify(node: Node): Node {
  const copy = structuredClone(node);
  const walk = (n: Node) => {
    n.id = newId(n.type.slice(0, 4));
    n.children?.forEach(walk);
  };
  walk(copy);
  return copy;
}

function placementFor(node: Node, bp: Breakpoint): Placement | undefined {
  if (!node.placement) return undefined;
  if (bp === "desktop") return node.placement.desktop;
  return node.placement[bp] ?? (bp === "mobile" ? node.placement.tablet : undefined) ?? node.placement.desktop;
}

function setPlacement(node: Node, bp: Breakpoint, p: Placement) {
  if (!node.placement) node.placement = { desktop: p };
  if (bp === "desktop") node.placement.desktop = p;
  else node.placement[bp] = p;
}

/** Resolve an insert target to (array, index, parent node or page). */
function resolveTarget(
  doc: SiteDocument,
  target: { parentId: string; index?: number },
  childType: Node["type"],
): { list: Node[]; index: number; parent: Node | null; page: Page | null } {
  const page = findPage(doc, target.parentId);
  if (page) {
    if (!getDefinition(childType).rootOnly) fail("NOT_ALLOWED", "Only sections can be placed directly on a page");
    const index = Math.min(target.index ?? page.sections.length, page.sections.length);
    return { list: page.sections, index, parent: null, page };
  }
  const found = mustFind(doc, target.parentId);
  const parent = found.node;
  if (!parent.children) fail("NOT_ALLOWED", `${getDefinition(parent.type).label} cannot contain other elements`);
  if (!canContain(parent.type, childType)) {
    fail("NOT_ALLOWED", `${getDefinition(childType).label} cannot be placed inside ${getDefinition(parent.type).label}`);
  }
  if (parent.locked || found.ancestors.some((a) => a.locked)) fail("LOCKED", "The destination is locked");
  const index = Math.min(target.index ?? parent.children.length, parent.children.length);
  return { list: parent.children, index, parent, page: null };
}

function ensurePlacementForFreeParent(parent: Node | null, node: Node, requested?: Placement) {
  if (parent && parent.layout?.mode === "free") {
    const d = getDefinition(node.type);
    if (!d.freeformCapable && node.type !== "group") fail("NOT_ALLOWED", `${d.label} cannot be positioned freely`);
    if (requested) setPlacement(node, "desktop", requested);
    else if (!node.placement) {
      setPlacement(node, "desktop", { x: 40, y: 40, width: d.defaultSize.width, height: d.defaultSize.height, rotation: 0, z: 0 });
    }
  } else if (parent && parent.layout?.mode !== "free") {
    // Flow parents ignore placement; drop stale coordinates so the model stays honest.
    delete node.placement;
  }
}

function removeFromDoc(doc: SiteDocument, id: string): { node: Node; found: FoundNode } {
  const found = mustFind(doc, id);
  if (found.location.kind !== "page" || found.parent) {
    if (!found.parent) {
      // header/footer root
      if (found.location.kind === "header") doc.header = null;
      else doc.footer = null;
      return { node: found.node, found };
    }
  }
  const list = siblingsOf(doc, found);
  list.splice(found.index, 1);
  return { node: found.node, found };
}

function bounds(nodes: { p: Placement }[]) {
  const left = Math.min(...nodes.map((n) => n.p.x));
  const top = Math.min(...nodes.map((n) => n.p.y));
  const right = Math.max(...nodes.map((n) => n.p.x + n.p.width));
  const bottom = Math.max(...nodes.map((n) => n.p.y + n.p.height));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function applyOperation(input: SiteDocument, rawOp: Operation): ApplyResult {
  // Parse first so defaults (breakpoint, offsets, placement z/rotation) are
  // always present, whether the op came from the network or the editor.
  const parsed = OperationSchema.safeParse(rawOp);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    fail("INVALID", first ? `${first.path.join(".")}: ${first.message}` : "Invalid operation");
  }
  const op = parsed.data;
  const doc = cloneDocument(input);
  const createdIds: string[] = [];

  switch (op.type) {
    case "insertNode": {
      const node = reidentify(op.node);
      const { list, index, parent } = resolveTarget(doc, op.target, node.type);
      ensurePlacementForFreeParent(parent, node, op.target.placement);
      list.splice(index, 0, node);
      createdIds.push(...collectIds(node));
      break;
    }
    case "insertComponent": {
      const node = makeNode(op.componentType, op.props ?? {});
      if (op.nodeId) node.id = op.nodeId;
      const { list, index, parent } = resolveTarget(doc, op.target, node.type);
      ensurePlacementForFreeParent(parent, node, op.target.placement);
      list.splice(index, 0, node);
      createdIds.push(...collectIds(node));
      break;
    }
    case "updateProps": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      f.node.props = validateProps(f.node.type, { ...f.node.props, ...op.props });
      break;
    }
    case "updateStyle": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (op.breakpoint === "desktop") {
        f.node.style = { ...f.node.style, ...op.style };
        op.unset?.forEach((k) => delete (f.node.style as Record<string, unknown>)[k]);
      } else {
        f.node.responsive ??= {};
        const cur = f.node.responsive[op.breakpoint] ?? {};
        const next = { ...cur, ...op.style } as Record<string, unknown>;
        op.unset?.forEach((k) => delete next[k]);
        f.node.responsive[op.breakpoint] = next;
      }
      break;
    }
    case "updatePlacement": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (!f.parent || f.parent.layout?.mode !== "free") fail("NOT_ALLOWED", "This element is not inside a freeform layout");
      const base = placementFor(f.node, op.breakpoint) ?? { x: 0, y: 0, width: 100, height: 100, rotation: 0, z: 0 };
      setPlacement(f.node, op.breakpoint, { ...base, ...op.placement });
      break;
    }
    case "clearPlacementOverride": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (f.node.placement) delete f.node.placement[op.breakpoint];
      break;
    }
    case "setLayout": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      const d = getDefinition(f.node.type);
      if (!d.container) fail("NOT_ALLOWED", "Only containers have a layout");
      const next = { ...(f.node.layout ?? { mode: "flow", designWidth: 1200, designHeight: 600, stackOnMobile: false, contentWidth: null }), ...op.layout };
      if (!d.layoutModes.includes(next.mode)) fail("NOT_ALLOWED", `${d.label} does not support the ${next.mode} layout`);
      const switchingToFree = f.node.layout?.mode !== "free" && next.mode === "free";
      f.node.layout = next;
      if (switchingToFree) {
        // Give every child a sensible starting placement, stacked vertically.
        let y = 24;
        f.node.children?.forEach((c, i) => {
          const cd = getDefinition(c.type);
          if (!c.placement) setPlacement(c, "desktop", { x: 24, y, width: Math.min(cd.defaultSize.width, next.designWidth - 48), height: cd.defaultSize.height, rotation: 0, z: i });
          y += (c.placement?.desktop.height ?? cd.defaultSize.height) + 16;
        });
        if (y + 24 > next.designHeight) f.node.layout.designHeight = Math.min(20000, y + 24);
      }
      if (next.mode === "flow") f.node.children?.forEach((c) => delete c.placement);
      break;
    }
    case "moveNode": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (op.target.parentId === op.nodeId || isDescendant(f.node, op.target.parentId)) fail("NOT_ALLOWED", "Cannot move an element inside itself");
      const { node } = removeFromDoc(doc, op.nodeId);
      const { list, index, parent } = resolveTarget(doc, op.target, node.type);
      ensurePlacementForFreeParent(parent, node, op.target.placement);
      list.splice(index, 0, node);
      break;
    }
    case "reorderLayer": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      const list = siblingsOf(doc, f);
      if (f.parent?.layout?.mode === "free") {
        // z-order for free children; keep indices stable, change z.
        const sorted = [...list].sort((a, b) => (a.placement?.desktop.z ?? 0) - (b.placement?.desktop.z ?? 0));
        const pos = sorted.findIndex((n) => n.id === f.node.id);
        let to = pos;
        if (op.direction === "forward") to = Math.min(sorted.length - 1, pos + 1);
        if (op.direction === "backward") to = Math.max(0, pos - 1);
        if (op.direction === "front") to = sorted.length - 1;
        if (op.direction === "back") to = 0;
        sorted.splice(pos, 1);
        sorted.splice(to, 0, f.node);
        sorted.forEach((n, i) => {
          if (n.placement) {
            n.placement.desktop.z = i;
            if (n.placement.tablet) n.placement.tablet.z = i;
            if (n.placement.mobile) n.placement.mobile.z = i;
          }
        });
      } else {
        const pos = f.index;
        let to = pos;
        if (op.direction === "forward") to = Math.min(list.length - 1, pos + 1);
        if (op.direction === "backward") to = Math.max(0, pos - 1);
        if (op.direction === "front") to = list.length - 1;
        if (op.direction === "back") to = 0;
        const [n] = list.splice(pos, 1);
        list.splice(to, 0, n!);
      }
      break;
    }
    case "groupNodes": {
      const founds = op.nodeIds.map((id) => mustFind(doc, id));
      founds.forEach(assertUnlocked);
      const parent = founds[0]!.parent;
      if (!parent || parent.layout?.mode !== "free") fail("NOT_ALLOWED", "Group elements inside a freeform layout");
      if (!founds.every((f) => f.parent === parent || f.parent?.id === parent.id)) fail("NOT_ALLOWED", "Elements must share the same parent to be grouped");
      const items = founds.map((f) => ({ node: f.node, p: f.node.placement!.desktop }));
      const box = bounds(items);
      const group = makeNode("group");
      if (op.groupId) group.id = op.groupId;
      group.layout = { mode: "free", designWidth: box.width, designHeight: box.height, stackOnMobile: false, contentWidth: null };
      setPlacement(group, "desktop", { x: box.left, y: box.top, width: box.width, height: box.height, rotation: 0, z: Math.max(...items.map((i) => i.p.z)) });
      group.children = [];
      // Remove in reverse index order, then re-add to the group with relative coordinates.
      const ids = new Set(op.nodeIds);
      const remaining: Node[] = [];
      for (const c of parent.children!) {
        if (ids.has(c.id)) {
          const p = c.placement!.desktop;
          setPlacement(c, "desktop", { ...p, x: p.x - box.left, y: p.y - box.top });
          delete c.placement!.tablet;
          delete c.placement!.mobile;
          group.children.push(c);
        } else remaining.push(c);
      }
      parent.children = [...remaining, group];
      createdIds.push(group.id);
      break;
    }
    case "ungroupNode": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (f.node.type !== "group" || !f.parent) fail("NOT_ALLOWED", "Only groups can be ungrouped");
      const gp = f.node.placement!.desktop;
      const children = f.node.children ?? [];
      children.forEach((c) => {
        const p = c.placement?.desktop ?? { x: 0, y: 0, width: 100, height: 100, rotation: 0, z: 0 };
        setPlacement(c, "desktop", { ...p, x: p.x + gp.x, y: p.y + gp.y, z: gp.z });
      });
      f.parent.children!.splice(f.index, 1, ...children);
      break;
    }
    case "setLocked": {
      const f = mustFind(doc, op.nodeId);
      f.node.locked = op.locked;
      break;
    }
    case "setHidden": {
      const f = mustFind(doc, op.nodeId);
      f.node.hidden = op.hidden;
      break;
    }
    case "setVisibility": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      f.node.visibility = { ...f.node.visibility, ...op.visibility };
      break;
    }
    case "duplicateNode": {
      const f = mustFind(doc, op.nodeId);
      if (f.ancestors.some((a) => a.locked)) fail("LOCKED", "A parent of this element is locked");
      const copy = reidentify(f.node);
      if (op.newId) copy.id = op.newId;
      copy.locked = false;
      if (copy.placement) {
        copy.placement.desktop = { ...copy.placement.desktop, x: copy.placement.desktop.x + 16, y: copy.placement.desktop.y + 16, z: copy.placement.desktop.z + 1 };
      }
      if (!f.parent && f.location.kind !== "page") fail("NOT_ALLOWED", "The header and footer cannot be duplicated");
      const list = siblingsOf(doc, f);
      list.splice(f.index + 1, 0, copy);
      createdIds.push(...collectIds(copy));
      break;
    }
    case "deleteNode": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (!f.parent && f.location.kind === "page") {
        const page = findPage(doc, f.location.pageId)!;
        if (page.sections.length === 1) {
          // Keep at least one section so the page stays editable: replace with an empty one.
          page.sections.splice(f.index, 1, makeNode("section"));
          break;
        }
      }
      removeFromDoc(doc, op.nodeId);
      break;
    }
    case "pasteNodes": {
      const first = op.nodes[0]!;
      const { list, index, parent } = resolveTarget(doc, op.target, first.type);
      op.nodes.forEach((n, i) => {
        if (!canContain(parent?.type ?? "section", n.type) && parent) fail("NOT_ALLOWED", `${getDefinition(n.type).label} cannot be pasted here`);
        const copy = reidentify(n);
        copy.locked = false;
        if (copy.placement && parent?.layout?.mode === "free") {
          copy.placement.desktop = { ...copy.placement.desktop, x: copy.placement.desktop.x + op.offset, y: copy.placement.desktop.y + op.offset };
        }
        ensurePlacementForFreeParent(parent, copy, undefined);
        list.splice(index + i, 0, copy);
        createdIds.push(...collectIds(copy));
      });
      break;
    }
    case "renameNode": {
      mustFind(doc, op.nodeId).node.name = op.name;
      break;
    }
    case "setTextStyle": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      if (op.textStyle) f.node.textStyle = op.textStyle;
      else delete f.node.textStyle;
      break;
    }
    case "updateInteractions": {
      const f = mustFind(doc, op.nodeId);
      assertUnlocked(f);
      f.node.interactions = { entrance: "none", hover: "none", durationMs: 400, delayMs: 0, easing: "ease-out", trigger: "scroll", ...(f.node.interactions ?? {}), ...op.interactions };
      break;
    }
    case "updateA11y": {
      const f = mustFind(doc, op.nodeId);
      f.node.a11y = { ...(f.node.a11y ?? {}), ...op.a11y };
      break;
    }
    case "setAnchor": {
      const f = mustFind(doc, op.nodeId);
      if (op.anchorId) f.node.anchorId = op.anchorId;
      else delete f.node.anchorId;
      break;
    }
    case "alignNodes": {
      const founds = op.nodeIds.map((id) => mustFind(doc, id));
      founds.forEach(assertUnlocked);
      const parent = founds[0]!.parent;
      if (!parent || parent.layout?.mode !== "free") fail("NOT_ALLOWED", "Alignment works inside a freeform layout");
      const items = founds.map((f) => ({ node: f.node, p: placementFor(f.node, op.breakpoint)! }));
      // One element aligns to its parent; several align to their shared bounds.
      const box = items.length === 1 ? { left: 0, top: 0, right: parent.layout.designWidth, bottom: parent.layout.designHeight, width: parent.layout.designWidth, height: parent.layout.designHeight } : bounds(items);
      items.forEach(({ node, p }) => {
        const next = { ...p };
        switch (op.alignment) {
          case "left": next.x = box.left; break;
          case "centerX": next.x = box.left + (box.width - p.width) / 2; break;
          case "right": next.x = box.right - p.width; break;
          case "top": next.y = box.top; break;
          case "centerY": next.y = box.top + (box.height - p.height) / 2; break;
          case "bottom": next.y = box.bottom - p.height; break;
        }
        setPlacement(node, op.breakpoint, next);
      });
      break;
    }
    case "distributeNodes": {
      const founds = op.nodeIds.map((id) => mustFind(doc, id));
      founds.forEach(assertUnlocked);
      const parent = founds[0]!.parent;
      if (!parent || parent.layout?.mode !== "free") fail("NOT_ALLOWED", "Distribution works inside a freeform layout");
      const items = founds.map((f) => ({ node: f.node, p: placementFor(f.node, op.breakpoint)! }));
      const horizontal = op.axis === "horizontal";
      items.sort((a, b) => (horizontal ? a.p.x - b.p.x : a.p.y - b.p.y));
      const total = items.reduce((s, i) => s + (horizontal ? i.p.width : i.p.height), 0);
      const first = items[0]!.p;
      const last = items[items.length - 1]!.p;
      const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
      const gap = (span - total) / (items.length - 1);
      let cursor = horizontal ? first.x : first.y;
      items.forEach(({ node, p }) => {
        const next = horizontal ? { ...p, x: cursor } : { ...p, y: cursor };
        setPlacement(node, op.breakpoint, next);
        cursor += (horizontal ? p.width : p.height) + gap;
      });
      break;
    }
    // --- pages ---
    case "addPage": {
      const base = op.fromPageId ? findPage(doc, op.fromPageId) : undefined;
      if (op.fromPageId && !base) fail("NOT_FOUND", "Page to duplicate does not exist");
      const slugBase = op.page.slug ?? slugify(op.page.name);
      let slug = slugBase || "page";
      let n = 2;
      while (doc.pages.some((p) => p.slug === slug)) slug = `${slugBase}-${n++}`;
      const page: Page = {
        id: op.page.id ?? newId("page"),
        name: op.page.name,
        slug,
        isHome: false,
        hiddenFromNav: op.page.hiddenFromNav ?? false,
        seo: { noIndex: false, ...(op.page.seo ?? {}) },
        sections: op.page.sections ? op.page.sections.map(reidentify) : base ? base.sections.map(reidentify) : [makeNode("section")],
      };
      const index = Math.min(op.index ?? doc.pages.length, doc.pages.length);
      doc.pages.splice(index, 0, page);
      createdIds.push(page.id);
      break;
    }
    case "updatePage": {
      const page = findPage(doc, op.pageId);
      if (!page) fail("NOT_FOUND", "Page does not exist");
      if (op.patch.slug && doc.pages.some((p) => p.id !== page.id && p.slug === op.patch.slug)) fail("INVALID", `Another page already uses the URL "${op.patch.slug}"`);
      if (op.patch.name !== undefined) page.name = op.patch.name;
      if (op.patch.slug !== undefined) page.slug = op.patch.slug;
      if (op.patch.hiddenFromNav !== undefined) page.hiddenFromNav = op.patch.hiddenFromNav;
      if (op.patch.seo) page.seo = { ...page.seo, ...op.patch.seo };
      break;
    }
    case "reorderPages": {
      const byId = new Map(doc.pages.map((p) => [p.id, p]));
      const ordered = op.pageIds.map((id) => byId.get(id)).filter((p): p is Page => !!p);
      const rest = doc.pages.filter((p) => !op.pageIds.includes(p.id));
      doc.pages = [...ordered, ...rest];
      break;
    }
    case "setHomePage": {
      if (!findPage(doc, op.pageId)) fail("NOT_FOUND", "Page does not exist");
      doc.pages.forEach((p) => (p.isHome = p.id === op.pageId));
      break;
    }
    case "deletePage": {
      const page = findPage(doc, op.pageId);
      if (!page) fail("NOT_FOUND", "Page does not exist");
      if (doc.pages.length === 1) fail("LAST_PAGE", "A website needs at least one page");
      doc.pages = doc.pages.filter((p) => p.id !== op.pageId);
      if (page.isHome) doc.pages[0]!.isHome = true;
      doc.navigation.items = pruneNavTargets(doc.navigation.items, op.pageId);
      break;
    }
    // --- site ---
    case "updateTheme": {
      doc.theme = deepMerge(doc.theme, op.patch as Record<string, unknown>) as SiteDocument["theme"];
      break;
    }
    case "updateTextStyle": {
      doc.theme.textStyles[op.key] = TextStyleSchema.parse({ ...doc.theme.textStyles[op.key], ...op.style });
      break;
    }
    case "updateNavigation": {
      doc.navigation = { ...doc.navigation, ...op.navigation };
      break;
    }
    case "updateSettings": {
      doc.settings = { ...doc.settings, ...op.patch };
      break;
    }
    case "renameSite": {
      doc.name = op.name;
      break;
    }
    case "setHeader": {
      doc.header = op.node ? reidentify(op.node) : null;
      if (doc.header) createdIds.push(doc.header.id);
      break;
    }
    case "setFooter": {
      doc.footer = op.node ? reidentify(op.node) : null;
      if (doc.footer) createdIds.push(doc.footer.id);
      break;
    }
    // --- reusable ---
    case "saveReusableSection": {
      const f = mustFind(doc, op.nodeId);
      const reusableId = op.reusableId ?? newId("reuse");
      const snapshot = structuredClone(f.node);
      delete snapshot.reusableId;
      doc.reusableSections.push({ id: reusableId, name: op.name, node: snapshot, updatedAt: new Date().toISOString() });
      f.node.reusableId = reusableId;
      createdIds.push(reusableId);
      break;
    }
    case "insertReusableSection": {
      const r = doc.reusableSections.find((x) => x.id === op.reusableId);
      if (!r) fail("NOT_FOUND", "Saved section does not exist");
      const node = reidentify(r.node);
      node.reusableId = r.id;
      const { list, index, parent } = resolveTarget(doc, op.target, node.type);
      ensurePlacementForFreeParent(parent, node, op.target.placement);
      list.splice(index, 0, node);
      createdIds.push(...collectIds(node));
      break;
    }
    case "updateReusableSection": {
      const r = doc.reusableSections.find((x) => x.id === op.reusableId);
      if (!r) fail("NOT_FOUND", "Saved section does not exist");
      const f = mustFind(doc, op.fromNodeId);
      const snapshot = structuredClone(f.node);
      delete snapshot.reusableId;
      r.node = snapshot;
      r.updatedAt = new Date().toISOString();
      // Propagate to every other instance (keeps ids of the instance root).
      const walkAll = (n: Node) => {
        if (n.reusableId === r.id && n.id !== f.node.id) {
          const fresh = reidentify(snapshot);
          fresh.id = n.id;
          fresh.reusableId = r.id;
          Object.assign(n, fresh);
        }
        n.children?.forEach(walkAll);
      };
      doc.pages.forEach((p) => p.sections.forEach(walkAll));
      break;
    }
    case "deleteReusableSection": {
      doc.reusableSections = doc.reusableSections.filter((r) => r.id !== op.reusableId);
      const detach = (n: Node) => {
        if (n.reusableId === op.reusableId) delete n.reusableId;
        n.children?.forEach(detach);
      };
      doc.pages.forEach((p) => p.sections.forEach(detach));
      break;
    }
    case "detachReusable": {
      const f = mustFind(doc, op.nodeId);
      delete f.node.reusableId;
      break;
    }
    case "replaceDocument": {
      return { document: validateDocument(op.document), createdIds: [] };
    }
  }

  return { document: validateDocument(doc), createdIds };
}

/** Apply a batch atomically: either every op applies or none do. */
export function applyOperations(doc: SiteDocument, ops: Operation[]): ApplyResult {
  let current = doc;
  const created: string[] = [];
  for (const op of ops) {
    const r = applyOperation(current, op);
    current = r.document;
    created.push(...r.createdIds);
  }
  return { document: current, createdIds: created };
}

export function validateDocument(doc: unknown): SiteDocument {
  try {
    return SiteDocument.parse(doc);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      fail("INVALID", first ? `${first.path.join(".")}: ${first.message}` : "Invalid website document");
    }
    throw e;
  }
}

export function validateNode(node: unknown): Node {
  return NodeSchema.parse(node);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function pruneNavTargets<T extends { target: { kind: string; pageId?: string }; children?: T[] }>(items: T[], pageId: string): T[] {
  return items
    .filter((i) => !(i.target.kind === "page" && i.target.pageId === pageId))
    .map((i) => (i.children ? { ...i, children: pruneNavTargets(i.children, pageId) } : i));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge(base: unknown, patch: Record<string, unknown>): unknown {
  if (!isPlainObject(base)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}
