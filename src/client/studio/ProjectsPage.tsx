import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type ProjectSummary, type SiteSummary } from "../api.js";
import { PublicationBadge, relative } from "../dashboard/Dashboard.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";
import { PROJECT_KIND_LABEL } from "./destinations.js";

export function projectHref(p: ProjectSummary): string {
  if (p.kind === "photo") return `/studio/photo/${p.id}`;
  return `/studio/design/${p.id}`;
}

export type ProjectFilter = "all" | "website" | "photo" | "design" | "design-template";

const PROJECT_FILTERS: ProjectFilter[] = ["all", "website", "photo", "design", "design-template"];
const PROJECT_RESULTS_PANEL_ID = "projects-results-panel";

export function nextProjectFilter(current: ProjectFilter, key: string): ProjectFilter | null {
  const index = PROJECT_FILTERS.indexOf(current);
  if (index < 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return PROJECT_FILTERS[(index + 1) % PROJECT_FILTERS.length] ?? null;
  if (key === "ArrowLeft" || key === "ArrowUp") return PROJECT_FILTERS[(index - 1 + PROJECT_FILTERS.length) % PROJECT_FILTERS.length] ?? null;
  if (key === "Home") return PROJECT_FILTERS[0] ?? null;
  if (key === "End") return PROJECT_FILTERS[PROJECT_FILTERS.length - 1] ?? null;
  return null;
}

export function projectResultsLiveMessage({ loading, error, filter, count }: { loading: boolean; error: string | null; filter: ProjectFilter; count: number }): string {
  if (loading) return "Loading your projects.";
  if (error) return "Could not load your projects.";
  const kindLabel = (PROJECT_KIND_LABEL[filter] ?? filter).toLowerCase();
  if (count === 0) {
    if (filter === "all") return "No projects found.";
    return `No ${kindLabel} projects found.`;
  }
  if (filter === "all") return `Showing ${count} project${count === 1 ? "" : "s"}.`;
  return `Showing ${count} ${kindLabel} project${count === 1 ? "" : "s"}.`;
}

export function ProjectsPage() {
  const toast = useToast();
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);
  const filterButtons = useRef<Record<ProjectFilter, HTMLButtonElement | null>>({
    all: null,
    website: null,
    photo: null,
    design: null,
    "design-template": null,
  });

  const load = async () => {
    try {
      const [s, p] = await Promise.all([api.sites(), api.projects()]);
      setSites(s.sites);
      setProjects(p.projects);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your projects");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const remove = async (p: ProjectSummary) => {
    setConfirm(null);
    try {
      await api.deleteProject(p.id);
      toast(`"${p.name}" was deleted`, "success");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete the project", "error");
    }
  };

  const loading = sites === null || projects === null;
  const rows = loading
    ? []
    : [
        ...sites.map((s) => ({ kind: "website" as const, site: s, project: null as ProjectSummary | null, updatedAt: s.updatedAt })),
        ...projects.map((p) => ({ kind: p.kind, site: null as SiteSummary | null, project: p, updatedAt: p.updatedAt })),
      ]
        .filter((r) => filter === "all" || r.kind === filter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = { all: (sites?.length ?? 0) + (projects?.length ?? 0), website: sites?.length ?? 0, photo: projects?.filter((p) => p.kind === "photo").length ?? 0, design: projects?.filter((p) => p.kind === "design").length ?? 0, "design-template": projects?.filter((p) => p.kind === "design-template").length ?? 0 };

  const onFilterKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: ProjectFilter) => {
    const next = nextProjectFilter(current, event.key);
    if (!next) return;
    event.preventDefault();
    setFilter(next);
    filterButtons.current[next]?.focus();
  };

  return (
    <StudioShell>
      <main className="studio-main">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">My Projects</span>
            <h1>Everything you are working on</h1>
            <p className="muted">Websites, photos, designs and templates, newest first. Each opens in its own tool.</p>
          </div>
          <div className="photo-actions">
            <Link to="/sites/new" className="btn btn-primary"><I.plus /> New website</Link>
            <Link to="/studio/design" className="btn"><I.plus /> New design</Link>
            <Link to="/studio/photo" className="btn"><I.plus /> Open a photo</Link>
          </div>
        </div>
        <div className="studio-filter" role="tablist" aria-label="Filter projects" aria-orientation="horizontal">
          {PROJECT_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              id={`projects-filter-tab-${f}`}
              role="tab"
              aria-controls={PROJECT_RESULTS_PANEL_ID}
              aria-selected={filter === f}
              tabIndex={filter === f ? 0 : -1}
              className={`btn btn-sm${filter === f ? " btn-primary" : ""}`}
              onClick={() => setFilter(f)}
              onKeyDown={(event) => onFilterKeyDown(event, f)}
              ref={(node) => {
                filterButtons.current[f] = node;
              }}
            >
              {f === "all" ? "All" : PROJECT_KIND_LABEL[f]}s · {counts[f]}
            </button>
          ))}
        </div>
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{projectResultsLiveMessage({ loading, error, filter, count: rows.length })}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section id={PROJECT_RESULTS_PANEL_ID} role="tabpanel" aria-labelledby={`projects-filter-tab-${filter}`}>
          {loading && !error && <p className="muted" role="status">Loading your projects…</p>}
          {!loading && rows.length === 0 && (
            <div className="empty-state">
              <h2>{filter === "all" ? "Nothing planted yet" : `No ${PROJECT_KIND_LABEL[filter]?.toLowerCase()}s yet`}</h2>
              <p className="muted">Start a website, open a photo or create a design. Saved work appears here.</p>
            </div>
          )}
          {rows.length > 0 && (
            <ul className="site-grid" aria-label="Projects">
              {rows.map((r) =>
                r.site ? (
                  <li key={`site-${r.site.id}`} className="site-card">
                    <div className="site-card-body">
                      <span className="badge">Website</span>
                      <h2>{r.site.name}</h2>
                      <p className="muted small">/s/{r.site.slug}/ · updated {relative(r.site.updatedAt)}</p>
                      <PublicationBadge site={r.site} />
                    </div>
                    <div className="site-card-actions">
                      <Link to={`/sites/${r.site.id}/edit`} className="btn btn-primary">Open editor</Link>
                      {r.site.liveUrl && <a className="btn" href={r.site.liveUrl} target="_blank" rel="noopener noreferrer">View live <I.external /></a>}
                      <Link to="/websites" className="btn btn-ghost">Manage</Link>
                    </div>
                  </li>
                ) : (
                  <li key={`project-${r.project!.id}`} className="site-card">
                    <div className="site-card-body">
                      <span className="badge">{PROJECT_KIND_LABEL[r.project!.kind]}</span>
                      <h2>{r.project!.name}</h2>
                      <p className="muted small">
                        {r.project!.meta.width && r.project!.meta.height ? `${r.project!.meta.width} × ${r.project!.meta.height}px · ` : ""}
                        {r.project!.kind !== "photo" && typeof r.project!.meta.layers === "number" ? `${r.project!.meta.layers} layer${r.project!.meta.layers === 1 ? "" : "s"} · ` : ""}
                        updated {relative(r.project!.updatedAt)} · rev {r.project!.revision}
                      </p>
                    </div>
                    <div className="site-card-actions">
                      <Link to={projectHref(r.project!)} className="btn btn-primary">{r.project!.kind === "design-template" ? "Edit template" : "Open"}</Link>
                      <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setConfirm(r.project)} aria-label={`Delete ${r.project!.name}`}><I.trash /></button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </main>
      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.name}"?`}
          message={<>This removes the {PROJECT_KIND_LABEL[confirm.kind]?.toLowerCase()} from your projects. {confirm.kind === "photo" ? "The original photo stays in your asset library until you delete it there." : "Images it used stay in your asset library."} This cannot be undone.</>}
          confirmLabel="Delete project"
          danger
          onConfirm={() => void remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </StudioShell>
  );
}
