import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type BrandKit, type LibraryAsset } from "../../api.js";
import { DESIGN_LIMITS, fontStack, type DesignLayer, type TextLayer } from "../../../core/creative/index.js";
import { FONT_STACKS } from "../../../core/schema/document.js";
import type { RasterMime } from "../../../core/media/photo.js";
import { I } from "../../components/Icons.js";
import { useToast } from "../../components/Toast.js";
import { StudioShell } from "../StudioShell.js";
import { LibraryPicker } from "../LibraryPicker.js";
import { bytesLabel } from "../LibraryPage.js";
import { useDesignEditor } from "./useDesignEditor.js";
import { libraryImageSource, renderDesign } from "./renderDesign.js";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const FONT_NAMES = Object.keys(FONT_STACKS) as (keyof typeof FONT_STACKS)[];
const mimeExt: Record<RasterMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function layerStyle(layer: DesignLayer): CSSProperties {
  const base: CSSProperties = { position: "absolute", left: layer.x, top: layer.y, width: layer.width, height: layer.height, transform: `rotate(${layer.rotation}deg)`, opacity: layer.opacity, display: layer.hidden ? "none" : undefined, boxSizing: "border-box" };
  if (layer.type === "rect") return { ...base, background: layer.fill, borderRadius: layer.radius, border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined };
  if (layer.type === "ellipse") return { ...base, background: layer.fill, borderRadius: "50%", border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined };
  if (layer.type === "text") return { ...base, color: layer.color, fontFamily: fontStack(layer.font), fontSize: layer.fontSize, fontWeight: layer.fontWeight, lineHeight: layer.lineHeight, textAlign: layer.align, whiteSpace: "pre-wrap", overflowWrap: "break-word", overflow: "hidden" };
  return { ...base, overflow: "hidden" };
}

function layerLabel(layer: DesignLayer): string {
  if (layer.name) return layer.name;
  if (layer.type === "text") return layer.text.split("\n")[0]?.slice(0, 24) || "Text";
  return { rect: "Rectangle", ellipse: "Ellipse", image: "Image", text: "Text" }[layer.type];
}

export function DesignEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const editor = useDesignEditor(projectId);
  const { project, doc, selectedId, saveState, error, canUndo, canRedo } = editor.state;
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [picker, setPicker] = useState<null | "new" | string>(null);
  const [exportMime, setExportMime] = useState<RasterMime>("image/png");
  const [quality, setQuality] = useState(90);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<{ url: string; size: number; mime: RasterMime } | null>(null);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [kitId, setKitId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [libraryNames, setLibraryNames] = useState<Record<string, LibraryAsset>>({});
  const selected = doc?.layers.find((l) => l.id === selectedId) ?? null;
  const kit = kits.find((k) => k.id === kitId) ?? null;
  const isTemplate = project?.kind === "design-template";

  useEffect(() => {
    api.brandKits().then((r) => setKits(r.kits)).catch(() => undefined);
    api.library().then((r) => setLibraryNames(Object.fromEntries(r.assets.map((a) => [a.id, a])))).catch(() => undefined);
  }, []);
  useEffect(() => () => { if (exported) URL.revokeObjectURL(exported.url); }, [exported]);

  // Fit the artboard to the stage.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || !doc) return;
    const fit = () => {
      const pad = 48;
      const s = Math.min((el.clientWidth - pad) / doc.width, (el.clientHeight - pad) / doc.height, 1);
      setScale(Math.max(0.05, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc?.width, doc?.height, !!doc]);

  // Keyboard: delete, nudge, undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) editor.redo(); else editor.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); editor.redo(); return; }
      if (!selected || selected.locked) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); editor.removeLayer(selected.id); return; }
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = nudge[e.key];
      if (d) { e.preventDefault(); editor.updateLayer(selected.id, { x: selected.x + d[0], y: selected.y + d[1] }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editor]);

  // Pointer drag: move or resize in design coordinates.
  const drag = useRef<{ id: string; mode: "move" | Handle; startX: number; startY: number; start: DesignLayer; moved: boolean } | null>(null);
  const beginDrag = (e: ReactPointerEvent, layer: DesignLayer, mode: "move" | Handle) => {
    if (layer.locked) { editor.select(layer.id); return; }
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    editor.select(layer.id);
    drag.current = { id: layer.id, mode, startX: e.clientX, startY: e.clientY, start: layer, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (!d.moved && Math.hypot(dx, dy) < 1) return;
    d.moved = true;
    const s = d.start;
    let { x, y, width, height } = s;
    if (d.mode === "move") { x = s.x + dx; y = s.y + dy; }
    else {
      const min = 8;
      if (d.mode.includes("e")) width = Math.max(min, s.width + dx);
      if (d.mode.includes("s")) height = Math.max(min, s.height + dy);
      if (d.mode.includes("w")) { width = Math.max(min, s.width - dx); x = s.x + (s.width - width); }
      if (d.mode.includes("n")) { height = Math.max(min, s.height - dy); y = s.y + (s.height - height); }
      if (e.shiftKey && s.type === "image") { const r = s.width / s.height; if (d.mode.length === 2) height = width / r; }
    }
    const snap = (v: number) => Math.round(v);
    editor.updateLayer(d.id, { x: snap(x), y: snap(y), width: snap(width), height: snap(height) }, false);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && doc) {
      // Record one undo step for the whole gesture: re-commit the current state over the pre-drag snapshot.
      const current = doc.layers.find((l) => l.id === d.id);
      if (current) {
        editor.commit({ ...doc, layers: doc.layers.map((l) => (l.id === d.id ? d.start : l)) }, false);
        editor.commit({ ...doc, layers: doc.layers.map((l) => (l.id === d.id ? current : l)) }, true);
      }
    }
  };

  const doExport = async () => {
    if (!doc) return;
    setExporting(true);
    try {
      await editor.saveNow();
      const blob = await renderDesign(doc, exportMime, exportMime === "image/png" ? 1 : quality / 100, libraryImageSource);
      if (exported) URL.revokeObjectURL(exported.url);
      setExported({ url: URL.createObjectURL(blob), size: blob.size, mime: exportMime });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const saveAsTemplate = async () => {
    const name = templateName.trim() || `${project?.name ?? "Design"} template`;
    try {
      const t = await editor.saveAs("design-template", name);
      toast(`Template "${t.name}" saved. Find it under Templates.`, "success");
      setTemplateName("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the template", "error");
    }
  };

  const applySwatch = (value: string) => {
    if (!selected) { editor.setBackground(value); return; }
    if (selected.type === "text") editor.updateLayer(selected.id, { color: value });
    else if (selected.type !== "image") editor.updateLayer(selected.id, { fill: value });
  };

  const stageInfo = useMemo(() => (doc ? `${doc.width} × ${doc.height}px · ${Math.round(scale * 100)}%` : ""), [doc, scale]);

  if (error && !doc) {
    return <StudioShell><main className="studio-main"><p className="form-error" role="alert">{error}</p><Link to="/studio/design" className="btn">Back to Design Studio</Link></main></StudioShell>;
  }

  return (
    <StudioShell>
      <main className="design-editor" aria-busy={!doc}>
        <header className="design-topbar">
          <Link to={isTemplate ? "/templates" : "/studio/design"} className="btn btn-ghost" aria-label="Back"><span aria-hidden="true">←</span> {isTemplate ? "Templates" : "Designs"}</Link>
          <input className="design-name" aria-label="Design name" value={project?.name ?? ""} maxLength={80} onChange={(e) => editor.rename(e.target.value)} disabled={!project} />
          {isTemplate && <span className="badge">Template</span>}
          <span className={`save-state design-save`} data-state={saveState} role="status">
            {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "conflict" ? "Out of date" : "Not saved"}
          </span>
          <div className="design-topbar-actions">
            <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={editor.undo}><I.undo /></button>
            <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={editor.redo}><I.redo /></button>
            <span className="design-divider" aria-hidden="true" />
            <button className="btn btn-sm" disabled={!doc} onClick={() => editor.addLayer("text")}><I.text /> Text</button>
            <button className="btn btn-sm" disabled={!doc} onClick={() => editor.addLayer("rect")}>Rectangle</button>
            <button className="btn btn-sm" disabled={!doc} onClick={() => editor.addLayer("ellipse")}>Ellipse</button>
            <button className="btn btn-sm" disabled={!doc} onClick={() => setPicker("new")}><I.image /> Image</button>
          </div>
        </header>
        {error && doc && (
          <div className="design-banner" role="alert">
            <span>{error}</span>
            {saveState === "conflict" ? <button className="btn btn-sm" onClick={() => void editor.reloadFromServer()}>Reload latest copy</button> : <button className="btn btn-sm btn-ghost" onClick={editor.clearError}>Dismiss</button>}
          </div>
        )}
        <div className="design-body">
          <aside className="design-layers" aria-label="Layers">
            <h2 className="photo-panel-title">Layers <small>{doc?.layers.length ?? 0} / {DESIGN_LIMITS.maxLayers}</small></h2>
            {doc && doc.layers.length === 0 && <p className="photo-status">Add text, a shape or an image to begin.</p>}
            <ul className="layer-list">
              {doc && [...doc.layers].reverse().map((layer) => (
                <li key={layer.id} className={`layer-row${layer.id === selectedId ? " selected" : ""}`}>
                  <button type="button" className="layer-name" onClick={() => editor.select(layer.id)} aria-pressed={layer.id === selectedId}>
                    <span className="layer-type">{layer.type === "text" ? "T" : layer.type === "image" ? "▣" : layer.type === "rect" ? "▭" : "◯"}</span>
                    {layerLabel(layer)}{layer.locked ? " · locked" : ""}{layer.hidden ? " · hidden" : ""}
                  </button>
                  <button type="button" className="icon-btn" aria-label={`${layer.hidden ? "Show" : "Hide"} ${layerLabel(layer)}`} onClick={() => editor.updateLayer(layer.id, { hidden: !layer.hidden })}>{layer.hidden ? <I.eyeOff /> : <I.eye />}</button>
                  <button type="button" className="icon-btn" aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layerLabel(layer)}`} onClick={() => editor.updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <I.lock /> : <I.unlock />}</button>
                </li>
              ))}
            </ul>
            <div className="photo-panel-section">
              <label className="photo-field">Background<input type="color" aria-label="Background colour" value={/^#[0-9a-f]{6}$/i.test(doc?.background ?? "") ? doc!.background : "#ffffff"} onChange={(e) => editor.setBackground(e.target.value)} disabled={!doc} /></label>
              <label className="photo-toggle" style={{ marginTop: 8 }}><input type="checkbox" checked={doc?.background === "transparent"} onChange={(e) => editor.setBackground(e.target.checked ? "transparent" : "#ffffff")} disabled={!doc} /> Transparent background (PNG only)</label>
            </div>
            <div className="photo-panel-section">
              <h3 className="photo-panel-title">Brand kit</h3>
              <select aria-label="Brand kit" value={kitId} onChange={(e) => setKitId(e.target.value)}><option value="">None</option>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
              {kit && (
                <>
                  <div className="swatch-row" role="group" aria-label="Brand colours">
                    {kit.document.colors.map((c) => <button key={c.name} type="button" className="swatch" style={{ background: c.value }} title={`${c.name} ${c.value}`} aria-label={`Apply ${c.name}`} onClick={() => applySwatch(c.value)} />)}
                  </div>
                  <p className="small muted">Click a colour to apply it to the selected layer{selected ? "" : " (or the background)"}.</p>
                  {selected?.type === "text" && <div className="photo-actions"><button className="btn btn-sm" onClick={() => editor.updateLayer(selected.id, { font: kit.document.fonts.heading })}>Heading font</button><button className="btn btn-sm" onClick={() => editor.updateLayer(selected.id, { font: kit.document.fonts.body })}>Body font</button></div>}
                </>
              )}
              {kits.length === 0 && <p className="small muted">No brand kits yet. <Link to="/brand-kits">Create one</Link>.</p>}
            </div>
          </aside>

          <div className="design-stage" ref={stageRef} onPointerDown={() => editor.select(null)} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {!doc && <p className="muted" role="status">Loading design…</p>}
            {doc && (
              <div className="design-artboard-wrap" style={{ width: doc.width * scale, height: doc.height * scale }}>
                <div className="design-artboard" style={{ width: doc.width, height: doc.height, transform: `scale(${scale})`, background: doc.background === "transparent" ? undefined : doc.background }} data-transparent={doc.background === "transparent" || undefined}>
                  {doc.layers.map((layer) => (
                    <div key={layer.id} className={`design-layer${layer.id === selectedId ? " selected" : ""}${layer.locked ? " locked" : ""}`} style={layerStyle(layer)} onPointerDown={(e) => beginDrag(e, layer, "move")} data-layer-id={layer.id} role="button" tabIndex={0} aria-label={layerLabel(layer)} onKeyDown={(e) => { if (e.key === "Enter") editor.select(layer.id); }}>
                      {layer.type === "text" && layer.text}
                      {layer.type === "image" && <img src={`/api/library/${layer.assetId}/file`} alt={layer.alt} draggable={false} style={{ width: "100%", height: "100%", objectFit: layer.fit, display: "block" }} />}
                    </div>
                  ))}
                  {selected && !selected.hidden && (
                    <div className="design-selection" style={{ left: selected.x, top: selected.y, width: selected.width, height: selected.height, transform: `rotate(${selected.rotation}deg)` }} aria-hidden="true">
                      {!selected.locked && HANDLES.map((h) => <span key={h} className={`design-handle h-${h}`} style={{ transform: `scale(${1 / scale})` }} onPointerDown={(e) => beginDrag(e, selected, h)} />)}
                    </div>
                  )}
                </div>
              </div>
            )}
            <span className="design-stage-info small muted">{stageInfo}</span>
          </div>

          <aside className="design-props" aria-label="Properties">
            {!selected && doc && (
              <div className="photo-panel-section">
                <h2 className="photo-panel-title">Design</h2>
                <div className="photo-input-grid">
                  <label className="photo-field">Width<input type="number" min={DESIGN_LIMITS.minEdge} max={DESIGN_LIMITS.maxEdge} value={doc.width} onChange={(e) => editor.resize(Number(e.target.value), doc.height)} /></label>
                  <label className="photo-field">Height<input type="number" min={DESIGN_LIMITS.minEdge} max={DESIGN_LIMITS.maxEdge} value={doc.height} onChange={(e) => editor.resize(doc.width, Number(e.target.value))} /></label>
                </div>
                <p className="small muted">Select a layer on the canvas or in the list to edit it. Drag to move, pull a handle to resize, arrow keys to nudge.</p>
              </div>
            )}
            {selected && (
              <>
                <div className="photo-panel-section">
                  <h2 className="photo-panel-title">{layerLabel(selected)} <small>{selected.type}</small></h2>
                  <label className="photo-field">Name<input value={selected.name} maxLength={60} onChange={(e) => editor.updateLayer(selected.id, { name: e.target.value })} /></label>
                  <div className="photo-input-grid" style={{ marginTop: 8 }}>
                    <label className="photo-field">X<input type="number" value={Math.round(selected.x)} onChange={(e) => editor.updateLayer(selected.id, { x: Number(e.target.value) })} /></label>
                    <label className="photo-field">Y<input type="number" value={Math.round(selected.y)} onChange={(e) => editor.updateLayer(selected.id, { y: Number(e.target.value) })} /></label>
                    <label className="photo-field">Width<input type="number" min={1} value={Math.round(selected.width)} onChange={(e) => editor.updateLayer(selected.id, { width: Number(e.target.value) })} /></label>
                    <label className="photo-field">Height<input type="number" min={1} value={Math.round(selected.height)} onChange={(e) => editor.updateLayer(selected.id, { height: Number(e.target.value) })} /></label>
                    <label className="photo-field">Rotation°<input type="number" min={-360} max={360} value={selected.rotation} onChange={(e) => editor.updateLayer(selected.id, { rotation: Number(e.target.value) })} /></label>
                    <label className="photo-field">Opacity %<input type="number" min={0} max={100} value={Math.round(selected.opacity * 100)} onChange={(e) => editor.updateLayer(selected.id, { opacity: Number(e.target.value) / 100 })} /></label>
                  </div>
                  <div className="photo-actions" style={{ marginTop: 10 }}>
                    <button className="btn btn-sm" onClick={() => editor.moveLayer(selected.id, 1)} title="Bring forward">Forward</button>
                    <button className="btn btn-sm" onClick={() => editor.moveLayer(selected.id, -1)} title="Send backward">Backward</button>
                    <button className="btn btn-sm" onClick={() => editor.duplicateLayer(selected.id)}>Duplicate</button>
                    <button className="btn btn-sm btn-danger-text" onClick={() => editor.removeLayer(selected.id)}>Delete</button>
                  </div>
                </div>
                {selected.type === "text" && (
                  <div className="photo-panel-section">
                    <h3 className="photo-panel-title">Text</h3>
                    <label className="photo-field">Content<textarea rows={4} maxLength={DESIGN_LIMITS.maxTextLength} value={selected.text} onChange={(e) => editor.updateLayer(selected.id, { text: e.target.value })} /></label>
                    <div className="photo-input-grid" style={{ marginTop: 8 }}>
                      <label className="photo-field photo-field-wide">Font<select value={selected.font} onChange={(e) => editor.updateLayer(selected.id, { font: e.target.value as TextLayer["font"] })}>{FONT_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
                      <label className="photo-field">Size<input type="number" min={6} max={600} value={selected.fontSize} onChange={(e) => editor.updateLayer(selected.id, { fontSize: Number(e.target.value) })} /></label>
                      <label className="photo-field">Weight<select value={selected.fontWeight} onChange={(e) => editor.updateLayer(selected.id, { fontWeight: Number(e.target.value) as TextLayer["fontWeight"] })}>{[400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
                      <label className="photo-field">Line height<input type="number" step={0.1} min={0.8} max={3} value={selected.lineHeight} onChange={(e) => editor.updateLayer(selected.id, { lineHeight: Number(e.target.value) })} /></label>
                      <label className="photo-field">Align<select value={selected.align} onChange={(e) => editor.updateLayer(selected.id, { align: e.target.value as TextLayer["align"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
                      <label className="photo-field">Colour<input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : "#111111"} onChange={(e) => editor.updateLayer(selected.id, { color: e.target.value })} /></label>
                    </div>
                  </div>
                )}
                {(selected.type === "rect" || selected.type === "ellipse") && (
                  <div className="photo-panel-section">
                    <h3 className="photo-panel-title">Shape</h3>
                    <div className="photo-input-grid">
                      <label className="photo-field">Fill<input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.fill) ? selected.fill : "#1f6f4a"} onChange={(e) => editor.updateLayer(selected.id, { fill: e.target.value })} /></label>
                      <label className="photo-field">Stroke<input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.stroke) ? selected.stroke : "#000000"} onChange={(e) => editor.updateLayer(selected.id, { stroke: e.target.value })} /></label>
                      <label className="photo-field">Stroke width<input type="number" min={0} max={64} value={selected.strokeWidth} onChange={(e) => editor.updateLayer(selected.id, { strokeWidth: Number(e.target.value) })} /></label>
                      {selected.type === "rect" && <label className="photo-field">Corner radius<input type="number" min={0} max={1000} value={selected.radius} onChange={(e) => editor.updateLayer(selected.id, { radius: Number(e.target.value) })} /></label>}
                    </div>
                  </div>
                )}
                {selected.type === "image" && (
                  <div className="photo-panel-section">
                    <h3 className="photo-panel-title">Image</h3>
                    <p className="small muted">{libraryNames[selected.assetId]?.filename ?? "From your asset library"}</p>
                    <div className="photo-input-grid">
                      <label className="photo-field">Fit<select value={selected.fit} onChange={(e) => editor.updateLayer(selected.id, { fit: e.target.value as "cover" | "contain" })}><option value="cover">Cover (crop)</option><option value="contain">Contain (letterbox)</option></select></label>
                      <label className="photo-field">Alt text<input value={selected.alt} maxLength={200} onChange={(e) => editor.updateLayer(selected.id, { alt: e.target.value })} /></label>
                    </div>
                    <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setPicker(selected.id)}>Replace image</button>
                  </div>
                )}
              </>
            )}
            <div className="photo-panel-section">
              <h3 className="photo-panel-title">Export</h3>
              <div className="photo-input-grid">
                <label className="photo-field photo-field-wide">Format<select aria-label="Export format" value={exportMime} onChange={(e) => setExportMime(e.target.value as RasterMime)}><option value="image/png">PNG · lossless</option><option value="image/jpeg">JPEG · lossy</option></select></label>
                {exportMime === "image/jpeg" && <label className="photo-field photo-field-wide">Quality · {quality}<input aria-label="Export quality" type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>}
              </div>
              <div className="photo-actions" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" disabled={!doc || exporting} onClick={() => void doExport()}>{exporting ? "Rendering…" : "Export design"}</button>
                {exported && <a className="btn" href={exported.url} download={`${(project?.name ?? "design").replace(/[^a-z0-9_-]/gi, "-")}.${mimeExt[exported.mime]}`}>Download {mimeExt[exported.mime].toUpperCase()}</a>}
              </div>
              {exported && <p className="photo-export-result" role="status"><strong>{bytesLabel(exported.size)} · {doc?.width} × {doc?.height}px</strong> Verified from the encoded bytes. Text is rendered with the fonts available in this browser.</p>}
            </div>
            {!isTemplate && (
              <div className="photo-panel-section">
                <h3 className="photo-panel-title">Save as template</h3>
                <div className="photo-save-row">
                  <input aria-label="Template name" placeholder={`${project?.name ?? "Design"} template`} value={templateName} maxLength={80} onChange={(e) => setTemplateName(e.target.value)} />
                  <button className="btn btn-sm" disabled={!doc} onClick={() => void saveAsTemplate()}>Save</button>
                </div>
                <p className="small muted">Templates stay editable and start new designs with a copy of these layers.</p>
              </div>
            )}
            {isTemplate && (
              <div className="photo-panel-section">
                <button className="btn btn-primary" onClick={() => void editor.saveAs("design", `${project?.name ?? "Design"}`).then((p) => navigate(`/studio/design/${p.id}`)).catch((e) => toast(e instanceof Error ? e.message : "Could not create a design", "error"))}>New design from this template</button>
              </div>
            )}
          </aside>
        </div>
      </main>
      {picker && (
        <LibraryPicker
          title={picker === "new" ? "Add an image" : "Replace image"}
          onClose={() => setPicker(null)}
          onPick={(asset) => {
            if (picker === "new") editor.addLayer("image", { assetId: asset.id, alt: asset.alt, name: asset.filename });
            else editor.updateLayer(picker, { assetId: asset.id, alt: asset.alt } as Partial<DesignLayer>);
            setLibraryNames((m) => ({ ...m, [asset.id]: asset }));
            setPicker(null);
          }}
        />
      )}
    </StudioShell>
  );
}
