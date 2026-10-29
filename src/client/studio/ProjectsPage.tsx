import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, type ProjectSummary, type SiteSummary } from "../api.js";
import { PublicationBadge } from "../dashboard/PublicationBadge.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { relative } from "../utils/relativeTime.js";
import { StudioShell } from "./StudioShell.js";
import { PROJECT_KIND_LABEL } from "./destinations.js";
import { applyProjectsViewState, parseProjectsViewState, PROJECT_FILTERS, type ProjectFilter, type ProjectsViewState } from "./viewState.js";
import { initialVisibleCount, LIST_PAGE_SIZE, nextVisibleCount, visibleSlice } from "./listPagination.js";
import { projectHref } from "./projectHref.js";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const viewState = parseProjectsViewState(searchParams);
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
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
  const visibleRows = visibleSlice(rows, visibleCount);
  const canLoadMore = visibleRows.length < rows.length;
  const rowLabel = viewState.filter === "all" ? "items" : `${(PROJECT_KIND_LABEL[viewState.filter] ?? viewState.filter).toLowerCase()}s`;
  const counts = {
    all: (sites?.length ?? 0) + (projects?.length ?? 0),
    website: sites?.length ?? 0,
    photo: projects?.filter((p) => p.kind === "photo").length ?? 0,
    design: projects?.filter((p) => p.kind === "design").length ?? 0,
    "design-template": projects?.filter((p) => p.kind === "design-template").length ?? 0,
  };

  useEffect(() => {
    setVisibleCount(initialVisibleCount(rows.length));
  }, [viewState.filter, viewState.search, rows.length]);

  const onFilterKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: ProjectFilter) => {
    const next = nextProjectFilter(current, event.key);
    if (!next) return;
    event.preventDefault();
    updateViewState({ filter: next });
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
        <div className="studio-filter" role="tablist" aria-label="Filter projects" aria-orientation="horizontal">
          {PROJECT_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              id={`projects-filter-tab-${f}`}
              role="tab"
              aria-controls={PROJECT_RESULTS_PANEL_ID}
              aria-selected={viewState.filter === f}
              tabIndex={viewState.filter === f ? 0 : -1}
              className={`btn btn-sm${viewState.filter === f ? " btn-primary" : ""}`}
              onClick={() => updateViewState({ filter: f })}
              onKeyDown={(event) => onFilterKeyDown(event, f)}
              ref={(node) => {
                filterButtons.current[f] = node;
              }}
            >
              {f === "all" ? "All" : PROJECT_KIND_LABEL[f]}s · {counts[f]}
            </button>
          ))}
        </div>
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{projectResultsLiveMessage({ loading, error, filter: viewState.filter, count: rows.length })}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section id={PROJECT_RESULTS_PANEL_ID} role="tabpanel" aria-labelledby={`projects-filter-tab-${viewState.filter}`}>
          {loading && !error && <p className="muted" role="status">Loading your projects…</p>}
          {!loading && rows.length === 0 && (
            <div className="empty-state">
              <h2>{viewState.search ? `No matches for "${viewState.search}"` : viewState.filter === "all" ? "Nothing planted yet" : `No ${PROJECT_KIND_LABEL[viewState.filter]?.toLowerCase()}s yet`}</h2>
              <p className="muted">Start a website, open a photo or create a design. Saved work appears here.</p>
            </div>
          )}
          {visibleRows.length > 0 && (
            <>
              <ul className="site-grid" aria-label="Projects">
                {visibleRows.map((r) =>
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
              <div className="list-pagination" aria-live="polite">
                <p className="small muted">Showing {visibleRows.length} of {rows.length} {rowLabel}</p>
                {canLoadMore && (
                  <button className="btn" onClick={() => setVisibleCount((current) => nextVisibleCount(current, rows.length))}>
                    <I.plus /> Load {Math.min(LIST_PAGE_SIZE, rows.length - visibleRows.length)} more
                  </button>
                )}
              </div>
            </>
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
