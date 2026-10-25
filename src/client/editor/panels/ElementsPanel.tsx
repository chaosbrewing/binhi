import { useMemo, useState } from "react";
import { insertableComponents, type ComponentDefinition } from "../../../core/index.js";
import { useStore } from "../context.js";
import { insertComponent } from "../actions.js";
import { usePanelDrag } from "./usePanelDrag.js";
import { I } from "../../components/Icons.js";
import { useAuth } from "../../auth/AuthContext.js";

const ICON_FOR: Record<string, keyof typeof I> = {
  heading: "text", paragraph: "text", richText: "text", image: "image", button: "link", icon: "sun", shape: "elements", divider: "minus", spacer: "more", gallery: "image", video: "eye", map: "globe", form: "inbox", socialLinks: "globe", navigation: "menu", card: "sections", hero: "sections", footer: "sections", contact: "inbox", container: "elements", columns: "elements", stack: "layers",
};

export function ElementsPanel() {
  const store = useStore();
  const [q, setQ] = useState("");
  const startDrag = usePanelDrag();
  const { iconLibrary } = useAuth();
  const groups = useMemo(() => {
    const defs = insertableComponents().filter((d) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return d.label.toLowerCase().includes(needle) || d.keywords.some((k) => k.includes(needle)) || d.description.toLowerCase().includes(needle);
    });
    const byCat = new Map<string, ComponentDefinition[]>();
    defs.forEach((d) => byCat.set(d.category, [...(byCat.get(d.category) ?? []), d]));
    return Array.from(byCat.entries());
  }, [q]);
  return (
    <>
      <header className="panel-head"><h2>Elements</h2></header>
      <div className="panel-body">
        <div className="panel-search">
          <I.search />
          <input type="search" placeholder="Search elements" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search elements" />
        </div>
        <p className="help" style={{ marginBottom: 10 }}>Click to add to the selection, or drag onto the page.</p>
        {groups.map(([cat, defs]) => (
          <div key={cat}>
            <div className="element-cat">{cat}</div>
            <div className="element-grid">
              {defs.map((d) => {
                const Icon = I[ICON_FOR[d.type] ?? "elements"];
                return (
                  <button
                    key={d.type}
                    className="element-card"
                    title={d.type === "icon" && iconLibrary ? "Open the icon library (250 icons)" : d.description}
                    onPointerDown={(e) => (d.type !== "icon" || !iconLibrary) && startDrag(e, { kind: "component", componentType: d.type }, () => insertComponent(store, d.type))}
                    onClick={() => d.type === "icon" && iconLibrary && store.setLeftTab("icons")}
                    onKeyDown={(e) => e.key === "Enter" && (d.type !== "icon" || !iconLibrary) && insertComponent(store, d.type)}
                  >
                    <Icon />
                    <span>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="muted">No elements match “{q}”.</p>}
      </div>
    </>
  );
}
