import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, type LibraryAsset, type SiteSummary } from "../api.js";
import { ConfirmDialog, Modal } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { inspectRaster, PHOTO_LIMITS } from "../../core/media/photo.js";
import { StudioShell } from "./StudioShell.js";
import { PROJECT_KIND_LABEL } from "./destinations.js";
import { applyLibraryViewState, parseLibraryViewState, type LibraryViewState } from "./viewState.js";
import { clampVisibleCount, LIST_PAGE_SIZE, nextVisibleCount, visibleSlice } from "./listPagination.js";

export const bytesLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`);

/** Validate on the client first (same rules as the server) so users get the reason before any upload. */
export async function checkLibraryFile(file: File): Promise<void> {
  if (file.size > PHOTO_LIMITS.inputBytes) throw new Error("Choose an image no larger than 8 MiB.");
  inspectRaster(new Uint8Array(await file.arrayBuffer()));
}

export function LibraryPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewState = parseLibraryViewState(searchParams);
  const input = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LibraryAsset | null>(null);
  const [confirm, setConfirm] = useState<LibraryAsset | null>(null);
  const [alt, setAlt] = useState("");
  const [tags, setTags] = useState("");
  const [siteId, setSiteId] = useState("");
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const load = async () => {
    try {
      const [lib, s] = await Promise.all([api.library(), api.sites()]);
      setAssets(lib.assets);
      setSites(s.sites);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your asset library");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    let added = 0;
    for (const file of files.slice(0, 10)) {
      try {
        await checkLibraryFile(file);
        await api.uploadToLibrary(file, { filename: file.name });
        added++;
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setBusy(false);
    if (added) toast(`${added} file${added === 1 ? "" : "s"} added to your library`, "success");
    void load();
  };

  const open = (a: LibraryAsset) => {
    setSelected(a);
    setAlt(a.alt);
    setTags(a.tags);
    setSiteId("");
  };

  const saveMeta = async () => {
    if (!selected) return;
    try {
      const r = await api.updateLibraryAsset(selected.id, { alt, tags });
      setSelected(r.asset);
      toast("Details saved", "success");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save", "error");
    }
  };

  const copyToSite = async () => {
    if (!selected || !siteId) return;
    if (!window.confirm("This copies the image into the website's PUBLIC media library. The copy will be reachable by anyone with its link. Continue?")) return;
    try {
      await api.copyLibraryAssetToSite(selected.id, siteId);
      toast("Copied to the website's media library", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not copy", "error");
    }
  };

  const remove = async (a: LibraryAsset, force: boolean) => {
    setConfirm(null);
    try {
      await api.deleteLibraryAsset(a.id, force);
      toast(`"${a.filename}" deleted`, "success");
      setSelected(null);
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete", "error");
    }
  };

  const total = assets?.reduce((sum, a) => sum + a.byteSize, 0) ?? 0;
  const updateViewState = (patch: Partial<LibraryViewState>, replace = false) => {
    const next = applyLibraryViewState(searchParams, { ...viewState, ...patch });
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace });
  };
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  const searchNeedle = viewState.search.toLowerCase();
  const filteredAssets = (assets ?? [])
    .filter((a) => {
      switch (viewState.filter) {
        case "used":
          return a.usedBy.length > 0;
        case "unused":
          return a.usedBy.length === 0;
        case "photo-original":
          return a.origin === "photo-original";
        case "upload":
          return a.origin !== "photo-original";
        default:
          return true;
      }
    })
    .filter((a) => {
      if (!searchNeedle) return true;
      return `${a.filename} ${a.alt} ${a.tags}`.toLowerCase().includes(searchNeedle);
    })
    .sort((a, b) => {
      switch (viewState.sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "name-asc":
          return byName(a.filename, b.filename);
        case "name-desc":
          return byName(b.filename, a.filename);
        case "largest":
          return b.byteSize - a.byteSize;
        case "smallest":
          return a.byteSize - b.byteSize;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  const visibleAssets = visibleSlice(filteredAssets, visibleCount);
  const canLoadMore = visibleAssets.length < filteredAssets.length;

  useEffect(() => {
    setVisibleCount((current) => clampVisibleCount(current, filteredAssets.length));
  }, [filteredAssets.length]);

  return (
    <StudioShell>
      <main className="studio-main">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">Asset Library</span>
            <h1>Your private images</h1>
            <p className="muted">Shared by the Photo Editor, Design Studio and Brand Kits. Only you can see these files; a website only receives a copy when you choose to send one.</p>
          </div>
          <div className="photo-actions">
            <label className="btn btn-primary photo-drop-label" htmlFor="library-file"><I.plus /> Add images</label>
            <input ref={input} id="library-file" className="photo-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => void upload(e)} aria-label="Add PNG, JPEG or static WebP images to your library" />
          </div>
        </div>
        <div className="studio-controls" aria-label="Library view controls">
          <label className="field-block grow" htmlFor="library-search">
            Search
            <input
              id="library-search"
              type="search"
              value={viewState.search}
              placeholder="Filename, alt text or tag"
              onChange={(e) => updateViewState({ search: e.target.value }, true)}
            />
          </label>
          <label className="field-block" htmlFor="library-filter">
            Filter
            <select id="library-filter" value={viewState.filter} onChange={(e) => updateViewState({ filter: e.target.value as LibraryViewState["filter"] })}>
              <option value="all">All files</option>
              <option value="used">Used in projects</option>
              <option value="unused">Unused</option>
              <option value="photo-original">Photo originals</option>
              <option value="upload">Uploads only</option>
            </select>
          </label>
          <label className="field-block" htmlFor="library-sort">
            Sort
            <select id="library-sort" value={viewState.sort} onChange={(e) => updateViewState({ sort: e.target.value as LibraryViewState["sort"] })}>
              <option value="recent">Recently added</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Filename A–Z</option>
              <option value="name-desc">Filename Z–A</option>
              <option value="largest">Largest first</option>
              <option value="smallest">Smallest first</option>
            </select>
          </label>
        </div>
        <p className="small muted">
          {assets ? `${assets.length} file${assets.length === 1 ? "" : "s"} · ${bytesLabel(total)} of 300 MiB` : ""}
          {assets && filteredAssets.length !== assets.length ? ` · ${filteredAssets.length} matching` : ""}
          {" · PNG, JPEG and static WebP up to 8 MiB and 16 megapixels each."}
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {busy && <p className="muted" role="status">Uploading…</p>}
        {assets === null && !error && <p className="muted" role="status">Loading your library…</p>}
        {assets && filteredAssets.length === 0 && (
          <div className="empty-state">
            <h2>{assets.length === 0 ? "No images yet" : viewState.search ? `No matches for "${viewState.search}"` : "No files match this view"}</h2>
            <p className="muted">{assets.length === 0 ? "Add photos, logos and graphics here once and reuse them in every tool." : "Try changing the search text, filter or sort options."}</p>
            {assets.length === 0 && <button className="btn btn-primary" onClick={() => input.current?.click()}>Add your first image</button>}
          </div>
        )}
        {assets && visibleAssets.length > 0 && (
          <>
            <ul className="library-grid" aria-label="Library files">
              {visibleAssets.map((a) => (
                <li key={a.id}>
                  <button type="button" className="library-card" onClick={() => open(a)} aria-label={`${a.filename}, ${a.width} by ${a.height}, ${a.usedBy.length} use${a.usedBy.length === 1 ? "" : "s"}`}>
                    <span className="library-thumb"><img src={a.url} alt={a.alt} loading="lazy" /></span>
                    <span className="library-meta">
                      <strong>{a.filename}</strong>
                      <span className="small muted">{a.width} × {a.height} · {bytesLabel(a.byteSize)}</span>
                      <span className="small muted">{a.usedBy.length ? `Used in ${a.usedBy.length} project${a.usedBy.length === 1 ? "" : "s"}` : "Not used yet"}{a.origin === "photo-original" ? " · photo original" : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="list-pagination" aria-live="polite">
              <p className="small muted">Showing {visibleAssets.length} of {filteredAssets.length} matching files</p>
              {canLoadMore && (
                <button className="btn" onClick={() => setVisibleCount((current) => nextVisibleCount(current, filteredAssets.length))}>
                  <I.plus /> Load {Math.min(LIST_PAGE_SIZE, filteredAssets.length - visibleAssets.length)} more
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {selected && (
        <Modal title={selected.filename} onClose={() => setSelected(null)} wide footer={<>
          <button className="btn btn-danger-text btn-ghost" onClick={() => setConfirm(selected)}><I.trash /> Delete</button>
          <button className="btn btn-primary" onClick={() => void saveMeta()}>Save details</button>
        </>}>
          <div className="library-detail">
            <div className="library-detail-preview"><img src={selected.url} alt={selected.alt || selected.filename} /></div>
            <div className="library-detail-fields">
              <dl className="kv">
                <dt>Size</dt><dd>{selected.width} × {selected.height}px · {bytesLabel(selected.byteSize)} · {selected.mimeType}</dd>
                <dt>Added</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                <dt>Used in</dt>
                <dd>{selected.usedBy.length === 0 ? "No projects yet" : <ul className="plain-list">{selected.usedBy.map((u) => <li key={u.id}><Link to={u.kind === "photo" ? `/studio/photo/${u.id}` : `/studio/design/${u.id}`}>{u.name}</Link> <span className="muted small">({PROJECT_KIND_LABEL[u.kind] ?? u.kind})</span></li>)}</ul>}</dd>
              </dl>
              <label className="field-block">Alt text<input value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image for people who cannot see it" /></label>
              <label className="field-block">Tags<input value={tags} maxLength={120} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" /></label>
              {sites.length > 0 && (
                <div className="field-block">
                  <label htmlFor="library-copy-site">Copy to a website's media (becomes public)</label>
                  <div className="row gap">
                    <select id="library-copy-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                      <option value="">Choose a website…</option>
                      {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="btn" disabled={!siteId} onClick={() => void copyToSite()}>Copy</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.filename}"?`}
          message={confirm.usedBy.length ? <>This image is used in <strong>{confirm.usedBy.length}</strong> project{confirm.usedBy.length === 1 ? "" : "s"} ({confirm.usedBy.map((u) => u.name).join(", ")}). Those projects will show a missing image. This cannot be undone.</> : <>The file is removed from your library. This cannot be undone.</>}
          confirmLabel={confirm.usedBy.length ? "Delete anyway" : "Delete file"}
          danger
          onConfirm={() => void remove(confirm, confirm.usedBy.length > 0)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </StudioShell>
  );
}
