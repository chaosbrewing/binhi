import { useStore, useSel } from "./context.js";
import { I } from "../components/Icons.js";
import type { DialogName } from "./Editor.js";
import { nodeLabel } from "./actions.js";
import { BREAKPOINT_WIDTHS } from "../../core/index.js";

export function StatusBar({ onOpen }: { onOpen: (d: DialogName) => void }) {
  const store = useStore();
  const revision = useSel((s) => s.revision);
  const zoom = useSel((s) => s.zoom);
  const breakpoint = useSel((s) => s.breakpoint);
  const selection = useSel((s) => s.selection);
  const validation = useSel((s) => s.validation);
  const publication = useSel((s) => s.publication);
  const liveUrl = useSel((s) => s.liveUrl);
  const pageId = useSel((s) => s.pageId);
  const document = useSel((s) => s.document);
  const page = document.pages.find((p) => p.id === pageId);
  const sel = store.selectedNodes();
  const pageIssues = validation.warnings.filter((w) => !w.pageId || w.pageId === pageId).length + validation.errors.length;
  const pubLabel = publication?.isLive && publication.state === "live" ? (publication.revision < revision ? "Live · changes not published" : "Live") : publication?.state === "failed" ? "Last publish failed" : "Not published";
  return (
    <footer className="status" aria-label="Status">
      <span>Page: <strong>{page?.name}</strong></span>
      <span>{sel.length === 0 ? "Nothing selected" : sel.length === 1 ? `Selected: ${nodeLabel(sel[0]!.node)}` : `${sel.length} elements selected`}</span>
      <span>{breakpoint} · {BREAKPOINT_WIDTHS[breakpoint]}px · {Math.round(zoom * 100)}%</span>
      <span>Revision {revision}</span>
      <button onClick={() => onOpen("publish")} title="Publishing">{liveUrl && publication?.isLive ? <I.globe /> : null} {pubLabel}</button>
      <span className="grow" />
      {pageIssues > 0 && (
        <button className="warn" onClick={() => onOpen("publish")} title="Show accessibility and content checks"><I.alert /> {pageIssues} {pageIssues === 1 ? "check" : "checks"} to review</button>
      )}
      <button onClick={() => onOpen("shortcuts")} title="Keyboard shortcuts">Shortcuts <span className="kbd">?</span></button>
    </footer>
  );
}
