import type { Node, Page, SiteDocument } from "./document.js";

/** Where a node lives: in a page's sections, or the site header/footer. */
export type NodeLocation =
  | { kind: "page"; pageId: string; path: number[] }
  | { kind: "header"; path: number[] }
  | { kind: "footer"; path: number[] };

export interface FoundNode {
  node: Node;
  parent: Node | null;
  /** Index within parent.children (or within page.sections for roots). */
  index: number;
  location: NodeLocation;
  ancestors: Node[];
}

export function cloneDocument<T>(doc: T): T {
  return structuredClone(doc);
}

function searchTree(roots: Node[], id: string, make: (path: number[]) => NodeLocation): FoundNode | null {
  const stack: { node: Node; parent: Node | null; index: number; path: number[]; ancestors: Node[] }[] = [];
  roots.forEach((n, i) => stack.push({ node: n, parent: null, index: i, path: [i], ancestors: [] }));
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.node.id === id) {
      return { node: cur.node, parent: cur.parent, index: cur.index, location: make(cur.path), ancestors: cur.ancestors };
    }
    cur.node.children?.forEach((c, i) =>
      stack.push({ node: c, parent: cur.node, index: i, path: [...cur.path, i], ancestors: [...cur.ancestors, cur.node] }),
    );
  }
  return null;
}

export function findNode(doc: SiteDocument, id: string): FoundNode | null {
  for (const page of doc.pages) {
    const f = searchTree(page.sections, id, (path) => ({ kind: "page", pageId: page.id, path }));
    if (f) return f;
  }
  if (doc.header) {
    const f = searchTree([doc.header], id, (path) => ({ kind: "header", path }));
    if (f) return f;
  }
  if (doc.footer) {
    const f = searchTree([doc.footer], id, (path) => ({ kind: "footer", path }));
    if (f) return f;
  }
  return null;
}

export function findPage(doc: SiteDocument, pageId: string): Page | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

export function homePage(doc: SiteDocument): Page {
  return doc.pages.find((p) => p.isHome) ?? doc.pages[0]!;
}

/** Returns the sibling array that contains the node (page.sections or parent.children). */
export function siblingsOf(doc: SiteDocument, found: FoundNode): Node[] {
  if (found.parent) return found.parent.children!;
  if (found.location.kind === "page") return findPage(doc, found.location.pageId)!.sections;
  // header/footer roots have no siblings; return a synthetic array
  return found.location.kind === "header" ? [doc.header!] : [doc.footer!];
}

export function walk(node: Node, fn: (n: Node, depth: number, parent: Node | null) => void, depth = 0, parent: Node | null = null): void {
  fn(node, depth, parent);
  node.children?.forEach((c) => walk(c, fn, depth + 1, node));
}

export function allNodes(doc: SiteDocument): Node[] {
  const out: Node[] = [];
  doc.pages.forEach((p) => p.sections.forEach((s) => walk(s, (n) => out.push(n))));
  if (doc.header) walk(doc.header, (n) => out.push(n));
  if (doc.footer) walk(doc.footer, (n) => out.push(n));
  return out;
}

export function collectIds(node: Node): string[] {
  const ids: string[] = [];
  walk(node, (n) => ids.push(n.id));
  return ids;
}

export function isDescendant(ancestor: Node, id: string): boolean {
  let hit = false;
  walk(ancestor, (n) => {
    if (n.id === id) hit = true;
  });
  return hit;
}
