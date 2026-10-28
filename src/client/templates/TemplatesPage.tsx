import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, type ProjectSummary, type TemplateCard, type TemplateFacets, type TemplateTaxonomy } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { createDesignDocument } from "../../core/creative/index.js";
import { relative } from "../utils/relativeTime.js";
import { StudioShell } from "../studio/StudioShell.js";
import { loadPrefs, pushRecent, toggleFavorite, type TemplatePrefs } from "./prefs.js";
import { TemplateCardView } from "./TemplateCardView.js";
import { TemplatePreview } from "./TemplatePreview.js";
import "./templates.css";

const PAGE_SIZE = 24;
const BLANKS = [
  { id: "square", label: "Square", note: "1080 × 1080", w: 1080, h: 1080 },
  { id: "portrait", label: "Portrait", note: "1080 × 1350", w: 1080, h: 1350 },
  { id: "landscape", label: "Landscape", note: "1920 × 1080", w: 1920, h: 1080 },
] as const;

interface Filters { q: string; format: string; category: string; style: string; orientation: string; sort: string }

/**
 * Templates: one place to find a starting point for any output BINHI can
 * really produce. Format first, then category and style. Search and filters
 * run on the server; favorites and recents stay in this browser.
 */
export function TemplatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters: Filters = useMemo(() => ({ q: params.get("q") ?? "", format: params.get("format") ?? "all", category: params.get("category") ?? "", style: params.get("style") ?? "", orientation: params.get("orientation") ?? "", sort: params.get("sort") ?? "" }), [params]);
  const [search, setSearch] = useState(filters.q);

  const [taxonomy, setTaxonomy] = useState<TemplateTaxonomy | null>(null);
  const [items, setItems] = useState<TemplateCard[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<TemplateFacets | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<TemplatePrefs>(() => (user ? loadPrefs(user.id) : { favorites: [], recents: [] }));
  const [favoriteCards, setFavoriteCards] = useState<TemplateCard[]>([]);
  const [recentCards, setRecentCards] = useState<TemplateCard[]>([]);
  const [featured, setFeatured] = useState<TemplateCard[]>([]);
  const [collectionCards, setCollectionCards] = useState<Record<string, TemplateCard[]>>({});
  const [mine, setMine] = useState<ProjectSummary[] | null>(null);
  const [preview, setPreview] = useState<TemplateCard | null>(null);
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const isBrowse = !filters.q && filters.format === "all" && !filters.category && !filters.style && !filters.orientation;

  const setFilter = useCallback((patch: Partial<Filters>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Debounce typing into the URL so every keystroke is not a request.
  useEffect(() => {
    if (search === filters.q) return;
    const t = setTimeout(() => setFilter({ q: search.trim() }), 250);
    return () => clearTimeout(t);
  }, [search, filters.q, setFilter]);

  useEffect(() => {
    api.templateTaxonomy().then(setTaxonomy).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load templates"));
    api.projects("design-template").then((r) => setMine(r.projects)).catch(() => setMine([]));
  }, []);

  const fetchPage = useCallback(async (nextPage: number, replace: boolean) => {
    const mySeq = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api.templateList({ q: filters.q, format: filters.format, category: filters.category, style: filters.style, orientation: filters.orientation, sort: filters.sort, page: nextPage, pageSize: PAGE_SIZE });
      if (mySeq !== seq.current) return;
      setItems((prev) => (replace ? r.items : [...prev, ...r.items]));
      setTotal(r.total);
      setFacets(r.facets);
      setPage(r.page);
    } catch (e) {
      if (mySeq === seq.current) setError(e instanceof ApiError ? e.message : "Could not load templates");
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, [filters.q, filters.format, filters.category, filters.style, filters.orientation, filters.sort]);

  useEffect(() => {
    void fetchPage(1, true);
  }, [fetchPage]);

  // Browse sections resolve small id lists, never the whole catalog.
  useEffect(() => {
    if (!isBrowse) return;
    let alive = true;
    api.templateList({ sort: "latest", pageSize: 48 }).then((r) => alive && setFeatured(r.items.filter((c) => c.featured).slice(0, 6))).catch(() => undefined);
    if (taxonomy?.collections.length) {
      Promise.all(taxonomy.collections.map((c) => api.templateCards(c.templateIds).then((r) => [c.id, r.items] as const))).then((entries) => alive && setCollectionCards(Object.fromEntries(entries))).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [isBrowse, taxonomy]);
  useEffect(() => {
    let alive = true;
    api.templateCards(prefs.favorites).then((r) => alive && setFavoriteCards(r.items)).catch(() => undefined);
    api.templateCards(prefs.recents).then((r) => alive && setRecentCards(r.items)).catch(() => undefined);
    return () => { alive = false; };
  }, [prefs]);

  const onFavorite = (card: TemplateCard) => {
    if (!user) return;
    setPrefs((p) => toggleFavorite(user.id, p, card.id));
  };
  const onUsed = (card: TemplateCard) => {
    if (user) pushRecent(user.id, card.id);
  };
  const isFav = (id: string) => prefs.favorites.includes(id);

  const startBlank = async (w: number, h: number, label: string) => {
    setBusy(true);
    try {
      const { project } = await api.createProject("design", `Untitled ${label.toLowerCase()} design`, createDesignDocument(w, h));
      navigate(`/studio/design/${project.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not start a blank design", "error");
      setBusy(false);
    }
  };
  const useMine = async (t: ProjectSummary) => {
    setBusy(true);
    try {
      const { project } = await api.duplicateProject(t.id, { kind: "design", name: t.name });
      navigate(`/studio/design/${project.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not start from this template", "error");
      setBusy(false);
    }
  };
  const removeMine = async (t: ProjectSummary) => {
    setConfirm(null);
    try {
      await api.deleteProject(t.id);
      setMine((m) => (m ?? []).filter((x) => x.id !== t.id));
      toast(`Template "${t.name}" deleted`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete the template", "error");
    }
  };

  const grid = (cards: TemplateCard[], label: string) => (
    <ul className="tpl-grid" aria-label={label}>
      {cards.map((c) => <TemplateCardView key={c.id} card={c} favorite={isFav(c.id)} onPreview={setPreview} onToggleFavorite={onFavorite} />)}
    </ul>
  );

  // Counts follow the current search and filters; before the first result they fall back to the catalog totals.
  const formatCount = (id: string, fallback: number): number => {
    if (!facets) return fallback;
    return id === "all" ? Object.values(facets.formats).reduce((a, b) => a + b, 0) : (facets.formats[id] ?? 0);
  };
  const activeFormat = taxonomy?.formats.find((f) => f.id === filters.format);
  const categoriesWithTemplates = taxonomy?.categories.filter((c) => c.count > 0) ?? [];
  const clear = () => { setSearch(""); setParams(new URLSearchParams(), { replace: true }); };

  return (
    <StudioShell>
      <main className="studio-main tpl-page">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">Templates</span>
            <h1>Start with something real</h1>
            <p className="muted">Every template opens as your own editable project. Pick one, make it yours, and export or publish it.</p>
          </div>
          <Link to="/" className="btn btn-ghost"><span aria-hidden="true">←</span> Studio</Link>
        </div>

        <form className="tpl-search" role="search" onSubmit={(e) => { e.preventDefault(); setFilter({ q: search.trim() }); }}>
          <I.search />
          <input type="search" aria-label="Search templates" placeholder="Search templates: “instagram post”, “portfolio”, “flyer”…" value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} />
        </form>

        <div className="tpl-formats" role="group" aria-label="Format">
          {taxonomy?.formats.map((f) => (
            <button key={f.id} type="button" className={`tpl-chip${f.available || f.id === "all" ? "" : " is-unavailable"}`} aria-pressed={filters.format === f.id} onClick={() => setFilter({ format: f.id })}>
              {f.label}<span className="tpl-chip-count">{f.available || f.id === "all" ? formatCount(f.id, f.count) : "soon"}</span>
            </button>
          ))}
        </div>

        <div className="tpl-filters">
          <label><span>Category</span>
            <select aria-label="Category" value={filters.category} onChange={(e) => setFilter({ category: e.target.value })}>
              <option value="">All categories</option>
              {taxonomy?.categories.map((c) => <option key={c.id} value={c.id} disabled={c.count === 0 && filters.category !== c.id}>{c.name} ({c.count})</option>)}
            </select>
          </label>
          <label><span>Style</span>
            <select aria-label="Style" value={filters.style} onChange={(e) => setFilter({ style: e.target.value })}>
              <option value="">Any style</option>
              {taxonomy?.styles.map((s) => <option key={s.id} value={s.id} disabled={s.count === 0 && filters.style !== s.id}>{s.label} ({s.count})</option>)}
            </select>
          </label>
          <label><span>Orientation</span>
            <select aria-label="Orientation" value={filters.orientation} onChange={(e) => setFilter({ orientation: e.target.value })}>
              <option value="">Any</option>
              {taxonomy?.orientations.map((o) => <option key={o} value={o}>{o[0]!.toUpperCase() + o.slice(1)}</option>)}
            </select>
          </label>
          <label><span>Sort</span>
            <select aria-label="Sort" value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })}>
              <option value="">{filters.q ? "Best match" : "Newest"}</option>
              <option value="latest">Newest</option>
              <option value="name">Name</option>
            </select>
          </label>
          {!isBrowse && <button type="button" className="btn btn-ghost" onClick={clear}>Clear filters</button>}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        {isBrowse && (
          <>
            <section aria-labelledby="tpl-blank-h" className="tpl-section">
              <h2 id="tpl-blank-h">Start blank</h2>
              <div className="tpl-blank">
                {BLANKS.map((b) => (
                  <button key={b.id} type="button" className="tpl-blank-card" disabled={busy} onClick={() => void startBlank(b.w, b.h, b.label)}>
                    <span className="tpl-blank-shape" style={{ aspectRatio: `${b.w} / ${b.h}` }} aria-hidden="true" />
                    <strong>{b.label}</strong><span className="muted small">{b.note}</span>
                  </button>
                ))}
                <Link to="/studio/design" className="tpl-blank-card"><span className="tpl-blank-shape" aria-hidden="true" style={{ aspectRatio: "1 / 1" }} /><strong>Custom size</strong><span className="muted small">Choose any size</span></Link>
                <Link to="/sites/new" className="tpl-blank-card"><span className="tpl-blank-shape" aria-hidden="true" style={{ aspectRatio: "4 / 3" }} /><strong>Empty website</strong><span className="muted small">Blank canvas</span></Link>
              </div>
            </section>

            {recentCards.length > 0 && <section aria-labelledby="tpl-recent-h" className="tpl-section"><h2 id="tpl-recent-h">Recently used</h2>{grid(recentCards, "Recently used templates")}</section>}
            {favoriteCards.length > 0 && <section aria-labelledby="tpl-fav-h" className="tpl-section"><h2 id="tpl-fav-h">Your favorites</h2>{grid(favoriteCards, "Favorite templates")}</section>}
            {featured.length > 0 && <section aria-labelledby="tpl-feat-h" className="tpl-section"><h2 id="tpl-feat-h">Featured by BINHI</h2>{grid(featured, "Featured templates")}</section>}
            {taxonomy?.collections.map((c) => (collectionCards[c.id]?.length ? <section key={c.id} className="tpl-section" aria-label={c.title}><h2>{c.title}</h2><p className="muted small">{c.description}</p>{grid(collectionCards[c.id]!, c.title)}</section> : null))}

            {categoriesWithTemplates.length > 0 && (
              <section aria-labelledby="tpl-cat-h" className="tpl-section">
                <h2 id="tpl-cat-h">Browse by category</h2>
                <ul className="tpl-cats">
                  {categoriesWithTemplates.map((c) => <li key={c.id}><button type="button" className="tpl-chip" onClick={() => setFilter({ category: c.id })}>{c.name}<span className="tpl-chip-count">{c.count}</span></button></li>)}
                </ul>
              </section>
            )}

            <section aria-labelledby="tpl-mine-h" className="tpl-section">
              <h2 id="tpl-mine-h">Your templates</h2>
              {mine === null && <p className="muted" role="status">Loading…</p>}
              {mine && mine.length === 0 && <div className="studio-empty"><strong>No templates of your own yet.</strong><p>Open any design and use “Save as template” to keep its layout for next time.</p></div>}
              {mine && mine.length > 0 && (
                <ul className="site-grid" aria-label="Your design templates">
                  {mine.map((t) => (
                    <li key={t.id} className="site-card">
                      <div className="site-card-body"><span className="badge">Template</span><h3>{t.name}</h3><p className="muted small">{t.meta.width} × {t.meta.height}px · {t.meta.layers} layer{t.meta.layers === 1 ? "" : "s"} · updated {relative(t.updatedAt)}</p></div>
                      <div className="site-card-actions">
                        <button className="btn btn-primary" disabled={busy} onClick={() => void useMine(t)}>Use template</button>
                        <Link to={`/studio/design/${t.id}`} className="btn">Edit template</Link>
                        <button className="btn btn-ghost btn-danger-text" aria-label={`Delete template ${t.name}`} onClick={() => setConfirm(t)}><I.trash /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section aria-labelledby="tpl-all-h" className="tpl-section">
          <div className="tpl-results-head">
            <h2 id="tpl-all-h">{isBrowse ? "All templates" : "Results"}</h2>
            <p className="muted small" role="status" aria-live="polite">{loading && items.length === 0 ? "Loading…" : `${items.length} of ${total} template${total === 1 ? "" : "s"}`}</p>
          </div>
          {items.length > 0 && grid(items, "Templates")}
          {!loading && items.length === 0 && !error && (
            <div className="studio-empty tpl-empty">
              {activeFormat && !activeFormat.available && activeFormat.id !== "all" ? (
                <><strong>{activeFormat.label} templates are not available yet.</strong><p>{activeFormat.note ?? "The editor for this format does not exist yet."}</p></>
              ) : taxonomy && taxonomy.total === 0 ? (
                <><strong>No templates have been published yet.</strong><p>You can still start from a blank canvas above, or save one of your own designs as a template.</p></>
              ) : (
                <><strong>No templates match.</strong><p>Try fewer words, another format, or clear the filters.</p><button type="button" className="btn" onClick={clear}>Clear filters</button></>
              )}
            </div>
          )}
          {items.length < total && <div className="tpl-more"><button type="button" className="btn" disabled={loading} onClick={() => void fetchPage(page + 1, false)}>{loading ? "Loading…" : "Show more"}</button></div>}
        </section>
      </main>

      {preview && <TemplatePreview card={preview} favorite={isFav(preview.id)} onToggleFavorite={onFavorite} onUsed={onUsed} onClose={() => setPreview(null)} />}
      {confirm && <ConfirmDialog title={`Delete template "${confirm.name}"?`} message="Designs already created from it are not affected. This cannot be undone." confirmLabel="Delete template" danger onConfirm={() => void removeMine(confirm)} onCancel={() => setConfirm(null)} />}
    </StudioShell>
  );
}
