import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import type { LeftTab } from "../store.js";
import { PagesPanel } from "./PagesPanel.js";
import { ElementsPanel } from "./ElementsPanel.js";
import { IconsPanel } from "./IconsPanel.js";
import { LayersPanel } from "./LayersPanel.js";
import { MediaPanel } from "./MediaPanel.js";
import { StylesPanel } from "./StylesPanel.js";
import { SectionsPanel } from "./SectionsPanel.js";
import { NavigationPanel } from "./NavigationPanel.js";
import { useAuth } from "../../auth/AuthContext.js";

const TABS: { id: LeftTab; label: string; icon: keyof typeof I }[] = [
  { id: "pages", label: "Pages", icon: "pages" },
  { id: "elements", label: "Elements", icon: "elements" },
  { id: "icons", label: "Icons", icon: "star" },
  { id: "sections", label: "Sections", icon: "sections" },
  { id: "layers", label: "Layers", icon: "layers" },
  { id: "media", label: "Media", icon: "image" },
  { id: "styles", label: "Styles", icon: "palette" },
  { id: "navigation", label: "Menu", icon: "menu" },
];

export function LeftSidebar() {
  const store = useStore();
  const tab = useSel((s) => s.leftTab);
  const open = useSel((s) => s.leftOpen);
  const { iconLibrary } = useAuth();
  const tabs = TABS.filter((t) => t.id !== "icons" || iconLibrary);
  return (
    <div className="left">
      <nav className="left-rail" aria-label="Editor panels">
        {tabs.map((t) => {
          const Icon = I[t.icon];
          return (
            <button key={t.id} className="rail-btn" aria-pressed={open && tab === t.id} onClick={() => store.setLeftTab(t.id)} title={t.label}>
              <Icon />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
      {open && (
        <section className="left-panel" aria-label={tabs.find((t) => t.id === tab)?.label}>
          {tab === "pages" && <PagesPanel />}
          {tab === "elements" && <ElementsPanel />}
          {tab === "icons" && iconLibrary && <IconsPanel />}
          {tab === "sections" && <SectionsPanel />}
          {tab === "layers" && <LayersPanel />}
          {tab === "media" && <MediaPanel />}
          {tab === "styles" && <StylesPanel />}
          {tab === "navigation" && <NavigationPanel />}
        </section>
      )}
    </div>
  );
}
