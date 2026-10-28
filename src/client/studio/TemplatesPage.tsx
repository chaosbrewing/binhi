import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type ProjectSummary, type TemplateSummary } from "../api.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { relative } from "../utils/relativeTime.js";
import { StudioShell } from "./StudioShell.js";

/**
 * Templates: the curated website starters that already ship with BINHI, and
 * the design templates the owner created from their own designs. Website
 * templates are read-only code; design templates are editable projects.
 */
export function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [siteTemplates, setSiteTemplates] = useState<TemplateSummary[]>([]);
  const [designTemplates, setDesignTemplates] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);

  const load = async () => {
    try {
      const [s, d] = await Promise.all([api.templates(), api.projects("design-template")]);
      setSiteTemplates(s.templates);
      setDesignTemplates(d.projects);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load templates");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const useTemplate = async (t: ProjectSummary) => {
    setBusy(true);
    try {
      const { project } = await api.duplicateProject(t.id, { kind: "design", name: t.name });
      navigate(`/studio/design/${project.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not start from this template", "error");
      setBusy(false);
    }
  };
  const remove = async (t: ProjectSummary) => {
    setConfirm(null);
    try {
      await api.deleteProject(t.id);
      toast(`Template "${t.name}" deleted`, "success");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete the template", "error");
    }
  };

  return (
    <StudioShell>
      <main className="studio-main">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">Templates</span>
            <h1>Start faster, your way</h1>
            <p className="muted">Website starters come with BINHI. Design templates are yours: save any design as a template and reuse it as often as you like.</p>
          </div>
          <Link to="/" className="btn btn-ghost"><span aria-hidden="true">←</span> Today</Link>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <section aria-labelledby="design-templates-heading">
          <div className="studio-section-head"><div><span className="studio-eyebrow">Design Studio</span><h2 id="design-templates-heading">Your design templates</h2></div><Link to="/studio/design" className="btn"><I.plus /> New design</Link></div>
          {designTemplates === null && !error && <p className="muted" role="status">Loading…</p>}
          {designTemplates && designTemplates.length === 0 && (
            <div className="studio-empty"><strong>No design templates yet.</strong><p>Open any design and use “Save as template” to keep its layout, text styles and images for next time.</p></div>
          )}
          {designTemplates && designTemplates.length > 0 && (
            <ul className="site-grid" aria-label="Design templates">
              {designTemplates.map((t) => (
                <li key={t.id} className="site-card">
                  <div className="site-card-body"><span className="badge">Template</span><h2>{t.name}</h2><p className="muted small">{t.meta.width} × {t.meta.height}px · {t.meta.layers} layer{t.meta.layers === 1 ? "" : "s"} · updated {relative(t.updatedAt)}</p></div>
                  <div className="site-card-actions">
                    <button className="btn btn-primary" disabled={busy} onClick={() => void useTemplate(t)}>Use template</button>
                    <Link to={`/studio/design/${t.id}`} className="btn">Edit template</Link>
                    <button className="btn btn-ghost btn-danger-text" aria-label={`Delete template ${t.name}`} onClick={() => setConfirm(t)}><I.trash /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="site-templates-heading">
          <div className="studio-section-head"><div><span className="studio-eyebrow">Website Builder</span><h2 id="site-templates-heading">Website starters</h2></div><Link to="/sites/new" className="btn"><I.plus /> New website</Link></div>
          <ul className="site-grid" aria-label="Website templates">
            {siteTemplates.map((t) => (
              <li key={t.id} className="site-card">
                <div className="site-card-body">
                  <span className="template-swatch" aria-hidden="true" style={{ background: t.swatch[0] }}><span style={{ background: t.swatch[1] }} /><span style={{ background: t.swatch[2] }} /></span>
                  <span className="badge">{t.category}</span>
                  <h2>{t.name}</h2>
                  <p className="muted small">{t.description}</p>
                </div>
                <div className="site-card-actions"><Link to="/sites/new" className="btn btn-primary">Start a website</Link></div>
              </li>
            ))}
          </ul>
          <p className="small muted">Website starters are built into BINHI and cannot be edited as templates yet; every website created from one is fully editable.</p>
        </section>
      </main>
      {confirm && <ConfirmDialog title={`Delete template "${confirm.name}"?`} message="Designs already created from it are not affected. This cannot be undone." confirmLabel="Delete template" danger onConfirm={() => void remove(confirm)} onCancel={() => setConfirm(null)} />}
    </StudioShell>
  );
}
