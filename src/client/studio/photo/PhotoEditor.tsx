import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PhotoRecipe, type RasterMime } from "../../../core/media/photo.js";
import { I } from "../../components/Icons.js";
import { usePhotoStudio } from "./usePhotoStudio.js";
import type { PhotoDocument } from "./types.js";
import { StudioShell } from "../StudioShell.js";

type PhotoEditorProps = { mode?: "photo" | "compress" };
const MAX_OUTPUT = 4096;
const MAX_PIXELS = 16_000_000;
const bytesLabel = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const mimeExtension: Record<RasterMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const mimeName: Record<RasterMime, string> = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };

function NumberField({ label, value, min = 1, max, disabled = false, onCommit }: { label: string; value: number; min?: number; max: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="photo-field">{label}<input type="number" min={min} max={max} disabled={disabled} value={draft} onChange={(event) => {
    const nextText = event.target.value;
    setDraft(nextText);
    if (nextText === "") return;
    const next = Number(nextText);
    if (Number.isInteger(next) && next >= min && next <= max) onCommit(next);
  }} onBlur={() => { const next = Number(draft); if (!Number.isInteger(next) || next < min || next > max) setDraft(String(value)); }} /></label>;
}

function Section({ title, children, detail }: { title: string; children: ReactNode; detail?: string }) {
  return <section className="photo-panel-section"><h2 className="photo-panel-title">{title}{detail && <small>{detail}</small>}</h2>{children}</section>;
}

export function PhotoEditor({ mode = "photo" }: PhotoEditorProps) {
  const studio = usePhotoStudio();
  const { document, recipe, projects, sites, previewUrl, originalUrl, busy, error, status, exported, canUndo, canRedo } = studio;
  const fileInput = useRef<HTMLInputElement>(null);
  const [compare, setCompare] = useState(false);
  const [aspectLock, setAspectLock] = useState(false);
  const [aspect, setAspect] = useState(1);
  const [draftName, setDraftName] = useState("");
  const [mime, setMime] = useState<RasterMime>("image/jpeg");
  const [quality, setQuality] = useState(82);
  const [siteId, setSiteId] = useState("");
  const [localError, setLocalError] = useState("");
  const toolTitle = mode === "compress" ? "Image Compressor" : "Photo Editor";
  const safeRecipe = recipe ? PhotoRecipe.safeParse(recipe).success ? recipe : null : null;
  const currentUrl = compare ? originalUrl : previewUrl;
  const sourceMime = document?.info.mimeType || null;
  const expectedSize = document?.source.size || 0;
  const currentRatio = safeRecipe ? safeRecipe.width / safeRecipe.height : 1;
  const dimensionSummary = safeRecipe ? `${safeRecipe.width} × ${safeRecipe.height}` : "";
  const exportSaving = exported ? exported.savingsPercent : 0;
  const exportStatus = exported ? (exportSaving >= 0 ? `${exportSaving.toFixed(1)}% smaller` : `${Math.abs(exportSaving).toFixed(1)}% larger`) : "";
  const projectCount = projects.length;
  const sourceDescription = useMemo(() => document ? `${document.info.width} × ${document.info.height} · ${mimeName[document.info.mimeType]} · ${bytesLabel(expectedSize)}` : "", [document, expectedSize]);

  const changeRecipe = (patch: Partial<NonNullable<typeof recipe>>) => {
    setLocalError("");
    studio.updateRecipe(patch);
  };
  const setCropValue = (key: "x" | "y" | "width" | "height", value: number) => {
    if (!document || !safeRecipe) return;
    const crop = { ...safeRecipe.crop, [key]: value };
    crop.x = Math.min(crop.x, document.info.width - 1);
    crop.y = Math.min(crop.y, document.info.height - 1);
    crop.width = Math.min(crop.width, document.info.width - crop.x);
    crop.height = Math.min(crop.height, document.info.height - crop.y);
    changeRecipe({ crop });
  };
  const setOutputDimension = (key: "width" | "height", value: number) => {
    if (!safeRecipe) return;
    const otherKey = key === "width" ? "height" : "width";
    const nextOther = aspectLock ? Math.max(1, Math.min(MAX_OUTPUT, Math.round(key === "width" ? value / aspect : value * aspect))) : safeRecipe[otherKey];
    if (value * nextOther > MAX_PIXELS) {
      setLocalError("Output dimensions exceed the 16 megapixel export limit.");
      return;
    }
    setLocalError("");
    changeRecipe({ [key]: value, ...(aspectLock ? { [otherKey]: nextOther } : {}) });
  };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLocalError("");
      setCompare(false);
      try { await studio.loadFile(file); } catch { /* Hook owns errors and status. */ }
    }
    event.target.value = "";
  };
  const doExport = async () => {
    setLocalError("");
    try { await studio.exportImage(mime, mime === "image/png" ? 1 : quality / 100); } catch { /* Hook owns errors and status. */ }
  };
  const saveDraft = async () => {
    const name = draftName.trim();
    if (!name) { setLocalError("Give this browser-local draft a name first."); return; }
    setLocalError("");
    await studio.saveDraft(name);
    setDraftName("");
  };
  const removeDraft = async (project: PhotoDocument | (typeof projects)[number]) => {
    if (window.confirm(`Delete “${project.name}” from this browser? This cannot be undone.`)) await studio.deleteDraft(project.id);
  };
  const saveWebsiteAsset = async () => {
    if (!siteId) { setLocalError("Choose one of your websites before saving this export."); return; }
    if (!exported) { setLocalError("Export the edited image first."); return; }
    if (!window.confirm("This will add the exported image to the selected website's PUBLIC media. It is not a private file. Continue?")) return;
    setLocalError("");
    await studio.saveToWebsite(siteId);
  };

  return (
    <StudioShell>
      <main className="studio-main photo-workspace">
        <div className="photo-topline">
          <div><span className="studio-eyebrow">{mode === "compress" ? "Format and file size" : "Local image workspace"}</span><h1>{toolTitle}</h1><p>{mode === "compress" ? "Export a smaller or differently encoded raster image and inspect the real result." : "Prepare a reusable image without changing your source file."}</p></div>
          <div className="photo-actions">
            <Link className="btn btn-ghost" to="/"><span aria-hidden="true">←</span> Studio</Link>
            <label className="btn btn-primary photo-drop-label" htmlFor="photo-file"><I.plus /> Choose image</label>
            <input ref={fileInput} className="photo-file-input" id="photo-file" type="file" disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseFile(event)} aria-label="Choose a PNG, JPEG or static WebP image" />
          </div>
        </div>
        <div className="photo-layout">
          <section className="photo-preview-card" aria-label="Image preview">
            <div className="photo-preview-head">
              <strong>{document?.name || "Preview"}</strong>
              <button className={`btn btn-sm${compare ? " btn-primary" : ""}`} type="button" disabled={!document || !originalUrl} aria-pressed={compare} onClick={() => setCompare((value) => !value)}>{compare ? "Viewing original" : "Compare original"}</button>
            </div>
            <div className="photo-stage">
              {currentUrl ? <img src={currentUrl} alt={`${compare ? "Original" : "Edited"} preview of ${document?.name || "image"}`} /> : (
                <div className="photo-empty">
                  <span className="photo-empty-mark" aria-hidden="true"><I.image /></span>
                  <h2>Bring an image into your workspace</h2>
                  <p>Choose a PNG, JPEG or static WebP file to crop, resize and prepare an export. Your original stays unchanged.</p>
                  <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>Select a local image</button>
                </div>
              )}
            </div>
            {document && <div className="photo-meta"><span>Original {sourceDescription}</span>{dimensionSummary && <span>Output {dimensionSummary}px</span>}</div>}
          </section>
          <aside>
            <div className="photo-controls" aria-label={`${toolTitle} controls`}>
              <Section title="History" detail={document ? `rev ${document.revision}` : undefined}>
                <div className="photo-actions">
                  <button className="btn btn-sm" type="button" disabled={!canUndo || busy} onClick={studio.undo}>Undo</button>
                  <button className="btn btn-sm" type="button" disabled={!canRedo || busy} onClick={studio.redo}>Redo</button>
                  <button className="btn btn-sm" type="button" disabled={!document || busy} onClick={() => { studio.reset(); setLocalError(""); }}>Reset</button>
                </div>
                <p className="photo-status" role="status">{status || (busy ? "Working…" : "Source image remains unchanged.")}</p>
              </Section>
              <Section title="Crop · original coordinates" detail={document ? `${document.info.width} × ${document.info.height}` : "Load an image"}>
                <div className="photo-input-grid">
                  <NumberField label="Left (x)" min={0} max={document?.info.width || 1} disabled={!document || busy} value={safeRecipe?.crop.x || 0} onCommit={(value) => setCropValue("x", value)} />
                  <NumberField label="Top (y)" min={0} max={document?.info.height || 1} disabled={!document || busy} value={safeRecipe?.crop.y || 0} onCommit={(value) => setCropValue("y", value)} />
                  <NumberField label="Crop width" max={document?.info.width || 1} disabled={!document || busy} value={safeRecipe?.crop.width || 1} onCommit={(value) => setCropValue("width", value)} />
                  <NumberField label="Crop height" max={document?.info.height || 1} disabled={!document || busy} value={safeRecipe?.crop.height || 1} onCommit={(value) => setCropValue("height", value)} />
                </div>
              </Section>
              <Section title="Output dimensions" detail="up to 4096 px / 16 MP">
                <div className="photo-input-grid">
                  <NumberField label="Width" max={MAX_OUTPUT} disabled={!document || busy} value={safeRecipe?.width || 1} onCommit={(value) => setOutputDimension("width", value)} />
                  <NumberField label="Height" max={MAX_OUTPUT} disabled={!document || busy} value={safeRecipe?.height || 1} onCommit={(value) => setOutputDimension("height", value)} />
                </div>
                <div className="photo-toggle-row">
                  <label className="photo-toggle"><input type="checkbox" checked={aspectLock} onChange={(event) => { setAspectLock(event.target.checked); if (event.target.checked && safeRecipe) setAspect(safeRecipe.width / safeRecipe.height); }} /> Lock aspect ratio</label>
                  {safeRecipe && <span className="small muted">{currentRatio.toFixed(3)} : 1</span>}
                </div>
              </Section>
              <Section title="Orientation">
                <div className="photo-actions">
                  {[0, 90, 180, 270].map((rotation) => <button key={rotation} type="button" className={`btn btn-sm${safeRecipe?.rotation === rotation ? " btn-primary" : ""}`} aria-pressed={safeRecipe?.rotation === rotation} disabled={!document || busy} onClick={() => changeRecipe({ rotation: rotation as 0 | 90 | 180 | 270 })}>{rotation}°</button>)}
                </div>
                <div className="photo-toggle-row">
                  <label className="photo-toggle"><input type="checkbox" checked={safeRecipe?.flipX || false} disabled={!document} onChange={(event) => changeRecipe({ flipX: event.target.checked })} /> Flip horizontal</label>
                  <label className="photo-toggle"><input type="checkbox" checked={safeRecipe?.flipY || false} disabled={!document} onChange={(event) => changeRecipe({ flipY: event.target.checked })} /> Flip vertical</label>
                </div>
              </Section>
              <Section title="Adjustments" detail="neutral at 100%">
                {(["brightness", "contrast", "saturation"] as const).map((key) => (
                  <div className="photo-adjustment" key={key}>
                    <label htmlFor={`photo-${key}`}>{key[0]!.toUpperCase() + key.slice(1)}<input id={`photo-${key}`} type="range" min="0" max="200" value={safeRecipe?.[key] ?? 100} disabled={!document || busy} onChange={(event) => changeRecipe({ [key]: Number(event.target.value) })} /></label>
                    <output htmlFor={`photo-${key}`}>{safeRecipe?.[key] ?? 100}%</output>
                  </div>
                ))}
              </Section>
              <Section title="Export" detail={document ? `${bytesLabel(expectedSize)} source` : undefined}>
                <div className="photo-input-grid">
                  <label className="photo-field photo-field-wide">Format<select aria-label="Export format" value={mime} disabled={!document || busy} onChange={(event) => setMime(event.target.value as RasterMime)}>
                    <option value="image/png">PNG · lossless</option><option value="image/jpeg">JPEG · lossy</option><option value="image/webp">WebP · lossy</option>
                  </select></label>
                  {mime !== "image/png" && <label className="photo-field photo-field-wide">Quality · {quality}<input aria-label="Export quality" type="range" min="10" max="100" value={quality} disabled={!document || busy} onChange={(event) => setQuality(Number(event.target.value))} /></label>}
                </div>
                {mime === "image/jpeg" && <p className="photo-jpeg-note">JPEG has no transparency. Transparent areas are composited onto white.</p>}
                <div className="photo-actions" style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary" disabled={!document || busy || !safeRecipe} onClick={() => void doExport()}>{busy ? "Preparing…" : "Export image"}</button>
                  {exported && <a className="btn" href={exported.url} download={`${(document?.name || "binhi-image").replace(/\.[^.]+$/, "")}.${mimeExtension[exported.mimeType]}`}>Download {mimeExtension[exported.mimeType].toUpperCase()}</a>}
                </div>
                {exported && <div className="photo-export-result" role="status"><strong>{bytesLabel(exported.byteSize)} · {exported.width} × {exported.height}px</strong><p>{exportStatus} against the original file ({bytesLabel(expectedSize)}). The figure reflects actual exported bytes.</p></div>}
                {exported && sites.length > 0 && <>
                  <label className="photo-field photo-website-select">Save this export to one of your websites<select aria-label="Destination website" value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">Choose a website…</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
                  <p className="photo-jpeg-note">This adds the export to PUBLIC website media, not private storage. No original is uploaded automatically.</p>
                  <button type="button" className="btn btn-sm" disabled={busy || !siteId} onClick={() => void saveWebsiteAsset()}>Save export to website</button>
                </>}
              </Section>
              <Section title="Browser-local drafts" detail={`${projectCount} saved`}>
                <div className="photo-save-row">
                  <input type="text" aria-label="Draft name" placeholder="Name this draft" value={draftName} maxLength={100} onChange={(event) => setDraftName(event.target.value)} disabled={!document || busy} />
                  <button type="button" className="btn btn-sm" disabled={!document || busy || !draftName.trim()} onClick={() => void saveDraft()}>Save</button>
                </div>
                {projects.length === 0 ? <p className="photo-status">No saved drafts in this browser yet.</p> : <ul className="photo-project-list" aria-label="Saved browser-local drafts">
                  {projects.map((project) => <li className="photo-project-row" key={project.id}>
                    <button type="button" className="photo-project-name btn btn-ghost" title={`Open ${project.name}`} onClick={() => void studio.openDraft(project.id)} disabled={busy}>{project.name}</button>
                    <span className="photo-project-date">{dateLabel(project.updatedAt)}</span>
                    <button type="button" className="icon-btn" aria-label={`Delete draft ${project.name}`} title="Delete draft" disabled={busy} onClick={() => void removeDraft(project)}><I.trash /></button>
                  </li>)}
                </ul>}
              </Section>
            </div>
            <p className="photo-limit-note" style={{ marginTop: 10 }}>Privacy: files and drafts stay in this browser/device; they are not cloud backups. Supported input is static PNG, JPEG or WebP, up to 8 MiB and 16 MP. SVG, GIF, HEIC, PDF and Office files are not supported. Export is limited to 4096 px per edge and 16 MP.</p>
            {(localError || error) && <p className="photo-error" role="alert">{localError || error}</p>}
            {!error && status && <p className="photo-status" role="status">{status}</p>}
          </aside>
        </div>
      </main>
    </StudioShell>
  );
}
