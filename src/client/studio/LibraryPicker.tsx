import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError, type LibraryAsset } from "../api.js";
import { Modal } from "../components/Modal.js";
import { I } from "../components/Icons.js";
import { checkLibraryFile, bytesLabel } from "./LibraryPage.js";

export function libraryPickerLiveMessage({ assets, error, busy }: { assets: LibraryAsset[] | null; error: string | null; busy: boolean }): string {
  if (error) return "Could not load your library images.";
  if (busy) return "Uploading image to your library.";
  if (assets === null) return "Loading your library images.";
  if (assets.length === 0) return "No images in your library yet.";
  return `${assets.length} image${assets.length === 1 ? "" : "s"} available in your library.`;
}

/** Choose an image from the private asset library, or add one first. Used by the Design Studio and Brand Kits. */
export function LibraryPicker({ title = "Choose an image", onPick, onClose }: { title?: string; onPick: (asset: LibraryAsset) => void; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.library().then((r) => setAssets(r.assets)).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your library"));
  useEffect(() => {
    void load();
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await checkLibraryFile(file);
      const { asset } = await api.uploadToLibrary(file, { filename: file.name });
      onPick(asset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide footer={<>
      <label className="btn photo-drop-label" htmlFor="picker-file"><I.plus /> Add new image</label>
      <input ref={input} id="picker-file" className="photo-file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => void upload(e)} aria-label="Add a PNG, JPEG or static WebP image to your library" aria-describedby="library-picker-live-status" />
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
    </>}>
      <p id="library-picker-live-status" className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{libraryPickerLiveMessage({ assets, error, busy })}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <p className="muted" role="status">Uploading…</p>}
      {assets === null && !error && <p className="muted" role="status">Loading your library…</p>}
      {assets && assets.length === 0 && <p className="muted">Your asset library is empty. Add an image to use it here.</p>}
      {assets && assets.length > 0 && (
        <ul className="library-grid" aria-label="Library images">
          {assets.map((a) => (
            <li key={a.id}>
              <button type="button" className="library-card" onClick={() => onPick(a)} aria-label={`Use ${a.filename}`}>
                <span className="library-thumb"><img src={a.url} alt={a.alt} loading="lazy" /></span>
                <span className="library-meta"><strong>{a.filename}</strong><span className="small muted">{a.width} × {a.height} · {bytesLabel(a.byteSize)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
