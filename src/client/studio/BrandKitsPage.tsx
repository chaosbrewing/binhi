import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type BrandKit, type LibraryAsset, type SiteSummary } from "../api.js";
import { BRAND_KIT_LIMITS, brandKitToThemePatch, createBrandKitDocument, type BrandKitDocument } from "../../core/creative/index.js";
import { FONT_STACKS, type FontName } from "../../core/schema/document.js";
import { ConfirmDialog } from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { I } from "../components/Icons.js";
import { StudioShell } from "./StudioShell.js";
import { LibraryPicker } from "./LibraryPicker.js";

const FONT_NAMES = Object.keys(FONT_STACKS) as FontName[];
const HEX = /^#[0-9a-f]{6}$/i;

function randomBatchId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `kit-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function BrandKitsPage() {
  const toast = useToast();
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandKit | null>(null);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState<BrandKitDocument>(createBrandKitDocument());
  const [logo, setLogo] = useState<LibraryAsset | null>(null);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<BrandKit | null>(null);
  const [applySite, setApplySite] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [k, s] = await Promise.all([api.brandKits(), api.sites()]);
      setKits(k.kits);
      setSites(s.sites);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load brand kits");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const startNew = () => {
    setEditing(null);
    setName("");
    setDoc(createBrandKitDocument());
    setLogo(null);
  };
  const edit = async (kit: BrandKit) => {
    setEditing(kit);
    setName(kit.name);
    setDoc(kit.document);
    setLogo(null);
    if (kit.document.logoAssetId) {
      try {
        setLogo((await api.libraryAsset(kit.document.logoAssetId)).asset);
      } catch {
        setLogo(null);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = async () => {
    if (!name.trim()) {
      setError("Give the brand kit a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = editing ? await api.updateBrandKit(editing.id, { name: name.trim(), document: doc }) : await api.createBrandKit(name.trim(), doc);
      toast(editing ? "Brand kit updated" : "Brand kit created", "success");
      setEditing(r.kit);
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not save the brand kit");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (kit: BrandKit) => {
    setConfirm(null);
    try {
      await api.deleteBrandKit(kit.id);
      toast(`"${kit.name}" deleted`, "success");
      if (editing?.id === kit.id) startNew();
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not delete", "error");
    }
  };
  const applyToSite = async (kit: BrandKit, siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
    if (!window.confirm(`Apply "${kit.name}" to "${site.name}"? This changes the website's theme colours and fonts as a new revision you can undo from History.`)) return;
    setBusy(true);
    try {
      const detail = (await api.site(siteId)).site;
      const patch = brandKitToThemePatch(kit.document);
      await api.applyOps(siteId, { baseRevision: detail.revision, batchId: randomBatchId(), ops: [{ type: "updateTheme", patch }] });
      toast(`Applied to ${site.name}. Open the editor to review and publish.`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not apply the kit", "error");
    } finally {
      setBusy(false);
    }
  };

  const setColor = (index: number, patch: Partial<BrandKitDocument["colors"][number]>) => setDoc({ ...doc, colors: doc.colors.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  return (
    <StudioShell>
      <main className="studio-main">
        <div className="page-head">
          <div>
            <span className="studio-eyebrow">Brand Kits</span>
            <h1>Your colours, fonts and logo in one place</h1>
            <p className="muted">A kit changes nothing by itself. Apply it to a design from the Design Studio, or push its colours and fonts into a website's theme as a reviewable revision.</p>
          </div>
          <Link to="/" className="btn btn-ghost"><span aria-hidden="true">←</span> Today</Link>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <section className="kit-editor" aria-labelledby="kit-editor-heading">
          <h2 id="kit-editor-heading">{editing ? `Edit “${editing.name}”` : "New brand kit"}</h2>
          <label className="field-block">Kit name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chaos Origins" /></label>
          <fieldset className="kit-colors">
            <legend>Colours <span className="muted small">({doc.colors.length} of {BRAND_KIT_LIMITS.maxColors}; the first is primary, the second accent)</span></legend>
            {doc.colors.map((c, i) => (
              <div className="kit-color-row" key={i}>
                <input type="color" aria-label={`${c.name || `Colour ${i + 1}`} value`} value={HEX.test(c.value) ? c.value : "#000000"} onChange={(e) => setColor(i, { value: e.target.value })} />
                <input aria-label={`Colour ${i + 1} name`} value={c.name} maxLength={40} onChange={(e) => setColor(i, { name: e.target.value })} placeholder="Name" />
                <input aria-label={`Colour ${i + 1} hex`} value={c.value} maxLength={9} onChange={(e) => setColor(i, { value: e.target.value })} className="kit-hex" />
                <button type="button" className="icon-btn" aria-label={`Remove colour ${c.name || i + 1}`} disabled={doc.colors.length <= 1} onClick={() => setDoc({ ...doc, colors: doc.colors.filter((_, j) => j !== i) })}><I.x /></button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" disabled={doc.colors.length >= BRAND_KIT_LIMITS.maxColors} onClick={() => setDoc({ ...doc, colors: [...doc.colors, { name: `Colour ${doc.colors.length + 1}`, value: "#888888" }] })}><I.plus /> Add colour</button>
          </fieldset>
          <div className="photo-input-grid">
            <label className="photo-field">Heading font<select value={doc.fonts.heading} onChange={(e) => setDoc({ ...doc, fonts: { ...doc.fonts, heading: e.target.value as FontName } })}>{FONT_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
            <label className="photo-field">Body font<select value={doc.fonts.body} onChange={(e) => setDoc({ ...doc, fonts: { ...doc.fonts, body: e.target.value as FontName } })}>{FONT_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
          </div>
          <label className="field-block">Tagline<input value={doc.tagline} maxLength={120} onChange={(e) => setDoc({ ...doc, tagline: e.target.value })} placeholder="Complexity, Simplified." /></label>
          <div className="field-block">
            <span>Logo (from your asset library)</span>
            <div className="row gap kit-logo-row">
              {doc.logoAssetId ? <img className="kit-logo" src={`/api/library/${doc.logoAssetId}/file`} alt={logo?.alt || "Brand logo"} /> : <span className="muted small">No logo chosen</span>}
              <button type="button" className="btn btn-sm" onClick={() => setPicker(true)}>{doc.logoAssetId ? "Change logo" : "Choose logo"}</button>
              {doc.logoAssetId && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setDoc({ ...doc, logoAssetId: null }); setLogo(null); }}>Remove</button>}
            </div>
          </div>
          <div className="kit-preview" aria-label="Kit preview" style={{ fontFamily: FONT_STACKS[doc.fonts.body] }}>
            <div className="swatch-row">{doc.colors.map((c, i) => <span key={i} className="swatch" style={{ background: HEX.test(c.value) ? c.value : "transparent" }} title={`${c.name} ${c.value}`} />)}</div>
            <strong style={{ fontFamily: FONT_STACKS[doc.fonts.heading], color: HEX.test(doc.colors[0]?.value ?? "") ? doc.colors[0]!.value : undefined }}>{name || "Kit name"}</strong>
            <span className="small">{doc.tagline || "Heading and body fonts, as they will appear."}</span>
          </div>
          <div className="photo-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{editing ? "Save changes" : "Create brand kit"}</button>
            {editing && <button className="btn" onClick={startNew}>New kit</button>}
          </div>
        </section>

        <section aria-labelledby="kits-heading" style={{ marginTop: 32 }}>
          <div className="studio-section-head"><h2 id="kits-heading">Your brand kits</h2><span className="small muted">{kits?.length ?? 0} of {BRAND_KIT_LIMITS.maxKits}</span></div>
          {kits === null && !error && <p className="muted" role="status">Loading…</p>}
          {kits && kits.length === 0 && <div className="studio-empty"><strong>No brand kits yet.</strong><p>Create one above. You can apply it to designs and websites whenever you choose.</p></div>}
          {kits && kits.length > 0 && (
            <ul className="site-grid" aria-label="Brand kits">
              {kits.map((kit) => (
                <li key={kit.id} className="site-card">
                  <div className="site-card-body">
                    <div className="swatch-row" style={{ margin: "0 0 8px" }}>{kit.document.colors.map((c, i) => <span key={i} className="swatch" style={{ background: c.value }} title={`${c.name} ${c.value}`} />)}</div>
                    <h2 style={{ fontFamily: FONT_STACKS[kit.document.fonts.heading] }}>{kit.name}</h2>
                    <p className="muted small">{kit.document.fonts.heading} / {kit.document.fonts.body}{kit.document.logoAssetId ? " · logo" : ""}{kit.document.tagline ? ` · “${kit.document.tagline}”` : ""}</p>
                    {sites.length > 0 && (
                      <div className="row gap" style={{ marginTop: 8 }}>
                        <select aria-label={`Website to apply ${kit.name} to`} value={applySite} onChange={(e) => setApplySite(e.target.value)}><option value="">Apply to website…</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        <button className="btn btn-sm" disabled={!applySite || busy} onClick={() => void applyToSite(kit, applySite)}>Apply</button>
                      </div>
                    )}
                  </div>
                  <div className="site-card-actions">
                    <button className="btn btn-primary" onClick={() => void edit(kit)}>Edit</button>
                    <Link to="/studio/design" className="btn">Use in a design</Link>
                    <button className="btn btn-ghost btn-danger-text" aria-label={`Delete ${kit.name}`} onClick={() => setConfirm(kit)}><I.trash /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {picker && <LibraryPicker title="Choose a logo" onClose={() => setPicker(false)} onPick={(asset) => { setDoc({ ...doc, logoAssetId: asset.id }); setLogo(asset); setPicker(false); }} />}
      {confirm && <ConfirmDialog title={`Delete "${confirm.name}"?`} message="Designs and websites already using these colours keep them. This cannot be undone." confirmLabel="Delete kit" danger onConfirm={() => void remove(confirm)} onCancel={() => setConfirm(null)} />}
    </StudioShell>
  );
}
