import { useEffect, useState, type ReactNode } from "react";
import { I } from "../../components/Icons.js";
import type { Length, Sides } from "../../../core/index.js";
import { useSel } from "../context.js";

let seq = 0;
export function useId2(prefix: string): string {
  const [id] = useState(() => `${prefix}-${++seq}`);
  return id;
}

export function Group({ title, children, defaultOpen = true, badge }: { title: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  return (
    <details className="prop-group" open={defaultOpen}>
      <summary><span>{title} {badge}</span><I.chevron /></summary>
      <div className="prop-group-body">{children}</div>
    </details>
  );
}

export function Field({ label, children, stack = false, htmlFor }: { label: string; children: ReactNode; stack?: boolean; htmlFor?: string }) {
  return (
    <div className={`field ${stack ? "stack" : ""}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="field-label">{label}</span>}
      {children}
    </div>
  );
}

/** Number input that commits on blur/Enter and supports arrow keys with shift ×10. */
export function NumberInput({ value, onChange, min, max, step = 1, unit, placeholder, id, ariaLabel }: { value: number | undefined | null; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string; placeholder?: string; id?: string; ariaLabel?: string }) {
  const [draft, setDraft] = useState(value === undefined || value === null ? "" : String(value));
  useEffect(() => setDraft(value === undefined || value === null ? "" : String(value)), [value]);
  const commit = (raw: string) => {
    if (raw.trim() === "") return;
    let n = Number(raw);
    if (!Number.isFinite(n)) return setDraft(value === undefined || value === null ? "" : String(value));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    n = Math.round(n / (step < 1 ? step : 1) ) * (step < 1 ? step : 1);
    n = Number(n.toFixed(3));
    if (n !== value) onChange(n);
    setDraft(String(n));
  };
  return (
    <div className="field-inline">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const cur = Number(draft) || value || 0;
            const delta = (e.shiftKey ? 10 : 1) * step * (e.key === "ArrowUp" ? 1 : -1);
            commit(String(cur + delta));
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

const UNITS = ["px", "%", "rem", "vw", "vh", "auto"] as const;

/** Length editor: number + unit, or a keyword like auto / fit-content. */
export function LengthInput({ value, onChange, onClear, id, allowAuto = true, placeholder }: { value: Length | undefined; onChange: (l: Length) => void; onClear?: () => void; id?: string; allowAuto?: boolean; placeholder?: string }) {
  const parsed = parseLength(value);
  return (
    <div className="field-inline">
      {parsed.unit === "auto" || parsed.unit === "fit-content" ? (
        <select id={id} value={parsed.unit} onChange={(e) => (e.target.value === "px" ? onChange(100) : onChange(e.target.value as Length))} aria-label="Size">
          <option value="auto">Auto</option>
          <option value="fit-content">Fit content</option>
          <option value="px">Fixed (px)</option>
        </select>
      ) : (
        <>
          <NumberInput id={id} value={parsed.n} placeholder={placeholder ?? "auto"} onChange={(n) => onChange(parsed.unit === "px" ? n : (`${n}${parsed.unit}` as Length))} />
          <select value={parsed.unit} aria-label="Unit" onChange={(e) => {
            const u = e.target.value;
            if (u === "auto") onChange("auto");
            else if (u === "fit-content") onChange("fit-content");
            else if (u === "px") onChange(parsed.n ?? 100);
            else onChange(`${parsed.n ?? 100}${u}` as Length);
          }}>
            {UNITS.filter((u) => allowAuto || u !== "auto").map((u) => <option key={u} value={u}>{u}</option>)}
            {allowAuto && <option value="fit-content">fit</option>}
          </select>
        </>
      )}
      {onClear && value !== undefined && <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClear} aria-label="Clear" title="Clear"><I.x /></button>}
    </div>
  );
}

export function parseLength(v: Length | undefined): { n: number | undefined; unit: string } {
  if (v === undefined) return { n: undefined, unit: "px" };
  if (typeof v === "number") return { n: v, unit: "px" };
  if (v === "auto" || v === "fit-content" || v === "max-content" || v === "min-content") return { n: undefined, unit: v === "auto" ? "auto" : "fit-content" };
  const m = /^(-?[\d.]+)([a-z%]+)$/.exec(v);
  return m ? { n: Number(m[1]), unit: m[2]! } : { n: undefined, unit: "px" };
}

export function SelectInput<T extends string>({ value, options, onChange, id, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id?: string; ariaLabel?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={ariaLabel}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

/** Four-side spacing editor with a link toggle. */
export function SidesInput({ value, onChange, label }: { value: Sides | undefined; onChange: (s: Sides) => void; label: string }) {
  const [linked, setLinked] = useState(() => {
    const v = value ?? {};
    return v.top === v.right && v.top === v.bottom && v.top === v.left;
  });
  const v = value ?? {};
  const num = (x: Length | undefined) => (typeof x === "number" ? x : x === undefined ? undefined : parseLength(x).n);
  const set = (side: keyof Sides, n: number) => {
    if (linked) onChange({ top: n, right: n, bottom: n, left: n });
    else onChange({ ...v, [side]: n });
  };
  return (
    <div className="field stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="field-label">{label}</span>
        <button className={`icon-btn ${linked ? "active" : ""}`} style={{ width: 24, height: 24 }} onClick={() => setLinked(!linked)} aria-pressed={linked} title={linked ? "All sides linked" : "Edit sides separately"} aria-label="Link sides"><I.link /></button>
      </div>
      <div className="sides-grid">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side}>
            <input type="number" value={num(v[side]) ?? ""} placeholder="0" aria-label={`${label} ${side}`} onChange={(e) => e.target.value !== "" && set(side, Number(e.target.value))} />
            <div className="lbl">{side[0]!.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOKENS: { token: string; label: string }[] = [
  { token: "var(--b-primary)", label: "Primary" },
  { token: "var(--b-secondary)", label: "Secondary" },
  { token: "var(--b-accent)", label: "Accent" },
  { token: "var(--b-background)", label: "Background" },
  { token: "var(--b-surface)", label: "Surface" },
  { token: "var(--b-text)", label: "Text" },
  { token: "var(--b-muted)", label: "Muted" },
  { token: "var(--b-border)", label: "Border" },
];

const RECENT_KEY = "binhi.recentColors";
function recentColors(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(c: string) {
  try {
    const list = [c, ...recentColors().filter((x) => x !== c)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Colour editor: theme tokens, saved brand colours, recent, picker and free text. */
export function ColorInput({ value, onChange, onClear, allowTokens = true, id }: { value: string | undefined; onChange: (c: string) => void; onClear?: () => void; allowTokens?: boolean; id?: string }) {
  const theme = useSel((s) => s.document.theme);
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  const resolved = (c: string | undefined) => {
    if (!c) return "#000000";
    const m = /^var\(--b-([a-z]+)\)$/.exec(c);
    if (m) return (theme.colors as Record<string, string>)[m[1]!] ?? "#000000";
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : /^#[0-9a-fA-F]{3}$/.test(c) ? "#" + c.slice(1).split("").map((x) => x + x).join("") : "#000000";
  };
  const commit = (c: string) => {
    const v = c.trim();
    if (!v) return onClear?.();
    pushRecent(v);
    onChange(v);
  };
  const recents = recentColors();
  return (
    <div className="field stack" style={{ gap: 6 }}>
      <div className="color-field">
        <input type="color" value={resolved(value)} onChange={(e) => commit(e.target.value)} aria-label="Pick a colour" />
        <input id={id} type="text" value={text} placeholder="#000000 or transparent" onChange={(e) => setText(e.target.value)} onBlur={(e) => e.target.value !== (value ?? "") && commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)} aria-label="Colour value" />
        {onClear && value !== undefined && <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClear} aria-label="Clear colour"><I.x /></button>}
      </div>
      <div className="swatch-row">
        {allowTokens && TOKENS.map((t) => <button key={t.token} className={`swatch ${value === t.token ? "active" : ""}`} style={{ background: resolved(t.token) }} title={`${t.label} (theme)`} aria-label={`Theme ${t.label}`} onClick={() => commit(t.token)} />)}
        {theme.palette.map((c) => <button key={c} className={`swatch ${value === c ? "active" : ""}`} style={{ background: c }} title={c} aria-label={`Brand colour ${c}`} onClick={() => commit(c)} />)}
        {recents.filter((c) => !theme.palette.includes(c)).slice(0, 5).map((c) => <button key={c} className={`swatch ${value === c ? "active" : ""}`} style={{ background: c }} title={`Recent ${c}`} aria-label={`Recent colour ${c}`} onClick={() => commit(c)} />)}
        <button className={`swatch transparent ${value === "transparent" ? "active" : ""}`} title="Transparent" aria-label="Transparent" onClick={() => commit("transparent")} />
      </div>
    </div>
  );
}
