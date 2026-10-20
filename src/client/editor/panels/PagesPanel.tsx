import { useState } from "react";
import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import { ConfirmDialog } from "../../components/Modal.js";
import { slugify, type Operation } from "../../../core/index.js";

export function PagesPanel() {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const pageId = useSel((s) => s.pageId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const page = doc.pages.find((p) => p.id === pageId);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const ids = store.dispatch([{ type: "addPage", page: { name: n } }]);
    setName("");
    setAdding(false);
    if (ids?.[0]) store.setPage(ids[0]);
  };
  const move = (from: string, to: string) => {
    if (from === to) return;
    const ids = doc.pages.map((p) => p.id);
    const fi = ids.indexOf(from), ti = ids.indexOf(to);
    ids.splice(fi, 1);
    ids.splice(ti, 0, from);
    store.dispatch([{ type: "reorderPages", pageIds: ids }]);
  };

  return (
    <>
      <header className="panel-head">
        <h2>Pages</h2>
        <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Add page" title="Add page"><I.plus /></button>
      </header>
      <div className="panel-body">
        {adding && (
          <form className="row gap" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input autoFocus placeholder="Page name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New page name" maxLength={80} />
            <button className="btn btn-sm btn-primary" type="submit">Add</button>
            <button className="btn btn-sm" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        )}
        <ul className="list" aria-label="Pages">
          {doc.pages.map((p) => (
            <li key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && move(dragId, p.id)} onDragEnd={() => setDragId(null)}>
              <button className={`list-item ${p.id === pageId ? "active" : ""} ${p.hiddenFromNav ? "dim" : ""}`} onClick={() => store.setPage(p.id)} aria-current={p.id === pageId ? "page" : undefined}>
                <I.drag />
                {p.isHome ? <I.home /> : <I.pages />}
                <span className="grow">{p.name}</span>
                <span className="muted small">/{p.isHome ? "" : p.slug}</span>
              </button>
            </li>
          ))}
        </ul>
        {page && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Page settings</h3>
            <PageSettings key={page.id} pageId={page.id} onDelete={() => setConfirmDelete(page.id)} />
          </div>
        )}
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this page?"
          message="The page and everything on it will be removed. Links to it from menus are removed too."
          confirmLabel="Delete page"
          danger
          onConfirm={() => {
            store.dispatch([{ type: "deletePage", pageId: confirmDelete }]);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

export function PageSettings({ pageId, onDelete }: { pageId: string; onDelete?: () => void }) {
  const store = useStore();
  const doc = useSel((s) => s.document);
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return null;
  const patch = (p: Extract<Operation, { type: "updatePage" }>["patch"]) => store.dispatch([{ type: "updatePage", pageId, patch: p }]);
  const seo = (s: Partial<typeof page.seo>) => patch({ seo: s });
  return (
    <div className="prop-group-body" style={{ padding: 0 }}>
      <div className="field"><label htmlFor="pg-name">Name</label><input id="pg-name" defaultValue={page.name} key={page.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== page.name && patch({ name: e.target.value.trim() })} /></div>
      <div className="field"><label htmlFor="pg-slug">URL</label><div className="field-inline"><span className="unit">/</span><input id="pg-slug" defaultValue={page.slug} key={page.slug} disabled={page.isHome} onBlur={(e) => { const s = slugify(e.target.value); if (s && s !== page.slug) patch({ slug: s }); else e.target.value = page.slug; }} /></div></div>
      {page.isHome && <p className="help">The homepage always lives at the site root.</p>}
      <label className="toggle"><input type="checkbox" checked={page.hiddenFromNav} onChange={(e) => patch({ hiddenFromNav: e.target.checked })} /> Hide from menu</label>
      {!page.isHome && <button className="btn btn-sm" onClick={() => store.dispatch([{ type: "setHomePage", pageId }])}>Make this the homepage</button>}
      <button className="btn btn-sm" onClick={() => { const ids = store.dispatch([{ type: "addPage", page: { name: `${page.name} copy` }, fromPageId: pageId }]); if (ids?.[0]) store.setPage(ids[0]); }}>Duplicate page</button>
      <h3 style={{ marginTop: 10 }}>Search &amp; sharing</h3>
      <div className="field stack"><label htmlFor="pg-title">Title</label><input id="pg-title" defaultValue={page.seo.title ?? ""} key={`t${page.seo.title}`} placeholder={page.isHome ? doc.name : `${page.name} — ${doc.name}`} maxLength={200} onBlur={(e) => e.target.value !== (page.seo.title ?? "") && seo({ title: e.target.value || undefined })} /></div>
      <div className="field stack"><label htmlFor="pg-desc">Description</label><textarea id="pg-desc" defaultValue={page.seo.description ?? ""} key={`d${page.seo.description}`} maxLength={320} rows={3} onBlur={(e) => e.target.value !== (page.seo.description ?? "") && seo({ description: e.target.value || undefined })} /></div>
      <div className="field stack"><label htmlFor="pg-social">Social image URL</label><input id="pg-social" defaultValue={page.seo.socialImage ?? ""} key={`s${page.seo.socialImage}`} placeholder="https://… or a media URL" onBlur={(e) => e.target.value !== (page.seo.socialImage ?? "") && seo({ socialImage: e.target.value || undefined })} /></div>
      <div className="field stack"><label htmlFor="pg-canon">Canonical URL</label><input id="pg-canon" defaultValue={page.seo.canonicalUrl ?? ""} key={`c${page.seo.canonicalUrl}`} placeholder="Optional" onBlur={(e) => e.target.value !== (page.seo.canonicalUrl ?? "") && seo({ canonicalUrl: e.target.value || undefined })} /></div>
      <label className="toggle"><input type="checkbox" checked={page.seo.noIndex} onChange={(e) => seo({ noIndex: e.target.checked })} /> Ask search engines not to index this page</label>
      {onDelete && doc.pages.length > 1 && <button className="btn btn-sm btn-danger-text" onClick={onDelete} style={{ alignSelf: "flex-start", marginTop: 8 }}><I.trash /> Delete page</button>}
    </div>
  );
}
