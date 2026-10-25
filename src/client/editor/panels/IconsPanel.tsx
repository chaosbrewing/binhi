import { useMemo } from "react";
import { THEME_COLOR_KEYS, type Operation } from "../../../core/index.js";
import { legacyFallbackName } from "../../../core/icons/index.js";
import { useSel, useStore } from "../context.js";
import { insertComponent } from "../actions.js";
import { IconBrowser, type IconInsertSettings, type IconPaletteColor } from "../../icons/IconBrowser.js";

/** Theme colours as stored tokens (`var(--b-primary)`) with concrete preview colours, so inserted icons follow later theme changes. */
export function useThemePalette(): IconPaletteColor[] {
  const colors = useSel((s) => s.document.theme.colors);
  return useMemo(
    () =>
      THEME_COLOR_KEYS.filter((k) => ["primary", "secondary", "accent", "text"].includes(k)).map((k) => ({
        label: `Theme ${k}`,
        value: `var(--b-${k})`,
        preview: colors[k] ?? "#1f6f4a",
      })),
    [colors],
  );
}

/** Left-rail "Icons" destination: browse the 250-icon library and insert a validated `icon` element. */
export function IconsPanel() {
  const store = useStore();
  const palette = useThemePalette();

  const insert = (iconId: string, s: IconInsertSettings) => {
    const ids = insertComponent(store, "icon", { icon: iconId, ...(legacyFallbackName(iconId) ? { name: legacyFallbackName(iconId) } : {}), size: s.size, variant: s.variant, strokeWidth: s.strokeWidth });
    const nodeId = ids?.[0];
    if (nodeId && s.color) {
      const op: Operation = { type: "updateStyle", nodeId, breakpoint: "desktop", style: { color: s.color } };
      store.dispatch([op]);
    }
  };

  return (
    <>
      <header className="panel-head"><h2>Icons</h2></header>
      <div className="panel-body">
        <p className="help" style={{ marginBottom: 10 }}>Pick an icon, then insert it into the selected section. Double-click inserts straight away.</p>
        <IconBrowser onInsert={insert} palette={palette} defaults={{ size: 32 }} />
      </div>
    </>
  );
}
