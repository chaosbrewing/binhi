import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, ConfirmDialog } from "../../components/Modal.js";
import { api, ApiError } from "../../api.js";
import { useStore, useSel } from "../context.js";
import { useToast } from "../../components/Toast.js";
import { Field, Toggle } from "../properties/fields.js";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const siteId = useSel((s) => s.siteId);
  const slug = useSel((s) => s.slug);
  const doc = useSel((s) => s.document);
  const liveUrl = useSel((s) => s.liveUrl);
  const publication = useSel((s) => s.publication);
  const [slugDraft, setSlugDraft] = useState(slug);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = publication?.isLive && publication.state === "live";

  const saveSlug = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.updateSite(siteId, { slug: slugDraft.trim().toLowerCase() });
      store.setMeta({ slug: r.site.slug });
      toast("Web address updated", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update");
    }
  };
  const settings = (patch: Partial<typeof doc.settings>) => store.dispatch([{ type: "updateSettings", patch }]);
  const del = async () => {
    try {
      await api.deleteSite(siteId);
      toast("Website deleted", "success");
      nav("/");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete", "error");
    }
  };
  return (
    <Modal title="Website settings" onClose={onClose}>
      <form onSubmit={saveSlug} className="prop-group-body" style={{ padding: 0, marginBottom: 18 }}>
        <h3>Web address</h3>
        <div className="field-inline"><span className="unit">{window.location.origin}/s/</span><input value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} aria-label="Site address" disabled={!!live} pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" /><button className="btn btn-sm" type="submit" disabled={!!live || slugDraft === slug}>Save</button></div>
        {live ? <p className="help">Unpublish before changing the address; the live pages link to it. Current: <a href={liveUrl ?? "#"} target="_blank" rel="noopener noreferrer">{liveUrl}</a></p> : <p className="help">Lowercase letters, numbers and dashes, 3–40 characters.</p>}
        {error && <p className="form-error">{error}</p>}
      </form>
      <div className="prop-group-body" style={{ padding: 0 }}>
        <h3>Site defaults</h3>
        <Field label="Language" htmlFor="st-lang"><input id="st-lang" defaultValue={doc.settings.language} key={doc.settings.language} maxLength={12} onBlur={(e) => /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(e.target.value) && e.target.value !== doc.settings.language && settings({ language: e.target.value })} /></Field>
        <Field label="Default description" htmlFor="st-desc" stack><textarea id="st-desc" rows={3} maxLength={320} defaultValue={doc.settings.defaultSeoDescription ?? ""} key={doc.settings.defaultSeoDescription} onBlur={(e) => e.target.value !== (doc.settings.defaultSeoDescription ?? "") && settings({ defaultSeoDescription: e.target.value || undefined })} /></Field>
        <Field label="Social image URL" htmlFor="st-social" stack><input id="st-social" defaultValue={doc.settings.socialImage ?? ""} key={doc.settings.socialImage} placeholder="Shown when pages are shared" onBlur={(e) => e.target.value !== (doc.settings.socialImage ?? "") && settings({ socialImage: e.target.value || undefined })} /></Field>
        <Field label="Favicon URL" htmlFor="st-fav" stack><input id="st-fav" defaultValue={doc.settings.faviconAssetUrl ?? ""} key={doc.settings.faviconAssetUrl} placeholder="A media URL (PNG works best)" onBlur={(e) => e.target.value !== (doc.settings.faviconAssetUrl ?? "") && settings({ faviconAssetUrl: e.target.value || undefined })} /></Field>
        <Toggle checked={doc.settings.headerSticky} onChange={(b) => settings({ headerSticky: b })} label="Keep header visible while scrolling" />
      </div>
      <div className="danger-zone" style={{ marginTop: 18 }}>
        <h3>Delete website</h3>
        <p className="muted small">Removes pages, media and history, and takes the published site offline.</p>
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Delete this website…</button>
      </div>
      {confirmDelete && <ConfirmDialog title={`Delete "${doc.name}"?`} message="This cannot be undone." confirmLabel="Delete website" danger onConfirm={() => void del()} onCancel={() => setConfirmDelete(false)} />}
    </Modal>
  );
}
