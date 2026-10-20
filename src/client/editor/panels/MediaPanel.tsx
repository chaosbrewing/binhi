import { useRef, useState } from "react";
import { api, ApiError, type AssetRecord } from "../../api.js";
import { useStore, useSel } from "../context.js";
import { useToast } from "../../components/Toast.js";
import { I } from "../../components/Icons.js";
import { usePanelDrag } from "./usePanelDrag.js";
import { insertComponent } from "../actions.js";

export function MediaPanel({ onPick }: { onPick?: (asset: AssetRecord) => void }) {
  const store = useStore();
  const assets = useSel((s) => s.assets);
  const siteId = useSel((s) => s.siteId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AssetRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startDrag = usePanelDrag();

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    let added = 0;
    for (const f of Array.from(files)) {
      try {
        const r = await api.upload(siteId, f, f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
        store.setAssets([r.asset, ...store.getState().assets]);
        added++;
      } catch (e) {
        toast(e instanceof ApiError ? `${f.name}: ${e.message}` : `Could not upload ${f.name}`, "error");
      }
    }
    if (added) toast(`${added} image${added === 1 ? "" : "s"} added to your library`, "success");
    setBusy(false);
  };
  const use = (a: AssetRecord) => {
    if (onPick) return onPick(a);
    const sel = store.selectedNodes()[0];
    if (sel && sel.node.type === "image") store.dispatch([{ type: "updateProps", nodeId: sel.node.id, props: { src: a.url, alt: sel.node.props.alt || a.alt, naturalWidth: a.width ?? undefined, naturalHeight: a.height ?? undefined } }]);
    else insertComponent(store, "image", { src: a.url, alt: a.alt, naturalWidth: a.width ?? undefined, naturalHeight: a.height ?? undefined });
  };
  const remove = async (a: AssetRecord) => {
    try {
      await api.deleteAsset(siteId, a.id);
      store.setAssets(store.getState().assets.filter((x) => x.id !== a.id));
      setSelected(null);
      toast("Image deleted", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete", "error");
    }
  };
  const usedCount = (a: AssetRecord) => (JSON.stringify(store.getState().document).match(new RegExp(a.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const visible = assets.filter((a) => !q || a.filename.toLowerCase().includes(q.toLowerCase()) || a.alt.toLowerCase().includes(q.toLowerCase()) || a.folder.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <header className="panel-head">
        <h2>Media</h2>
        <button className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Upload images" title="Upload images" disabled={busy}><I.plus /></button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
      </header>
      <div className="panel-body">
        <div className={`dropzone ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}>
          {busy ? "Uploading…" : "Drop PNG, JPG, WebP or GIF here (up to 8 MB each)"}
        </div>
        <div className="panel-search"><I.search /><input type="search" placeholder="Search media" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" /></div>
        {assets.length === 0 && <p className="muted">No images yet. Upload a few to use them on your pages.</p>}
        <div className="media-grid">
          {visible.map((a) => (
            <button key={a.id} className={`media-item ${selected?.id === a.id ? "selected" : ""}`} title={`${a.filename} · ${a.width}×${a.height}`} onPointerDown={(e) => startDrag(e, { kind: "asset", asset: a }, () => setSelected(a))} onDoubleClick={() => use(a)} aria-label={a.alt || a.filename}>
              <img src={a.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ marginTop: 12 }}>
            <img src={selected.url} alt={selected.alt} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--panel-border)" }} />
            <p className="small muted" style={{ margin: "6px 0" }}>{selected.filename} · {selected.width}×{selected.height} · {Math.round(selected.byteSize / 1024)} KB · used {usedCount(selected)}×</p>
            <div className="field stack"><label htmlFor="asset-alt">Alt text</label><input id="asset-alt" key={selected.id} defaultValue={selected.alt} onBlur={(e) => { if (e.target.value !== selected.alt) api.updateAsset(siteId, selected.id, { alt: e.target.value }).then((r) => { store.setAssets(store.getState().assets.map((x) => (x.id === r.asset.id ? r.asset : x))); setSelected(r.asset); }).catch(() => toast("Could not save alt text", "error")); }} /></div>
            <div className="field stack"><label htmlFor="asset-folder">Folder</label><input id="asset-folder" key={`f${selected.id}`} defaultValue={selected.folder} placeholder="e.g. Products" onBlur={(e) => { if (e.target.value !== selected.folder) api.updateAsset(siteId, selected.id, { folder: e.target.value }).then((r) => { store.setAssets(store.getState().assets.map((x) => (x.id === r.asset.id ? r.asset : x))); setSelected(r.asset); }).catch(() => undefined); }} /></div>
            <div className="row gap">
              <button className="btn btn-sm btn-primary" onClick={() => use(selected)}>{onPick ? "Choose" : store.selectedNodes()[0]?.node.type === "image" ? "Use on selected image" : "Add to page"}</button>
              <button className="btn btn-sm btn-danger-text" onClick={() => void remove(selected)} disabled={usedCount(selected) > 0} title={usedCount(selected) > 0 ? "Remove it from your pages first" : "Delete image"}><I.trash /></button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
