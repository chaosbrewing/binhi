import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type TemplateCard, type TemplateDetail } from "../api.js";
import { Modal } from "../components/Modal.js";
import { I } from "../components/Icons.js";
import { useToast } from "../components/Toast.js";
import { renderDesign } from "../studio/design/renderDesign.js";
import { formatLabel, outputLabel, sizeLabel } from "./labels.js";

const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1200 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
] as const;

/**
 * Enlarged preview. Designs are drawn by the same renderer that exports them,
 * from the template's real document; websites are the real renderer's output
 * inside a script-free sandboxed frame. Nothing here is a promotional image.
 */
export function TemplatePreview({ card, favorite, onToggleFavorite, onUsed, onClose }: { card: TemplateCard; favorite: boolean; onToggleFavorite: (card: TemplateCard) => void; onUsed: (card: TemplateCard) => void; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(card.name);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const stage = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(560);

  useEffect(() => {
    let alive = true;
    api.templateDetail(card.id).then((r) => alive && setDetail(r.template)).catch((e) => alive && setError(e instanceof ApiError ? e.message : "Could not load this template"));
    return () => { alive = false; };
  }, [card.id]);

  useEffect(() => {
    if (card.editor !== "design") return;
    let alive = true;
    let url: string | null = null;
    api.templateDocument(card.id)
      .then(({ document }) => renderDesign(document, "image/png", 1, () => Promise.reject(new Error("Templates do not contain private images"))))
      .then((blob) => { if (alive) { url = URL.createObjectURL(blob); setImage(url); } })
      .catch(() => alive && setError("The preview could not be drawn in this browser."));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [card.id, card.editor]);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setStageWidth(el.clientWidth));
    ro.observe(el);
    setStageWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const { result } = await api.useTemplate(card.id, name.trim() || undefined);
      onUsed(card);
      toast(`Created “${name.trim() || card.name}”`, "success");
      navigate(result.path);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the project", "error");
      setBusy(false);
    }
  };

  const scale = Math.min(1, stageWidth / device.width);
  const assetNote = detail
    ? detail.dependencies.bundledAssets.length + detail.dependencies.icons.length + detail.dependencies.elements.length === 0
      ? "No uploads needed. Add your own photos from your Asset Library when you want them."
      : "Uses graphics that ship with BINHI."
    : "";

  return (
    <Modal wide title={card.name} onClose={onClose}>
      <div className="tpl-preview">
        <div className="tpl-preview-stage" ref={stage}>
          {card.editor === "design" && (image ? <img src={image} alt={`${card.name} preview`} className="tpl-preview-img" style={{ aspectRatio: card.size.kind === "fixed" ? `${card.size.width} / ${card.size.height}` : undefined }} /> : error ? null : <p className="muted" role="status">Drawing preview…</p>)}
          {card.editor === "website" && (
            <>
              <div className="tpl-device" role="group" aria-label="Preview size">
                {DEVICES.map((d) => (
                  <button key={d.id} type="button" className="btn btn-sm" aria-pressed={device.id === d.id} onClick={() => setDevice(d)}>
                    {d.id === "desktop" ? <I.desktop /> : d.id === "tablet" ? <I.tablet /> : <I.mobile />} {d.label}
                  </button>
                ))}
              </div>
              <div className="tpl-frame" style={{ height: 520 * scale + 2 }}>
                <iframe title={`${card.name} website preview at ${device.label} width`} sandbox="" src={`/api/template-library/templates/${encodeURIComponent(card.id)}/preview/`} style={{ width: device.width, height: 520, transform: `scale(${scale})` }} />
              </div>
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <div className="tpl-preview-side">
          <p>{card.description}</p>
          <dl className="tpl-facts">
            <div><dt>Format</dt><dd>{formatLabel(card.format)}</dd></div>
            <div><dt>Size</dt><dd>{sizeLabel(card.size)}</dd></div>
            <div><dt>Opens in</dt><dd>{card.editorLabel}</dd></div>
            <div><dt>Output</dt><dd>{outputLabel(card.outputs)}</dd></div>
            <div><dt>Category</dt><dd>{card.categoryName}{card.subcategoryName ? ` · ${card.subcategoryName}` : ""}</dd></div>
            {detail && detail.dependencies.fonts.length > 0 && <div><dt>Fonts</dt><dd>{detail.dependencies.fonts.join(", ")}. Shown with the fonts installed on your device.</dd></div>}
            {detail && <div><dt>Assets</dt><dd>{assetNote}</dd></div>}
            {detail && <div><dt>Made by</dt><dd>{detail.license.id === "binhi-original" ? "BINHI original, free to use in your own projects" : "You"}{detail.license.notes ? `. ${detail.license.notes}` : ""}</dd></div>}
          </dl>

          <p className="small muted">Creating a template project makes your own copy. Changing it never changes the template.</p>
          <label className="field-block">Name your project<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <div className="tpl-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !card.usable || !name.trim()} onClick={() => void create()}>{busy ? "Creating…" : "Create from template"}</button>
            <button type="button" className={`btn${favorite ? " is-on" : ""}`} aria-pressed={favorite} onClick={() => onToggleFavorite(card)}><I.star fill={favorite ? "currentColor" : "none"} /> {favorite ? "Favorited" : "Favorite"}</button>
          </div>
          {!card.usable && <p className="form-error" role="alert">{card.reasons.join(" ")}</p>}
        </div>
      </div>
    </Modal>
  );
}
