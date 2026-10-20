import { useState } from "react";
import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import { getDefinition, type Node } from "../../../core/index.js";
import { nodeLabel } from "../actions.js";

export function LayersPanel() {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const pageId = useSel((s) => s.pageId);
  const page = doc.pages.find((p) => p.id === pageId);
  return (
    <>
      <header className="panel-head"><h2>Layers</h2></header>
      <div className="panel-body">
        <p className="help" style={{ marginBottom: 8 }}>Top of the list is the back; drag to reorder, double-click to rename.</p>
        {doc.header && (
          <>
            <div className="element-cat">Site header</div>
            <LayerTree nodes={[doc.header]} parentId={null} />
          </>
        )}
        <div className="element-cat">{page?.name}</div>
        <LayerTree nodes={page?.sections ?? []} parentId={pageId} />
        {doc.footer && (
          <>
            <div className="element-cat">Site footer</div>
            <LayerTree nodes={[doc.footer]} parentId={null} />
          </>
        )}
      </div>
    </>
  );
}

function LayerTree({ nodes, parentId, depth = 0 }: { nodes: Node[]; parentId: string | null; depth?: number }) {
  const store = useStore();
  const list = depth === 0 || !nodes[0]?.placement ? nodes : [...nodes].sort((a, b) => (a.placement?.desktop.z ?? 0) - (b.placement?.desktop.z ?? 0));
  return (
    <ul className="list" role={depth === 0 ? "tree" : "group"}>
      {list.map((n, i) => (
        <LayerRow key={n.id} node={n} parentId={parentId} index={nodes.indexOf(n)} depth={depth} siblings={nodes} onDropAt={(fromId, toIndex) => {
          if (!parentId) return;
          const from = store.node(fromId);
          if (!from) return;
          let index = toIndex;
          if (from.parent?.id === parentId || (!from.parent && from.location.kind === "page" && from.location.pageId === parentId)) {
            if (index > from.index) index -= 1;
          }
          store.dispatch([{ type: "moveNode", nodeId: fromId, target: { parentId, index } }]);
        }} position={i} />
      ))}
    </ul>
  );
}

function LayerRow({ node, parentId, index, depth, onDropAt, position }: { node: Node; parentId: string | null; index: number; depth: number; siblings: Node[]; onDropAt: (fromId: string, toIndex: number) => void; position: number }) {
  const store = useStore();
  const selection = useSel((s) => s.selection);
  const [open, setOpen] = useState(depth < 1);
  const [renaming, setRenaming] = useState(false);
  const [over, setOver] = useState(false);
  const selected = selection.includes(node.id);
  const def = getDefinition(node.type);
  const hasKids = !!node.children?.length;
  void position;
  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={hasKids ? open : undefined}>
      <div
        className={`layer-row ${selected ? "selected" : ""} ${over ? "dragover" : ""} ${node.hidden ? "dim" : ""}`}
        draggable={!!parentId}
        onDragStart={(e) => { e.dataTransfer.setData("text/binhi-layer", node.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("text/binhi-layer")) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/binhi-layer"); if (id && id !== node.id) onDropAt(id, index); }}
        style={{ paddingLeft: 4 }}
      >
        <button className="layer-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"} style={{ visibility: hasKids ? "visible" : "hidden" }}>{open ? <I.chevronDown /> : <I.chevron />}</button>
        {renaming ? (
          <input autoFocus defaultValue={node.name ?? ""} placeholder={def.label} className="layer-name" onBlur={(e) => { setRenaming(false); const v = e.target.value.trim(); if (v !== (node.name ?? "")) store.dispatch([{ type: "renameNode", nodeId: node.id, name: v || def.label }]); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }} aria-label="Layer name" />
        ) : (
          <button className="layer-name" onClick={(e) => store.select([node.id], { toggle: e.shiftKey || e.metaKey })} onDoubleClick={() => setRenaming(true)} title={def.label}>{nodeLabel(node)}{node.reusableId ? " ↻" : ""}</button>
        )}
        <button className="layer-toggle" onClick={() => store.dispatch([{ type: "setHidden", nodeId: node.id, hidden: !node.hidden }])} aria-label={node.hidden ? "Show" : "Hide"} title={node.hidden ? "Hidden — not shown on the site" : "Hide"}>{node.hidden ? <I.eyeOff /> : <I.eye />}</button>
        <button className="layer-toggle" onClick={() => store.dispatch([{ type: "setLocked", nodeId: node.id, locked: !node.locked }])} aria-label={node.locked ? "Unlock" : "Lock"} style={{ opacity: node.locked ? 1 : 0.4 }}>{node.locked ? <I.lock /> : <I.unlock />}</button>
      </div>
      {hasKids && open && (
        <div className="layer-children">
          <LayerTree nodes={node.children!} parentId={node.id} depth={depth + 1} />
        </div>
      )}
    </li>
  );
}
