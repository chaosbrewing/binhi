import { Suspense, lazy } from "react";
import { useStore, useSel } from "../context.js";
import { I } from "../../components/Icons.js";
import type { LeftTab } from "../store.js";
import { PagesPanel } from "./PagesPanel.js";
import { ElementsPanel } from "./ElementsPanel.js";
import { MediaPanel } from "./MediaPanel.js";

const LayersPanel = lazy(() => import("./LayersPanel.js").then((m) => ({ default: m.LayersPanel })));
const StylesPanel = lazy(() => import("./StylesPanel.js").then((m) => ({ default: m.StylesPanel })));
const SectionsPanel = lazy(() => import("./SectionsPanel.js").then((m) => ({ default: m.SectionsPanel })));
const NavigationPanel = lazy(() => import("./NavigationPanel.js").then((m) => ({ default: m.NavigationPanel })));

const TABS: { id: LeftTab; label: string; icon: keyof typeof I }[] = [
  { id: "pages", label: "Pages", icon: "pages" },
  { id: "elements", label: "Elements", icon: "elements" },
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
  const lazyPanelFallback = <p className="help" role="status">Loading panel…</p>;
  return (
    <div className="left">
      <nav className="left-rail" aria-label="Editor panels">
        {TABS.map((t) => {
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
        <section className="left-panel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === "pages" && <PagesPanel />}
          {tab === "elements" && <ElementsPanel />}
          {tab === "sections" && <Suspense fallback={lazyPanelFallback}><SectionsPanel /></Suspense>}
          {tab === "layers" && <Suspense fallback={lazyPanelFallback}><LayersPanel /></Suspense>}
          {tab === "media" && <MediaPanel />}
          {tab === "styles" && <Suspense fallback={lazyPanelFallback}><StylesPanel /></Suspense>}
          {tab === "navigation" && <Suspense fallback={lazyPanelFallback}><NavigationPanel /></Suspense>}
        </section>
      )}
    </div>
  );
}
