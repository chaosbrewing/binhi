import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ProjectSummary, type SiteSummary } from "../api.js";
import { relative } from "../dashboard/Dashboard.js";
import { StudioShell } from "./StudioShell.js";
import { DESTINATIONS, PROJECT_KIND_LABEL } from "./destinations.js";
import { projectHref } from "./ProjectsPage.js";

type Recent = { id: string; name: string; kind: string; updatedAt: string; href: string };

export function StudioHome() {
  const [recent, setRecent] = useState<Recent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([api.sites(), api.projects()])
      .then(([sites, projects]) => {
        if (!active) return;
        const items: Recent[] = [
          ...sites.sites.map((s: SiteSummary) => ({ id: s.id, name: s.name, kind: "website", updatedAt: s.updatedAt, href: `/sites/${s.id}/edit` })),
          ...projects.projects.map((p: ProjectSummary) => ({ id: p.id, name: p.name, kind: p.kind, updatedAt: p.updatedAt, href: projectHref(p) })),
        ];
        items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setRecent(items.slice(0, 6));
      })
      .catch(() => active && setError("Recent work could not be loaded right now."));
    return () => {
      active = false;
    };
  }, []);
  const available = DESTINATIONS.filter((d) => d.availability === "available").length;
  return (
    <StudioShell>
      <main className="studio-main">
        <section className="studio-hero studio-motion">
          <div className="studio-hero-copy">
            <span className="studio-eyebrow">Your creative studio</span>
            <h1 className="studio-title">One studio.<br />More ways to create.</h1>
            <p className="studio-lede">Websites, photos, graphics, templates and brand kits in one creator-owned workspace. Every card below says plainly whether it works today or is still planned.</p>
            <div className="photo-actions">
              <Link to="/websites" className="btn btn-primary btn-lg">Open Website Builder <span aria-hidden="true">→</span></Link>
              <Link to="/studio/design" className="btn btn-lg">Start a design</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="recent-heading" className="studio-motion-delay">
          <div className="studio-section-head">
            <div>
              <span className="studio-eyebrow">Pick up where you left off</span>
              <h2 id="recent-heading">Recent work</h2>
            </div>
            <Link to="/projects" className="btn btn-ghost">All projects</Link>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {recent === null && !error && <p className="muted" role="status">Loading your recent work…</p>}
          {recent && recent.length === 0 && (
            <div className="studio-empty">
              <strong>Nothing here yet.</strong>
              <p>Create a website, open a photo or start a design. Your work shows up here as soon as it is saved.</p>
            </div>
          )}
          {recent && recent.length > 0 && (
            <ul className="studio-recent" aria-label="Recent projects">
              {recent.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link to={item.href} className="studio-recent-card">
                    <span className="badge">{PROJECT_KIND_LABEL[item.kind] ?? item.kind}</span>
                    <strong>{item.name}</strong>
                    <span className="small muted">updated {relative(item.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="modules-heading" className="studio-motion-delay">
          <div className="studio-section-head">
            <div>
              <span className="studio-eyebrow">One workspace, honest status</span>
              <h2 id="modules-heading">Pick up where you need to work</h2>
            </div>
            <p className="small">{available} of {DESTINATIONS.length} tools available today. Your work stays yours.</p>
          </div>
          <div className="studio-module-grid">
            {DESTINATIONS.map((module, index) => (
              <Link key={module.id} to={module.href} className={`studio-module${module.wide ? " wide" : ""}`} aria-label={`${module.title}${module.availability === "planned" ? ", planned, not available yet" : ""}`} data-availability={module.availability}>
                <span className="module-index">{String(index + 1).padStart(2, "0")} / BINHI</span>
                <span className="module-mark" aria-hidden="true">{module.mark}</span>
                <h3>{module.title}</h3>
                <p>{module.detail}</p>
                <span className="module-note small">{module.note}</span>
                {module.availability === "planned" ? <span className="module-soon">Planned</span> : <span className="module-available">Available</span>}
              </Link>
            ))}
          </div>
        </section>

        <aside className="studio-note">
          <span className="studio-note-mark" aria-hidden="true">i</span>
          <div><strong>Private until you publish.</strong><p>Photo originals, designs and asset-library files are stored with your account and are only visible to you. Nothing becomes public unless you publish a website or copy a file into a website's media.</p></div>
        </aside>
      </main>
    </StudioShell>
  );
}
