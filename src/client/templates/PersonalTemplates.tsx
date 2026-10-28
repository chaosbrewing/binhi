import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type ProjectSummary } from "../api.js";
import { ConfirmDialog, Modal } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { libraryImageSource, renderDesign } from "../studio/design/renderDesign.js";
import { relative } from "../utils/relativeTime.js";
import type { DesignDocument } from "../../core/creative/index.js";

/** A thumbnail drawn from the template's own document, only once it scrolls into view. */
function Thumb({ project }: { project: ProjectSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let url: string | null = null;
    let alive = true;
    const draw = () =>
      api.project<DesignDocument>(project.id)
        .then(({ project: p }) => renderDesign(p.document, "image/jpeg", 0.6, libraryImageSource))
        .then((blob) => { if (alive) { url = URL.createObjectURL(blob); setSrc(url); } })
        .catch(() => alive && setFailed(true));
    if (typeof IntersectionObserver === "undefined") void draw();
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io?.disconnect(); void draw(); } });
    io?.observe(el);
    return () => { alive = false; io?.disconnect(); if (url) URL.revokeObjectURL(url); };
  }, [project.id, project.revision]);
  const ratio = project.meta.width && project.meta.height ? `${project.meta.width} / ${project.meta.height}` : "1 / 1";
  return (
    <div ref={ref} className="tpl-thumb tpl-thumb-static" style={{ aspectRatio: ratio }}>
      {src ? <img src={src} alt={`${project.name} preview`} decoding="async" /> : <span className="tpl-thumb-fallback muted small" role={failed ? "status" : undefined}>{failed ? "Preview unavailable" : ""}</span>}
    </div>
  );
}

/**
 * The owner's own saved design templates. They are private projects of kind
 * "design-template": use one to start a new design (the template is never
 * changed), rename it, duplicate it or delete it. Metadata such as a
 * description or category needs a database column and is not available yet.
 */
export function PersonalTemplates({ templates, setTemplates }: { templates: ProjectSummary[] | null; setTemplates: (next: ProjectSummary[]) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);
  const [rename, setRename] = useState<{ t: ProjectSummary; name: string } | null>(null);

  const fail = (e: unknown, fallback: string) => toast(e instanceof ApiError ? e.message : fallback, "error");
  const use = async (t: ProjectSummary) => {
    setBusy(true);
    try {
      const { result } = await api.usePersonalTemplate(t.id, t.name);
      navigate(result.path);
    } catch (e) {
      fail(e, "Could not start from this template");
      setBusy(false);
    }
  };
  const duplicate = async (t: ProjectSummary) => {
    setBusy(true);
    try {
      const { project } = await api.duplicateProject(t.id, { kind: "design-template", name: `${t.name} copy`.slice(0, 80) });
      const list = await api.projects("design-template");
      setTemplates(list.projects);
      toast(`Duplicated as “${project.name}”`, "success");
    } catch (e) {
      fail(e, "Could not duplicate the template");
    }
    setBusy(false);
  };
  const saveRename = async () => {
    if (!rename) return;
    const name = rename.name.trim();
    if (!name) return;
    try {
      const { project } = await api.updateProject(rename.t.id, { name, baseRevision: rename.t.revision });
      setTemplates((templates ?? []).map((x) => (x.id === project.id ? { ...x, name: project.name, revision: project.revision, updatedAt: project.updatedAt } : x)));
      setRename(null);
    } catch (e) {
      fail(e, "Could not rename the template");
    }
  };
  const remove = async (t: ProjectSummary) => {
    setConfirm(null);
    try {
      await api.deleteProject(t.id);
      setTemplates((templates ?? []).filter((x) => x.id !== t.id));
      toast(`Template “${t.name}” deleted`, "success");
    } catch (e) {
      fail(e, "Could not delete the template");
    }
  };

  return (
    <section aria-labelledby="tpl-mine-h" className="tpl-section">
      <h2 id="tpl-mine-h">Your templates</h2>
      {templates === null && <p className="muted" role="status">Loading…</p>}
      {templates && templates.length === 0 && <div className="studio-empty"><strong>No templates of your own yet.</strong><p>Open any design and use “Save as template” to keep its layout for next time. Your templates are private to you.</p></div>}
      {templates && templates.length > 0 && (
        <ul className="tpl-grid" aria-label="Your design templates">
          {templates.map((t) => (
            <li key={t.id} className="tpl-card">
              <Thumb project={t} />
              <div className="tpl-card-body">
                <div className="tpl-card-title"><h3>{t.name}</h3><span className="badge">Private</span></div>
                <p className="tpl-meta">{t.meta.width} × {t.meta.height} px · {t.meta.layers} layer{t.meta.layers === 1 ? "" : "s"} · updated {relative(t.updatedAt)}</p>
                <div className="tpl-mine-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void use(t)}>Use template</button>
                  <Link to={`/studio/design/${t.id}`} className="btn btn-sm" aria-label={`Edit template ${t.name}`}>Edit</Link>
                  <button type="button" className="icon-btn" aria-label={`Rename template ${t.name}`} title="Rename" onClick={() => setRename({ t, name: t.name })}><I.text /></button>
                  <button type="button" className="icon-btn" aria-label={`Duplicate template ${t.name}`} title="Duplicate" disabled={busy} onClick={() => void duplicate(t)}><I.copy /></button>
                  <button type="button" className="icon-btn btn-danger-text" aria-label={`Delete template ${t.name}`} title="Delete" onClick={() => setConfirm(t)}><I.trash /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rename && (
        <Modal title="Rename template" onClose={() => setRename(null)} footer={<><button type="button" className="btn" onClick={() => setRename(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!rename.name.trim()} onClick={() => void saveRename()}>Save name</button></>}>
          <label className="field-block">Template name<input value={rename.name} maxLength={80} onChange={(e) => setRename({ ...rename, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); }} /></label>
        </Modal>
      )}
      {confirm && <ConfirmDialog title={`Delete template "${confirm.name}"?`} message="Designs already created from it are not affected. This cannot be undone." confirmLabel="Delete template" danger onConfirm={() => void remove(confirm)} onCancel={() => setConfirm(null)} />}
    </section>
  );
}
