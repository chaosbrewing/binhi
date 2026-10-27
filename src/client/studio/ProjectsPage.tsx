import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, type ProjectSummary, type SiteSummary } from "../api.js";
import { PublicationBadge, relative } from "../dashboard/Dashboard.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";
import { PROJECT_KIND_LABEL } from "./destinations.js";
import { applyProjectsViewState, parseProjectsViewState, PROJECT_FILTERS, type ProjectsViewState } from "./viewState.js";

export function projectHref(p: ProjectSummary): string {
  if (p.kind === "photo") return `/studio/photo/${p.id}`;
  return `/studio/design/${p.id}`;
}

export function ProjectsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewState = parseProjectsViewState(searchParams);
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);

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
  const updateViewState = (patch: Partial<ProjectsViewState>, replace = false) => {
    const next = applyProjectsViewState(searchParams, { ...viewState, ...patch });
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace });
  };
  const searchNeedle = viewState.search.toLowerCase();
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  const rows = loading
    ? []
    : [
        ...sites.map((s) => ({ kind: "website" as const, site: s, project: null as ProjectSummary | null, updatedAt: s.updatedAt })),
        ...projects.map((p) => ({ kind: p.kind, site: null as SiteSummary | null, project: p, updatedAt: p.updatedAt })),
      ]
        .filter((r) => viewState.filter === "all" || r.kind === viewState.filter)
        .filter((r) => {
          if (!searchNeedle) return true;
          const haystack = r.site ? `${r.site.name} ${r.site.slug}` : `${r.project!.name} ${PROJECT_KIND_LABEL[r.project!.kind] ?? ""}`;
          return haystack.toLowerCase().includes(searchNeedle);
        })
        .sort((a, b) => {
          const aName = a.site?.name ?? a.project!.name;
          const bName = b.site?.name ?? b.project!.name;
          switch (viewState.sort) {
            case "updated-asc":
              return a.updatedAt.localeCompare(b.updatedAt);
            case "name-asc":
              return byName(aName, bName);
            case "name-desc":
              return byName(bName, aName);
            default:
              return b.updatedAt.localeCompare(a.updatedAt);
          }
        });
  const counts = {
    all: (sites?.length ?? 0) + (projects?.length ?? 0),
    website: sites?.length ?? 0,
    photo: projects?.filter((p) => p.kind === "photo").length ?? 0,
    design: projects?.filter((p) => p.kind === "design").length ?? 0,
    "design-template": projects?.filter((p) => p.kind === "design-template").length ?? 0,
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
        <div className="studio-controls" aria-label="Project view controls">
          <label className="field-block grow" htmlFor="projects-search">
            Search
            <input
              id="projects-search"
              type="search"
              value={viewState.search}
              placeholder="Project or website name"
              onChange={(e) => updateViewState({ search: e.target.value }, true)}
            />
          </label>
          <label className="field-block" htmlFor="projects-sort">
            Sort
            <select id="projects-sort" value={viewState.sort} onChange={(e) => updateViewState({ sort: e.target.value as ProjectsViewState["sort"] })}>
              <option value="updated-desc">Recently updated</option>
              <option value="updated-asc">Least recently updated</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </label>
        </div>
        <div className="studio-filter" role="tablist" aria-label="Filter projects">
          {PROJECT_FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={viewState.filter === f} className={`btn btn-sm${viewState.filter === f ? " btn-primary" : ""}`} onClick={() => updateViewState({ filter: f })}>
              {f === "all" ? "All" : PROJECT_KIND_LABEL[f]}s · {counts[f]}
            </button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading && !error && <p className="muted" role="status">Loading your projects…</p>}
        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <h2>{viewState.search ? `No matches for "${viewState.search}"` : viewState.filter === "all" ? "Nothing planted yet" : `No ${PROJECT_KIND_LABEL[viewState.filter]?.toLowerCase()}s yet`}</h2>
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
                    <button className="btn btn-ghost btn-danger-text" onClick={() => setConfirm(r.project)} aria-label={`Delete ${r.project!.name}`}><I.trash /></button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
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
