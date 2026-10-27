import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type SiteSummary } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { Logo } from "../components/Logo.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import { relative } from "../utils/relativeTime.js";
import { PublicationBadge } from "./PublicationBadge.js";

export function Dashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SiteSummary | null>(null);

  const load = async () => {
    try {
      setSites((await api.sites()).sites);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your websites");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const remove = async (site: SiteSummary) => {
    setConfirm(null);
    try {
      await api.deleteSite(site.id);
      toast(`"${site.name}" was deleted`, "success");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete the site", "error");
    }
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <Logo />
        <nav className="shell-nav" aria-label="Account">
          <Link to="/" className="btn btn-ghost">Studio home</Link>
          <ThemeToggle />
          <Link to="/account" className="btn btn-ghost">{user?.displayName}</Link>
          <button className="btn btn-ghost" onClick={() => void logout().then(() => nav("/signin"))}>Sign out</button>
        </nav>
      </header>
      <main className="shell-main">
        <div className="page-head">
          <div>
            <h1>Your websites</h1>
            <p className="muted">Each website has its own pages, media, revision history and publishing.</p>
          </div>
          <Link to="/sites/new" className="btn btn-primary"><I.plus /> New website</Link>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {sites === null && !error && <p className="muted" role="status">Loading your websites…</p>}
        {sites && sites.length === 0 && (
          <div className="empty-state">
            <h2>Nothing planted yet</h2>
            <p className="muted">Start from a template or a blank canvas. You can change everything later.</p>
            <Link to="/sites/new" className="btn btn-primary">Create your first website</Link>
          </div>
        )}
        {sites && sites.length > 0 && (
          <ul className="site-grid">
            {sites.map((s) => (
              <li key={s.id} className="site-card">
                <div className="site-card-body">
                  <h2>{s.name}</h2>
                  <p className="muted small">/s/{s.slug}/ · updated {relative(s.updatedAt)}</p>
                  <PublicationBadge site={s} />
                </div>
                <div className="site-card-actions">
                  <Link to={`/sites/${s.id}/edit`} className="btn btn-primary">Open editor</Link>
                  {s.liveUrl && <a className="btn" href={s.liveUrl} target="_blank" rel="noopener noreferrer">View live <I.external /></a>}
                  <button className="btn btn-ghost btn-danger-text" onClick={() => setConfirm(s)} aria-label={`Delete ${s.name}`}><I.trash /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.name}"?`}
          message={<>This removes the website, its media and revision history, and takes the published site offline. This cannot be undone.</>}
          confirmLabel="Delete website"
          danger
          onConfirm={() => void remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

