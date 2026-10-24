import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type TemplateSummary } from "../api.js";
import { Logo } from "../components/Logo.js";
import { useToast } from "../components/Toast.js";

export function NewSite() {
  const nav = useNavigate();
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("portfolio");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.templates().then((r) => setTemplates(r.templates)).catch(() => setError("Could not load templates"));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your website a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.createSite(name.trim(), templateId);
      toast("Website created. Let's make it yours.", "success");
      nav(`/sites/${r.site.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the website");
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="plain-link"><Logo /></Link>
        <Link to="/websites" className="btn btn-ghost">Back to your websites</Link>
      </header>
      <main className="shell-main narrow">
        <h1>Start a new website</h1>
        <p className="muted">Pick a starting point. Every template uses the same building blocks, so nothing is locked in.</p>
        <form onSubmit={submit} className="new-site-form">
          <label className="field-block">
            Website name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana Reyes Photography" maxLength={80} autoFocus />
          </label>
          <fieldset className="template-grid">
            <legend>Template</legend>
            {templates.map((t) => (
              <label key={t.id} className={`template-card ${templateId === t.id ? "selected" : ""}`}>
                <input type="radio" name="template" value={t.id} checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                <span className="template-swatch" aria-hidden="true" style={{ background: t.swatch[0] }}>
                  <span style={{ background: t.swatch[1] }} />
                  <span style={{ background: t.swatch[2] }} />
                </span>
                <span className="template-name">{t.name}</span>
                <span className="muted small">{t.description}</span>
              </label>
            ))}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? "Creating…" : "Create website"}</button>
        </form>
      </main>
    </div>
  );
}
