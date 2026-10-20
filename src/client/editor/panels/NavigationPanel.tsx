import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import { newId, type NavItem } from "../../../core/index.js";
import { LinkEditor } from "../properties/LinkEditor.js";
import { makeNode } from "../../../core/index.js";

export function NavigationPanel() {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const nav = doc.navigation;
  const setItems = (items: NavItem[]) => store.dispatch([{ type: "updateNavigation", navigation: { items } }]);
  const autoItems: NavItem[] = doc.pages.filter((p) => !p.hiddenFromNav).map((p) => ({ id: newId("nav"), label: p.name, target: { kind: "page", pageId: p.id } }));
  const updateItem = (id: string, patch: Partial<NavItem>) => setItems(mapItems(nav.items, (i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems(filterItems(nav.items, (i) => i.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = nav.items.findIndex((i) => i.id === id);
    if (idx < 0 || idx + dir < 0 || idx + dir >= nav.items.length) return;
    const items = [...nav.items];
    const [it] = items.splice(idx, 1);
    items.splice(idx + dir, 0, it!);
    setItems(items);
  };
  return (
    <>
      <header className="panel-head"><h2>Site menu</h2></header>
      <div className="panel-body">
        <label className="toggle" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={nav.auto} onChange={(e) => store.dispatch([{ type: "updateNavigation", navigation: { auto: e.target.checked, items: e.target.checked ? nav.items : nav.items.length ? nav.items : autoItems } }])} /> Build the menu from my pages automatically
        </label>
        {nav.auto ? (
          <p className="help">Pages appear in order; hide a page from the menu in Page settings. Turn this off to customise labels, add links or nest items.</p>
        ) : (
          <>
            <ul className="list">
              {nav.items.map((item) => (
                <li key={item.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 8, marginBottom: 6 }}>
                  <div className="row gap" style={{ marginBottom: 6 }}>
                    <input value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} aria-label="Menu label" />
                    <button className="icon-btn" onClick={() => move(item.id, -1)} aria-label="Move up"><I.up /></button>
                    <button className="icon-btn" onClick={() => move(item.id, 1)} aria-label="Move down"><I.down /></button>
                    <button className="icon-btn" onClick={() => removeItem(item.id)} aria-label="Remove"><I.trash /></button>
                  </div>
                  <LinkEditor value={item.target} onChange={(target) => updateItem(item.id, { target })} compact />
                  {(item.children ?? []).map((c) => (
                    <div key={c.id} className="row gap" style={{ marginTop: 6, marginLeft: 14 }}>
                      <input value={c.label} onChange={(e) => updateItem(item.id, { children: item.children!.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })} aria-label="Sub-item label" />
                      <div style={{ flex: 2 }}><LinkEditor value={c.target} onChange={(target) => updateItem(item.id, { children: item.children!.map((x) => (x.id === c.id ? { ...x, target } : x)) })} compact /></div>
                      <button className="icon-btn" onClick={() => updateItem(item.id, { children: item.children!.filter((x) => x.id !== c.id) })} aria-label="Remove sub-item"><I.trash /></button>
                    </div>
                  ))}
                  <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => updateItem(item.id, { children: [...(item.children ?? []), { id: newId("nav"), label: "Sub-item", target: { kind: "none" } }] })}><I.plus /> Sub-item</button>
                </li>
              ))}
            </ul>
            <button className="btn btn-sm" onClick={() => setItems([...nav.items, { id: newId("nav"), label: "New item", target: { kind: "none" } }])}><I.plus /> Add menu item</button>
          </>
        )}
        <h3 style={{ marginTop: 18 }}>Header &amp; footer</h3>
        <p className="help">The header and footer appear on every page. Select them on the canvas to edit.</p>
        <div className="row gap" style={{ flexWrap: "wrap" }}>
          {doc.header ? <button className="btn btn-sm" onClick={() => store.select([doc.header!.id])}>Select header</button> : <button className="btn btn-sm" onClick={() => { const s = makeNode("section", {}, { children: [makeNode("navigation", { logoText: doc.name })] }); s.a11y = { role: "banner" }; s.style.padding = { top: 16, bottom: 16, left: 24, right: 24 }; store.dispatch([{ type: "setHeader", node: s }]); }}>Add header</button>}
          {doc.header && <button className="btn btn-sm btn-danger-text" onClick={() => store.dispatch([{ type: "setHeader", node: null }])}>Remove header</button>}
          {doc.footer ? <button className="btn btn-sm" onClick={() => store.select([doc.footer!.id])}>Select footer</button> : <button className="btn btn-sm" onClick={() => store.dispatch([{ type: "setFooter", node: makeNode("footer", { text: `© ${new Date().getFullYear()} ${doc.name}` }) }])}>Add footer</button>}
          {doc.footer && <button className="btn btn-sm btn-danger-text" onClick={() => store.dispatch([{ type: "setFooter", node: null }])}>Remove footer</button>}
        </div>
        <label className="toggle" style={{ marginTop: 10 }}><input type="checkbox" checked={doc.settings.headerSticky} onChange={(e) => store.dispatch([{ type: "updateSettings", patch: { headerSticky: e.target.checked } }])} /> Keep the header visible while scrolling</label>
      </div>
    </>
  );
}

function mapItems(items: NavItem[], fn: (i: NavItem) => NavItem): NavItem[] {
  return items.map((i) => fn(i.children ? { ...i, children: mapItems(i.children, fn) } : i));
}
function filterItems(items: NavItem[], keep: (i: NavItem) => boolean): NavItem[] {
  return items.filter(keep).map((i) => (i.children ? { ...i, children: filterItems(i.children, keep) } : i));
}
