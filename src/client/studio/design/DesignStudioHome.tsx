import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type ProjectSummary } from "../../api.js";
import { createDesignDocument, DESIGN_LIMITS, DESIGN_PRESETS } from "../../../core/creative/index.js";
import { relative } from "../../utils/relativeTime.js";
import { useToast } from "../../components/Toast.js";
import { I } from "../../components/Icons.js";
import { StudioShell } from "../StudioShell.js";

export function DesignStudioHome() {
  const navigate = useNavigate();
  const toast = useToast();
  const [designs, setDesigns] = useState<ProjectSummary[] | null>(null);
  const [templates, setTemplates] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({ width: 1080, height: 1080 });

  useEffect(() => {
    Promise.all([api.projects("design"), api.projects("design-template")])
      .then(([d, t]) => {
        setDesigns(d.projects);
        setTemplates(t.projects);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your designs"));
  }, []);

  const start = async (name: string, width: number, height: number) => {
    setBusy(true);
    setError(null);
    try {
      const { project } = await api.createProject("design", name, createDesignDocument(width, height));
      toast("Design created", "success");
      navigate(`/studio/design/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create the design");
      setBusy(false);
    }
  };
  const startCustom = (e: FormEvent) => {
    e.preventDefault();
    const { width, height } = custom;
    if (width * height > DESIGN_LIMITS.maxPixels) {
      setError(`Designs are limited to ${DESIGN_LIMITS.maxPixels / 1_000_000} megapixels.`);
      return;
    }
    void start(`Custom ${width} × ${height}`, width, height);
  };
  const useTemplate = async (t: ProjectSummary) => {
    setBusy(true);
    try {
      const { project } = await api.duplicateProject(t.id, { kind: "design", name: t.name });
      navigate(`/studio/design/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start from this template");
      setBusy(false);
    }
  };

  const groups = ["Social", "Print", "Web"] as const;
  return (
    <StudioShell>
      <main className="studio-main">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">Design Studio</span>
            <h1>Start a fixed-size design</h1>
            <p className="muted">Pick a size, add text, shapes and images from your asset library, then export a verified PNG or JPEG. Designs save to My Projects as you work.</p>
          </div>
          <Link to="/" className="btn btn-ghost"><span aria-hidden="true">←</span> Today</Link>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {groups.map((group) => (
          <section key={group} aria-labelledby={`preset-${group}`} className="design-presets">
            <h2 id={`preset-${group}`} className="studio-eyebrow">{group}</h2>
            <ul className="preset-grid">
              {DESIGN_PRESETS.filter((p) => p.group === group).map((p) => (
                <li key={p.id}>
                  <button type="button" className="preset-card" disabled={busy} onClick={() => void start(p.name, p.width, p.height)}>
                    <span className="preset-shape" aria-hidden="true"><span style={{ aspectRatio: `${p.width} / ${p.height}` }} /></span>
                    <strong>{p.name}</strong>
                    <span className="small muted">{p.width} × {p.height}px{p.note ? ` · ${p.note}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section aria-labelledby="custom-heading" className="design-presets">
          <h2 id="custom-heading" className="studio-eyebrow">Custom size</h2>
          <form className="row gap" onSubmit={startCustom}>
            <label className="photo-field">Width (px)<input type="number" min={DESIGN_LIMITS.minEdge} max={DESIGN_LIMITS.maxEdge} value={custom.width} onChange={(e) => setCustom({ ...custom, width: Number(e.target.value) })} required /></label>
            <label className="photo-field">Height (px)<input type="number" min={DESIGN_LIMITS.minEdge} max={DESIGN_LIMITS.maxEdge} value={custom.height} onChange={(e) => setCustom({ ...custom, height: Number(e.target.value) })} required /></label>
            <button className="btn btn-primary" type="submit" disabled={busy}><I.plus /> Create</button>
          </form>
          <p className="small muted">{DESIGN_LIMITS.minEdge}–{DESIGN_LIMITS.maxEdge}px per edge, up to {DESIGN_LIMITS.maxPixels / 1_000_000} megapixels.</p>
        </section>
        {templates.length > 0 && (
          <section aria-labelledby="tpl-heading" className="design-presets">
            <div className="studio-section-head"><h2 id="tpl-heading">Your templates</h2><Link to="/templates" className="btn btn-ghost">Manage templates</Link></div>
            <ul className="site-grid">
              {templates.map((t) => (
                <li key={t.id} className="site-card">
                  <div className="site-card-body"><span className="badge">Template</span><h2>{t.name}</h2><p className="muted small">{t.meta.width} × {t.meta.height}px · {t.meta.layers} layers</p></div>
                  <div className="site-card-actions"><button className="btn btn-primary" disabled={busy} onClick={() => void useTemplate(t)}>Use template</button><Link to={`/studio/design/${t.id}`} className="btn">Edit template</Link></div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="designs-heading" className="design-presets">
          <div className="studio-section-head"><h2 id="designs-heading">Your designs</h2><Link to="/projects" className="btn btn-ghost">All projects</Link></div>
          {designs === null && !error && <p className="muted" role="status">Loading…</p>}
          {designs && designs.length === 0 && <p className="muted">No designs yet. Pick a size above to begin.</p>}
          {designs && designs.length > 0 && (
            <ul className="site-grid">
              {designs.map((d) => (
                <li key={d.id} className="site-card">
                  <div className="site-card-body"><span className="badge">Design</span><h2>{d.name}</h2><p className="muted small">{d.meta.width} × {d.meta.height}px · {d.meta.layers} layer{d.meta.layers === 1 ? "" : "s"} · updated {relative(d.updatedAt)}</p></div>
                  <div className="site-card-actions"><Link to={`/studio/design/${d.id}`} className="btn btn-primary">Open</Link></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </StudioShell>
  );
}
