import { useState } from "react";
import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import { usePanelDrag } from "./usePanelDrag.js";
import { makeNode, type Node } from "../../../core/index.js";
import { insertNode } from "../actions.js";

/** Ready-made section layouts, built from the same registry as everything else. */
const PRESETS: { id: string; label: string; build: () => Node }[] = [
  { id: "empty", label: "Empty section", build: () => makeNode("section") },
  { id: "hero", label: "Hero", build: () => makeNode("section", {}, { children: [makeNode("hero")] }) },
  { id: "text", label: "Heading + text", build: () => makeNode("section", {}, { children: [makeNode("heading", { text: "Section title", level: 2 }), makeNode("paragraph", { text: "Say something useful here." })] }) },
  { id: "two", label: "Two columns", build: () => makeNode("section", {}, { children: [makeNode("columns", { count: 2 }, { children: [makeNode("container", {}, { children: [makeNode("heading", { text: "Left", level: 3 }), makeNode("paragraph")] }), makeNode("container", {}, { children: [makeNode("image")] })] })] }) },
  { id: "cards", label: "Three cards", build: () => makeNode("section", {}, { children: [makeNode("columns", { count: 3, stackBelow: "tablet" }, { children: [makeNode("container", {}, { children: [makeNode("card")] }), makeNode("container", {}, { children: [makeNode("card")] }), makeNode("container", {}, { children: [makeNode("card")] })] })] }) },
  { id: "gallery", label: "Gallery", build: () => makeNode("section", {}, { children: [makeNode("heading", { text: "Gallery", level: 2 }), makeNode("gallery")] }) },
  { id: "contact", label: "Contact form", build: () => makeNode("section", {}, { children: [makeNode("columns", { count: 2 }, { children: [makeNode("container", {}, { children: [makeNode("heading", { text: "Get in touch", level: 2 }), makeNode("contact")] }), makeNode("container", {}, { children: [makeNode("form")] })] })] }) },
  { id: "cta", label: "Call to action", build: () => { const s = makeNode("section", {}, { children: [makeNode("heading", { text: "Ready to start?", level: 2 }, { style: { textAlign: "center" } }), makeNode("stack", {}, { children: [makeNode("button")], style: { display: "flex", justifyContent: "center", gap: 12 } })] }); s.style.background = { type: "color", color: "var(--b-surface)" }; return s; } },
  { id: "free", label: "Freeform canvas", build: () => { const s = makeNode("section", {}, { children: [] }); s.layout = { mode: "free", designWidth: 1200, designHeight: 600, stackOnMobile: true, contentWidth: null }; return s; } },
];

export function SectionsPanel() {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const startDrag = usePanelDrag();
  const [renaming, setRenaming] = useState<string | null>(null);
  const sel = store.selectedNodes()[0];
  const canSave = sel && (sel.node.type === "section" || !!sel.node.children);
  return (
    <>
      <header className="panel-head"><h2>Sections</h2></header>
      <div className="panel-body">
        <div className="element-cat">Section layouts</div>
        <div className="element-grid">
          {PRESETS.map((p) => (
            <button key={p.id} className="element-card" onPointerDown={(e) => startDrag(e, { kind: "component", componentType: "section" }, () => insertNode(store, p.build()))} onKeyDown={(e) => e.key === "Enter" && insertNode(store, p.build())} title="Click to add below the selected section, or drag into place">
              <I.sections />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="element-cat">Saved sections</div>
        <p className="help" style={{ marginBottom: 8 }}>Save a section to reuse it across pages. Updating a saved section updates every copy.</p>
        {canSave && (
          <button className="btn btn-sm" style={{ marginBottom: 8 }} onClick={() => { const name = window.prompt("Name this saved section", sel.node.name ?? "Saved section"); if (name) store.dispatch([{ type: "saveReusableSection", nodeId: sel.node.id, name }]); }}>
            <I.plus /> Save “{sel.node.name ?? "selection"}”
          </button>
        )}
        {sel?.node.reusableId && (
          <div className="row gap" style={{ marginBottom: 8, flexWrap: "wrap" }}>
            <button className="btn btn-sm btn-primary" onClick={() => store.dispatch([{ type: "updateReusableSection", reusableId: sel.node.reusableId!, fromNodeId: sel.node.id }])}>Update all copies from this one</button>
            <button className="btn btn-sm" onClick={() => store.dispatch([{ type: "detachReusable", nodeId: sel.node.id }])}>Detach</button>
          </div>
        )}
        {doc.reusableSections.length === 0 && <p className="muted small">No saved sections yet.</p>}
        <ul className="list">
          {doc.reusableSections.map((r) => (
            <li key={r.id}>
              <div className="list-item" onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button, input")) return; startDrag(e, { kind: "reusable", reusableId: r.id }, () => store.dispatch([{ type: "insertReusableSection", reusableId: r.id, target: { parentId: store.getState().pageId } }], { select: true })); }} style={{ cursor: "grab" }}>
                <I.drag />
                {renaming === r.id ? (
                  <input autoFocus defaultValue={r.name} className="grow" onBlur={(e) => { setRenaming(null); const v = e.target.value.trim(); if (v && v !== r.name) { const idx = doc.reusableSections.findIndex((x) => x.id === r.id); const sections = doc.reusableSections.map((x, i) => (i === idx ? { ...x, name: v } : x)); store.dispatch([{ type: "replaceDocument", document: { ...doc, reusableSections: sections }, reason: "restore" }]); } }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label="Saved section name" />
                ) : (
                  <span className="grow" onDoubleClick={() => setRenaming(r.id)}>{r.name}</span>
                )}
                <button className="icon-btn" title="Insert on this page" aria-label={`Insert ${r.name}`} onClick={() => store.dispatch([{ type: "insertReusableSection", reusableId: r.id, target: { parentId: store.getState().pageId } }], { select: true })}><I.plus /></button>
                <button className="icon-btn" title="Delete saved section (copies stay on your pages)" aria-label={`Delete ${r.name}`} onClick={() => store.dispatch([{ type: "deleteReusableSection", reusableId: r.id }])}><I.trash /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
