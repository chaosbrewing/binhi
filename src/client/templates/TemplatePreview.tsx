import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type BrandBindings, type BrandKit, type TemplateCard, type TemplateDetail } from "../api.js";
import { Modal } from "../components/Modal.js";
import { I } from "../components/Icons.js";
import { useToast } from "../components/Toast.js";
import { libraryImageSource, renderDesign } from "../studio/design/renderDesign.js";
import { applyBrandKitToDesign, type BrandApplication } from "../../core/templates/library/brand.js";
import type { DesignDocument } from "../../core/creative/index.js";
import { formatLabel, outputLabel, sizeLabel } from "./labels.js";

const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1200 },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
] as const;

const noImages = () => Promise.reject(new Error("Templates do not contain private images"));

/**
 * Enlarged preview. Designs are drawn by the same renderer that exports them,
 * from the template's real document; websites are the real renderer's output
 * inside a script-free sandboxed frame. A Brand Kit can be previewed with the
 * exact rules the server applies when the project is created. Nothing here is
 * a promotional image, and nothing is saved until Create is chosen.
 */
export function TemplatePreview({ card, favorite, onToggleFavorite, onUsed, onClose }: { card: TemplateCard; favorite: boolean; onToggleFavorite: (card: TemplateCard) => void; onUsed: (card: TemplateCard) => void; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(card.name);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState<{ document: DesignDocument; brand: BrandBindings } | null>(null);
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [kitId, setKitId] = useState("");
  const [showKit, setShowKit] = useState(true);
  const [image, setImage] = useState<{ url: string; kitName: string | null } | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const stage = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(560);

  const kit = kits?.find((k) => k.id === kitId) ?? null;

  useEffect(() => {
    let alive = true;
    api.templateDetail(card.id).then((r) => alive && setDetail(r.template)).catch((e) => alive && setError(e instanceof ApiError ? e.message : "Could not load this template"));
    api.brandKits().then((r) => alive && setKits(r.kits)).catch(() => alive && setKits([]));
    if (card.editor === "design") api.templateDocument(card.id).then((r) => alive && setContent(r)).catch(() => alive && setError("The preview could not be loaded."));
    return () => { alive = false; };
  }, [card.id, card.editor]);

  // The same pure function the server runs, so what is previewed is what is created.
  const application: BrandApplication | null = useMemo(() => (content && kit ? applyBrandKitToDesign(content, kit.document) : null), [content, kit]);
  const shown: DesignDocument | null = content ? (application && showKit ? application.document : content.document) : null;

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    let url: string | null = null;
    const kitName = application && showKit ? kit?.name ?? null : null;
    renderDesign(shown, "image/png", 1, application && showKit ? libraryImageSource : noImages)
      .then((blob) => { if (alive) { url = URL.createObjectURL(blob); setImage({ url, kitName }); } })
      .catch(() => alive && setError("The preview could not be drawn in this browser."));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [shown, application, showKit, kit?.name]);

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
      const { result } = await api.useTemplate(card.id, { name: name.trim() || undefined, brandKitId: kitId || undefined });
      onUsed(card);
      toast(result.brand ? `Created “${name.trim() || card.name}” with ${result.brand.kitName}` : `Created “${name.trim() || card.name}”`, "success");
      if (result.brand?.adjustments.length) toast(result.brand.adjustments.join(" "), "info");
      navigate(result.path);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not create the project", "error");
      setBusy(false);
    }
  };

  const scale = Math.min(1, stageWidth / device.width);
  const siteSrc = `/api/template-library/templates/${encodeURIComponent(card.id)}/preview/${kit && showKit ? `?kit=${encodeURIComponent(kit.id)}` : ""}`;
  const assetNote = detail
    ? detail.dependencies.bundledAssets.length + detail.dependencies.icons.length + detail.dependencies.elements.length === 0
      ? "No uploads needed. Add your own photos from your Asset Library when you want them."
      : "Uses graphics that ship with BINHI."
    : "";
  const supportsKit = (detail?.brandTokens.length ?? 0) > 0;
  const summary = application
    ? `${application.changes.filter((c) => c.what !== "logo").length} colour and font changes${application.logoPlaced ? " and your logo" : ""}`
    : "";

  return (
    <Modal wide title={card.name} onClose={onClose}>
      <div className="tpl-preview">
        <div className="tpl-preview-stage" ref={stage}>
          {kit && (
            <div className="tpl-device" role="group" aria-label="Preview version">
              <button type="button" className="btn btn-sm" aria-pressed={!showKit} onClick={() => setShowKit(false)}>Original</button>
              <button type="button" className="btn btn-sm" aria-pressed={showKit} onClick={() => setShowKit(true)}>With {kit.name}</button>
            </div>
          )}
          {card.editor === "design" && (image ? <img src={image.url} alt={`${card.name} preview${image.kitName ? ` with ${image.kitName}` : ""}`} className="tpl-preview-img" style={{ aspectRatio: card.size.kind === "fixed" ? `${card.size.width} / ${card.size.height}` : undefined }} /> : error ? null : <p className="muted" role="status">Drawing preview…</p>)}
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
                <iframe key={siteSrc} title={`${card.name} website preview at ${device.label} width`} sandbox="" src={siteSrc} style={{ width: device.width, height: 520, transform: `scale(${scale})` }} />
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

          {supportsKit && (
            <div className="tpl-kit">
              <label className="field-block">Brand kit
                <select aria-label="Brand kit" value={kitId} onChange={(e) => { setKitId(e.target.value); setShowKit(true); }} disabled={!kits || kits.length === 0}>
                  <option value="">None: keep the template's own look</option>
                  {kits?.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </label>
              {kits && kits.length === 0 && <p className="small muted">You have no brand kits yet. <Link to="/brand-kits">Create one</Link> to preview your colours, fonts and logo here.</p>}
              {kit && card.editor === "design" && application && (
                <div className="small" role="status">
                  <strong>{summary}.</strong> Only the parts this template marks as brand-aware change; everything else stays as designed.
                  {content && content.brand.logoSlot && !kit.document.logoAssetId && <span> Your kit has no logo, so none is added.</span>}
                  {content && !content.brand.logoSlot && <span> This template has no logo spot.</span>}
                  {application.adjustments.map((a) => <span key={a} className="tpl-adjust"> {a}</span>)}
                </div>
              )}
              {kit && card.editor === "website" && <p className="small muted" role="status">Your colours and fonts become the site's theme. The untouched template stays in the site's history, so you can restore it.</p>}
            </div>
          )}

          <p className="small muted">Creating a template project makes your own copy. Changing it never changes the template.</p>
          <label className="field-block">Name your project<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <div className="tpl-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !card.usable || !name.trim()} onClick={() => void create()}>{busy ? "Creating…" : kit ? "Create with brand kit" : "Create from template"}</button>
            <button type="button" className={`btn${favorite ? " is-on" : ""}`} aria-pressed={favorite} onClick={() => onToggleFavorite(card)}><I.star fill={favorite ? "currentColor" : "none"} /> {favorite ? "Favorited" : "Favorite"}</button>
          </div>
          {!card.usable && <p className="form-error" role="alert">{card.reasons.join(" ")}</p>}
        </div>
      </div>
    </Modal>
  );
}
