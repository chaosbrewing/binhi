import { useState } from "react";
import { ICON_SIZE_PRESETS, ICON_STROKE_MAX, ICON_STROKE_MIN, getIcon, legacyFallbackName, type IconVariant } from "../../../core/icons/index.js";
import { LEGACY_ICON_NAMES, type Node, type StyleSet } from "../../../core/index.js";
import { Modal } from "../../components/Modal.js";
import type { IconInsertSettings } from "../../icons/IconBrowser.js";
import { LazyIconBrowser } from "../../icons/LazyIconBrowser.js";
import { IconGlyph } from "../../icons/IconGlyph.js";
import { useThemePalette } from "../panels/IconsPanel.js";
import { useAuth } from "../../auth/AuthContext.js";
import { ColorInput, Field, NumberInput, SelectInput, Toggle } from "./fields.js";

const VARIANT_LABEL: Record<IconVariant, string> = { outline: "Outline", duotone: "Duotone", filled: "Filled", inverted: "Inverted badge", brand: "Brand colour" };

/** Content settings for the website `icon` element: library icon, style, size, stroke, colour, rotation, flips, gradient. */
export function IconContentEditor({ node, setProps, style, setStyle }: { node: Node; setProps: (p: Record<string, unknown>) => void; style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void }) {
  const p = node.props as Record<string, any>;
  const palette = useThemePalette();
  const { iconLibrary } = useAuth();
  const [picking, setPicking] = useState(false);
  const def = typeof p.icon === "string" ? getIcon(p.icon) : undefined;
  const size = Number(p.size ?? 32);

  const choose = (id: string, s: IconInsertSettings) => {
    setProps({ icon: id, ...(legacyFallbackName(id) ? { name: legacyFallbackName(id) } : {}), variant: s.variant, strokeWidth: s.strokeWidth });
    if (s.color) setStyle({ color: s.color });
    setPicking(false);
  };

  return (
    <>
      <div className="icon-current">
        {def ? (
          <IconGlyph id={def.id} size={40} variant={p.variant} strokeWidth={p.strokeWidth} color={style.color && /^#/.test(style.color) ? style.color : undefined} />
        ) : (
          <span className="small muted">Built-in icon “{String(p.name)}”</span>
        )}
        <div>
          <strong>{def ? def.name : "Older built-in icon"}</strong>
          {def && <div className="small muted"><code>{def.id}</code></div>}
        </div>
      </div>
      {iconLibrary && <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>{def ? "Change icon…" : "Choose from the icon library…"}</button>}
      {!def && (
        <Field label="Built-in icon"><SelectInput value={p.name} options={LEGACY_ICON_NAMES.map((n) => ({ value: n, label: n }))} onChange={(name) => setProps({ name })} /></Field>
      )}

      {def && (
        <>
          <Field label="Style">
            <SelectInput value={(p.variant ?? "outline") as IconVariant} options={def.variants.map((v) => ({ value: v, label: VARIANT_LABEL[v] }))} onChange={(variant) => setProps({ variant })} ariaLabel="Selected icon style" />
          </Field>
          <Field label="Stroke weight"><NumberInput value={p.strokeWidth ?? 2} min={ICON_STROKE_MIN} max={ICON_STROKE_MAX} step={0.5} onChange={(strokeWidth) => setProps({ strokeWidth })} ariaLabel="Selected icon stroke weight" /></Field>
        </>
      )}
      <Field label="Size">
        <SelectInput
          value={ICON_SIZE_PRESETS.includes(size as never) ? String(size) : "custom"}
          options={[...ICON_SIZE_PRESETS.map((s) => ({ value: String(s), label: `${s} px` })), { value: "custom", label: "Custom" }]}
          onChange={(v) => v !== "custom" && setProps({ size: Number(v) })} ariaLabel="Selected icon size preset"
        />
      </Field>
      <Field label="Custom size"><NumberInput value={size} min={8} max={400} onChange={(n) => setProps({ size: n })} unit="px" ariaLabel="Selected icon custom size" /></Field>
      <Field label="Colour" stack><ColorInput value={style.color} onChange={(color) => setStyle({ color })} onClear={() => setStyle({}, ["color"])} /></Field>
      {def && (
        <>
          <Field label="Rotation"><NumberInput value={p.rotation ?? 0} min={-360} max={360} step={15} onChange={(rotation) => setProps({ rotation })} unit="°" ariaLabel="Selected icon rotation" /></Field>
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <Toggle checked={!!p.flipX} onChange={(flipX) => setProps({ flipX })} label="Flip horizontally" />
            <Toggle checked={!!p.flipY} onChange={(flipY) => setProps({ flipY })} label="Flip vertically" />
          </div>
          <Toggle checked={!!p.gradient} onChange={(on) => setProps({ gradient: on ? { from: "var(--b-primary)", to: "var(--b-accent)", angle: 45 } : undefined })} label="Gradient colour" />
          {p.gradient && (
            <>
              <Field label="From" stack><ColorInput value={p.gradient.from} onChange={(from) => setProps({ gradient: { ...p.gradient, from } })} /></Field>
              <Field label="To" stack><ColorInput value={p.gradient.to} onChange={(to) => setProps({ gradient: { ...p.gradient, to } })} /></Field>
              <Field label="Angle"><NumberInput value={p.gradient.angle ?? 45} min={0} max={360} step={15} onChange={(angle) => setProps({ gradient: { ...p.gradient, angle } })} unit="°" /></Field>
            </>
          )}
        </>
      )}
      {picking && (
        <Modal title="Choose an icon" onClose={() => setPicking(false)} wide initialFocus='input[type="search"]'>
          <LazyIconBrowser autoFocusSearch onInsert={choose} insertLabel="Use this icon" palette={palette} initialId={def?.id} defaults={{ size, variant: p.variant, strokeWidth: p.strokeWidth }} />
        </Modal>
      )}
    </>
  );
}
