import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ICON_CATEGORIES,
  ICON_LIST,
  ICON_SIZE_PRESETS,
  ICON_STROKE_DEFAULT,
  ICON_STROKE_MAX,
  ICON_STROKE_MIN,
  getIcon,
  searchIcons,
  type IconDefinition,
  type IconVariant,
} from "../../core/icons/index.js";
import { I } from "../components/Icons.js";
import { IconGlyph } from "./IconGlyph.js";
import { FAVORITES_KEY, RECENTS_KEY, pushRecent, readIconList, toggleFavorite, writeIconList } from "./iconPrefs.js";

export interface IconInsertSettings {
  variant: IconVariant;
  /** Square edge in px (one of the presets or a custom value). */
  size: number;
  strokeWidth: number;
  /** A validated colour, or null to inherit the surrounding theme/text colour. */
  color: string | null;
}

export interface IconPaletteColor {
  label: string;
  /** What gets stored (a CSS colour or a theme token). */
  value: string;
  /** A concrete colour for the preview swatch and the preview glyphs. */
  preview: string;
}

export interface IconBrowserProps {
  onInsert: (id: string, settings: IconInsertSettings) => void;
  insertLabel?: string;
  defaults?: Partial<IconInsertSettings>;
  /** Theme / brand-kit colours offered next to the free colour picker. */
  palette?: readonly IconPaletteColor[];
  /** Id of an icon to start on (e.g. the selected element's current icon). */
  initialId?: string;
}

const PAGE = 60;
type Scope = "all" | "favorites" | "recent";
const STYLE_LABEL: Record<IconVariant, string> = { outline: "Outline", duotone: "Duotone", filled: "Filled", inverted: "Inverted badge", brand: "Brand colour" };
const PREVIEW_SIZES = [16, 24, 32, 48] as const;

export function IconBrowser({ onInsert, insertLabel = "Insert icon", defaults, palette = [], initialId }: IconBrowserProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [category, setCategory] = useState("");
  const [style, setStyle] = useState<"any" | IconVariant>(defaults?.variant && defaults.variant !== "outline" ? defaults.variant : "any");
  const [size, setSize] = useState(defaults?.size ?? 32);
  const [strokeWidth, setStrokeWidth] = useState(defaults?.strokeWidth ?? ICON_STROKE_DEFAULT);
  const [color, setColor] = useState<string | null>(defaults?.color ?? null);
  const [selected, setSelected] = useState<string | null>(initialId && getIcon(initialId) ? initialId : null);
  const [shown, setShown] = useState(PAGE);
  const [favorites, setFavorites] = useState(() => readIconList(FAVORITES_KEY));
  const [recents, setRecents] = useState(() => readIconList(RECENTS_KEY));
  const grid = useRef<HTMLUListElement>(null);

  useEffect(() => setShown(PAGE), [query, scope, category, style]);

  const variant: IconVariant = style === "any" ? "outline" : style;
  const results = useMemo(() => {
    const within = scope === "favorites" ? favorites : scope === "recent" ? recents : undefined;
    const list = searchIcons(query, { category: category || undefined, variant: style === "any" ? undefined : style, within });
    if (scope === "recent" && !query.trim()) return [...list].sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
    return list;
  }, [query, scope, category, style, favorites, recents]);

  const current = selected ? getIcon(selected) : undefined;
  const effectiveVariant = (def: IconDefinition): IconVariant => (def.variants.includes(variant) ? variant : "outline");
  const paintOf = (v: IconVariant) => (v === "brand" ? (color ?? palette[0]?.preview ?? undefined) : color ? (palette.find((p) => p.value === color)?.preview ?? color) : undefined);
  const storedColor = variant === "brand" && !color ? (palette[0]?.value ?? null) : color;

  const insert = (id: string) => {
    const def = getIcon(id);
    if (!def) return;
    const next = pushRecent(recents, id);
    setRecents(next);
    writeIconList(RECENTS_KEY, next);
    onInsert(id, { variant: effectiveVariant(def), size, strokeWidth, color: storedColor });
  };
  const flipFavorite = (id: string) => {
    const next = toggleFavorite(favorites, id);
    setFavorites(next);
    writeIconList(FAVORITES_KEY, next);
  };

  const onGridKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const cells = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>("button[data-icon-cell]") ?? []);
    const index = cells.findIndex((c) => c === document.activeElement);
    if (index < 0) return;
    const columns = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(" ").length : 1;
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, ArrowDown: index + columns, ArrowUp: index - columns, Home: 0, End: cells.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    cells[Math.max(0, Math.min(cells.length - 1, target))]?.focus();
  };

  const emptyText =
    scope === "favorites" && !favorites.length
      ? "No favorites yet. Use the star on any icon to keep it here."
      : scope === "recent" && !recents.length
        ? "Icons you insert will show up here."
        : `No icons match “${query}”. Try a simpler word like “photo”, “mail” or “settings”.`;

  return (
    <div className="icon-browser">
      <div className="icon-browser-controls">
        <div className="panel-search">
          <I.search />
          <input type="search" placeholder="Search 250 icons (try “photo” or “remove”)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search icons" autoComplete="off" />
        </div>
        <div className="chip-row" role="group" aria-label="Show">
          {(["all", "favorites", "recent"] as const).map((s) => (
            <button key={s} type="button" className={`chip ${scope === s ? "active" : ""}`} aria-pressed={scope === s} onClick={() => setScope(s)}>
              {s === "all" ? "All" : s === "favorites" ? `Favorites (${favorites.length})` : "Recent"}
            </button>
          ))}
        </div>
        <div className="icon-browser-row">
          <label className="field">
            <span className="field-label">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Icon category">
              <option value="">All categories (250)</option>
              {ICON_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{String(c.number).padStart(2, "0")} {c.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Style</span>
            <select value={style} onChange={(e) => setStyle(e.target.value as "any" | IconVariant)} aria-label="Icon style">
              <option value="any">All (outline)</option>
              {(["outline", "duotone", "filled", "inverted", "brand"] as const).map((v) => (
                <option key={v} value={v}>{STYLE_LABEL[v]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="icon-browser-row">
          <label className="field">
            <span className="field-label">Size</span>
            <select value={ICON_SIZE_PRESETS.includes(size as never) ? String(size) : "custom"} onChange={(e) => e.target.value !== "custom" && setSize(Number(e.target.value))} aria-label="Icon size">
              {ICON_SIZE_PRESETS.map((p) => (
                <option key={p} value={p}>{p} px</option>
              ))}
              <option value="custom">Custom ({size} px)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Custom px</span>
            <input type="number" min={8} max={400} value={size} onChange={(e) => setSize(Math.max(8, Math.min(400, Number(e.target.value) || 24)))} aria-label="Custom icon size in pixels" />
          </label>
        </div>
        <div className="icon-browser-row single">
          <label className="field">
            <span className="field-label">Stroke weight · {strokeWidth}</span>
            <input type="range" min={ICON_STROKE_MIN} max={ICON_STROKE_MAX} step={0.5} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} aria-label="Stroke weight" />
          </label>
          <div className="field">
            <span className="field-label" id="icon-colour-label">Colour</span>
            <div className="icon-colour" role="group" aria-labelledby="icon-colour-label">
              <button type="button" className={`icon-swatch inherit ${color === null ? "on" : ""}`} aria-pressed={color === null} title="Match the surrounding text colour" onClick={() => setColor(null)}>Auto</button>
              {palette.map((p) => (
                <button key={p.value} type="button" className={`icon-swatch ${color === p.value ? "on" : ""}`} style={{ background: p.preview }} aria-pressed={color === p.value} aria-label={p.label} title={p.label} onClick={() => setColor(p.value)} />
              ))}
              <input type="color" aria-label="Custom colour" value={color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1f6f4a"} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <p className="help" role="status" aria-live="polite">{results.length} icon{results.length === 1 ? "" : "s"}</p>
      {results.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="icon-grid" ref={grid} onKeyDown={onGridKey} aria-label="Icons">
          {results.slice(0, shown).map((def) => {
            const fav = favorites.includes(def.id);
            return (
              <li key={def.id} className={`icon-cell ${selected === def.id ? "selected" : ""}`}>
                <button type="button" data-icon-cell data-icon-id={def.id} className="icon-cell-main" aria-pressed={selected === def.id} aria-label={def.name} title={def.name} onClick={() => setSelected(def.id)} onDoubleClick={() => insert(def.id)}>
                  <IconGlyph id={def.id} size={28} variant={effectiveVariant(def)} strokeWidth={strokeWidth} color={paintOf(effectiveVariant(def))} />
                </button>
                <button type="button" className={`icon-fav ${fav ? "on" : ""}`} aria-pressed={fav} aria-label={fav ? `Remove ${def.name} from favorites` : `Add ${def.name} to favorites`} onClick={() => flipFavorite(def.id)}>
                  <I.star />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > shown && (
        <button type="button" className="btn btn-sm" onClick={() => setShown((n) => n + PAGE)}>Show more ({results.length - shown} left)</button>
      )}

      <section className="icon-detail" aria-label="Selected icon" aria-live="polite">
        {current ? (
          <>
            <div className="icon-detail-head">
              <IconGlyph id={current.id} size={48} variant={effectiveVariant(current)} strokeWidth={strokeWidth} color={paintOf(effectiveVariant(current))} />
              <div>
                <strong>{current.name}</strong>
                <div className="small muted"><code>{current.id}</code></div>
                <div className="small muted">{String(current.number).padStart(3, "0")} · {current.categoryName}</div>
              </div>
            </div>
            <div className="icon-sizes" aria-label="Preview at common sizes">
              {PREVIEW_SIZES.map((s) => (
                <span key={s} className="icon-size-preview">
                  <IconGlyph id={current.id} size={s} variant={effectiveVariant(current)} strokeWidth={strokeWidth} color={paintOf(effectiveVariant(current))} />
                  <span className="small muted">{s}</span>
                </span>
              ))}
            </div>
            <div className="chip-row" aria-label="Available styles">
              {current.variants.map((v) => (
                <span key={v} className="badge">{STYLE_LABEL[v]}</span>
              ))}
            </div>
            {style !== "any" && !current.variants.includes(style) && <p className="help">{STYLE_LABEL[style]} isn’t available for this icon, so it uses Outline.</p>}
            <p className="help">{current.source.kind === "original" ? "BINHI original" : `Lucide · ${current.licence.spdx}`}</p>
            <button type="button" className="btn btn-primary" onClick={() => insert(current.id)}>{insertLabel}</button>
          </>
        ) : (
          <p className="muted">Select an icon to see its sizes and styles, then insert it.</p>
        )}
      </section>

      <details className="icon-about">
        <summary>About these icons</summary>
        <p className="help">{ICON_LIST.length} icons in 25 categories. Geometry from Lucide (ISC licence, some derived from Feather, MIT) plus BINHI originals. No icon fonts or remote services. Licence notices: <a href="/third-party-notices.txt" target="_blank" rel="noopener noreferrer">third-party notices</a>.</p>
      </details>
    </div>
  );
}
