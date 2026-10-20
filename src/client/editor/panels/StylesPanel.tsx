import { useState } from "react";
import { useStore, useSel } from "../context.js";
import { FONT_STACKS, TEXT_STYLE_KEYS, THEME_COLOR_KEYS, type FontName, type TextStyleKey, type ThemeColorKey, type Operation, type TextStyle } from "../../../core/index.js";
import { ColorInput, NumberInput, SelectInput } from "../properties/fields.js";

const COLOR_LABELS: Record<ThemeColorKey, string> = { primary: "Primary", secondary: "Secondary", accent: "Accent", background: "Page background", surface: "Surface", text: "Text", muted: "Muted text", border: "Borders" };
const TS_LABELS: Record<TextStyleKey, string> = { display: "Display", heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", body: "Body", small: "Small text", caption: "Caption", button: "Button text", navigation: "Navigation" };
const FONT_PAIRS: { label: string; heading: FontName; body: FontName }[] = [
  { label: "Inter / Inter", heading: "Inter", body: "Inter" },
  { label: "Playfair Display / Inter", heading: "Playfair Display", body: "Inter" },
  { label: "Space Grotesk / DM Sans", heading: "Space Grotesk", body: "DM Sans" },
  { label: "Lora / DM Sans", heading: "Lora", body: "DM Sans" },
  { label: "DM Sans / DM Sans", heading: "DM Sans", body: "DM Sans" },
  { label: "System Sans / System Sans", heading: "System Sans", body: "System Sans" },
  { label: "System Serif / System Sans", heading: "System Serif", body: "System Sans" },
];

export function StylesPanel() {
  const store = useStore();
  const theme = useSel((s) => s.document.theme);
  const [tab, setTab] = useState<"colors" | "type" | "buttons" | "layout">("colors");
  const update = (patch: Extract<Operation, { type: "updateTheme" }>["patch"]) => store.dispatch([{ type: "updateTheme", patch }]);
  return (
    <>
      <header className="panel-head"><h2>Brand styles</h2></header>
      <div className="panel-body">
        <p className="help" style={{ marginBottom: 10 }}>Site-wide design tokens. Changing one updates every element that uses it; use undo to compare.</p>
        <div className="tabs" role="tablist">
          {(["colors", "type", "buttons", "layout"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "type" ? "Typography" : t[0]!.toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {tab === "colors" && (
          <div className="prop-group-body" style={{ padding: 0 }}>
            {THEME_COLOR_KEYS.map((k) => (
              <div className="field" key={k}><span className="field-label">{COLOR_LABELS[k]}</span><ColorInput value={theme.colors[k]} onChange={(v) => update({ colors: { [k]: v } })} allowTokens={false} /></div>
            ))}
            <h3 style={{ marginTop: 8 }}>Saved brand colours</h3>
            <div className="swatch-row">
              {theme.palette.map((c, i) => (
                <button key={i} className="swatch" style={{ background: c }} title={`${c} — click to remove`} onClick={() => update({ palette: theme.palette.filter((_, j) => j !== i) })} aria-label={`Remove ${c}`} />
              ))}
              <AddColor onAdd={(c) => theme.palette.length < 24 && update({ palette: [...theme.palette, c] })} />
            </div>
          </div>
        )}
        {tab === "type" && (
          <div className="prop-group-body" style={{ padding: 0 }}>
            <div className="field"><span className="field-label">Font pairing</span>
              <SelectInput value={`${theme.fonts.heading}|${theme.fonts.body}`} options={[...FONT_PAIRS.map((p) => ({ value: `${p.heading}|${p.body}`, label: p.label })), ...(FONT_PAIRS.some((p) => p.heading === theme.fonts.heading && p.body === theme.fonts.body) ? [] : [{ value: `${theme.fonts.heading}|${theme.fonts.body}`, label: `${theme.fonts.heading} / ${theme.fonts.body}` }])]} onChange={(v) => { const [heading, body] = v.split("|") as [FontName, FontName]; update({ fonts: { heading, body } }); }} />
            </div>
            <div className="field"><span className="field-label">Heading font</span><SelectInput value={theme.fonts.heading} options={Object.keys(FONT_STACKS).map((f) => ({ value: f, label: f }))} onChange={(v) => update({ fonts: { heading: v as FontName } })} /></div>
            <div className="field"><span className="field-label">Body font</span><SelectInput value={theme.fonts.body} options={Object.keys(FONT_STACKS).map((f) => ({ value: f, label: f }))} onChange={(v) => update({ fonts: { body: v as FontName } })} /></div>
            <h3 style={{ marginTop: 8 }}>Text styles</h3>
            {TEXT_STYLE_KEYS.map((k) => (
              <TextStyleEditor key={k} id={k} label={TS_LABELS[k]} />
            ))}
          </div>
        )}
        {tab === "buttons" && (
          <div className="prop-group-body" style={{ padding: 0 }}>
            {(["primary", "secondary", "ghost"] as const).map((v) => {
              const b = theme.buttons[v];
              const set = (patch: Partial<typeof b>) => update({ buttons: { [v]: patch } });
              return (
                <details key={v} className="prop-group" open={v === "primary"}>
                  <summary>{v[0]!.toUpperCase() + v.slice(1)} button</summary>
                  <div className="prop-group-body">
                    <div className="field"><span className="field-label">Background</span><ColorInput value={b.background} onChange={(c) => set({ background: c })} /></div>
                    <div className="field"><span className="field-label">Text</span><ColorInput value={b.color} onChange={(c) => set({ color: c })} /></div>
                    <div className="field"><span className="field-label">Hover bg</span><ColorInput value={b.hoverBackground ?? b.background} onChange={(c) => set({ hoverBackground: c })} /></div>
                    <div className="field"><span className="field-label">Hover text</span><ColorInput value={b.hoverColor ?? b.color} onChange={(c) => set({ hoverColor: c })} /></div>
                    <div className="field"><span className="field-label">Border</span><ColorInput value={b.borderColor ?? "transparent"} onChange={(c) => set({ borderColor: c })} /></div>
                    <div className="field"><span className="field-label">Border width</span><NumberInput value={b.borderWidth} min={0} max={8} onChange={(n) => set({ borderWidth: n })} unit="px" /></div>
                    <div className="field"><span className="field-label">Corner radius</span><NumberInput value={b.radius} min={0} max={999} onChange={(n) => set({ radius: n })} unit="px" /></div>
                    <div className="field"><span className="field-label">Padding X</span><NumberInput value={b.paddingX} min={0} max={80} onChange={(n) => set({ paddingX: n })} unit="px" /></div>
                    <div className="field"><span className="field-label">Padding Y</span><NumberInput value={b.paddingY} min={0} max={40} onChange={(n) => set({ paddingY: n })} unit="px" /></div>
                    <div className="field"><span className="field-label">Shadow</span><SelectInput value={b.shadow} options={["none", "sm", "md", "lg"].map((s) => ({ value: s, label: s }))} onChange={(s) => set({ shadow: s as typeof b.shadow })} /></div>
                  </div>
                </details>
              );
            })}
            <h3 style={{ marginTop: 8 }}>Links</h3>
            <div className="field"><span className="field-label">Link colour</span><ColorInput value={theme.links.color} onChange={(c) => update({ links: { color: c } })} /></div>
            <div className="field"><span className="field-label">Hover colour</span><ColorInput value={theme.links.hoverColor} onChange={(c) => update({ links: { hoverColor: c } })} /></div>
            <label className="toggle"><input type="checkbox" checked={theme.links.underline} onChange={(e) => update({ links: { underline: e.target.checked } })} /> Underline links</label>
          </div>
        )}
        {tab === "layout" && (
          <div className="prop-group-body" style={{ padding: 0 }}>
            <div className="field"><span className="field-label">Content width</span><NumberInput value={theme.spacing.contentWidth} min={600} max={2400} step={10} onChange={(n) => update({ spacing: { contentWidth: n } })} unit="px" /></div>
            <div className="field"><span className="field-label">Section spacing</span><NumberInput value={theme.spacing.sectionPaddingY} min={0} max={400} onChange={(n) => update({ spacing: { sectionPaddingY: n } })} unit="px" /></div>
            <div className="field"><span className="field-label">Default gap</span><NumberInput value={theme.spacing.gap} min={0} max={120} onChange={(n) => update({ spacing: { gap: n } })} unit="px" /></div>
            <h3 style={{ marginTop: 8 }}>Corner radii</h3>
            {(["sm", "md", "lg"] as const).map((k) => (
              <div className="field" key={k}><span className="field-label">{k.toUpperCase()}</span><NumberInput value={theme.radii[k]} min={0} max={k === "lg" ? 128 : 64} onChange={(n) => update({ radii: { [k]: n } })} unit="px" /></div>
            ))}
            <h3 style={{ marginTop: 8 }}>Shadows</h3>
            {(["sm", "md", "lg", "xl"] as const).map((k) => (
              <div className="field" key={k}><label htmlFor={`sh-${k}`}>{k.toUpperCase()}</label><input id={`sh-${k}`} defaultValue={theme.shadows[k]} key={theme.shadows[k]} onBlur={(e) => e.target.value !== theme.shadows[k] && update({ shadows: { [k]: e.target.value.slice(0, 200) } })} /></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AddColor({ onAdd }: { onAdd: (c: string) => void }) {
  return <input type="color" aria-label="Add a brand colour" className="swatch" style={{ padding: 0, width: 24, height: 24 }} onChange={(e) => onAdd(e.target.value)} />;
}

function TextStyleEditor({ id, label }: { id: TextStyleKey; label: string }) {
  const store = useStore();
  const ts = useSel((s) => s.document.theme.textStyles[id]);
  const set = (style: Partial<TextStyle>) => store.dispatch([{ type: "updateTextStyle", key: id, style }]);
  if (!ts) return null;
  return (
    <details className="prop-group">
      <summary><span style={{ fontFamily: ts.fontFamily === "heading" ? "var(--font)" : "var(--font)", fontWeight: ts.fontWeight }}>{label}</span><span className="muted small">{ts.fontSize}px</span></summary>
      <div className="prop-group-body">
        <div className="field"><span className="field-label">Font</span><SelectInput value={ts.fontFamily} options={[{ value: "heading", label: "Heading font" }, { value: "body", label: "Body font" }]} onChange={(v) => set({ fontFamily: v as "heading" | "body" })} /></div>
        <div className="field"><span className="field-label">Size</span><NumberInput value={ts.fontSize} min={8} max={200} onChange={(n) => set({ fontSize: n })} unit="px" /></div>
        <div className="field"><span className="field-label">Mobile size</span><NumberInput value={ts.mobileFontSize ?? ts.fontSize} min={8} max={200} onChange={(n) => set({ mobileFontSize: n })} unit="px" /></div>
        <div className="field"><span className="field-label">Weight</span><SelectInput value={String(ts.fontWeight)} options={[300, 400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: String(w) }))} onChange={(v) => set({ fontWeight: Number(v) })} /></div>
        <div className="field"><span className="field-label">Line height</span><NumberInput value={ts.lineHeight} min={0.8} max={3} step={0.05} onChange={(n) => set({ lineHeight: n })} /></div>
        <div className="field"><span className="field-label">Letter spacing</span><NumberInput value={ts.letterSpacing} min={-0.2} max={1} step={0.01} onChange={(n) => set({ letterSpacing: n })} unit="em" /></div>
        <div className="field"><span className="field-label">Case</span><SelectInput value={ts.textTransform} options={["none", "uppercase", "lowercase", "capitalize"].map((v) => ({ value: v, label: v }))} onChange={(v) => set({ textTransform: v as typeof ts.textTransform })} /></div>
      </div>
    </details>
  );
}
