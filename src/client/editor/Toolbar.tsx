import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore, useSel } from "./context.js";
import { I } from "../components/Icons.js";
import { Logo } from "../components/Logo.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import type { DialogName } from "./Editor.js";
import { align, distribute, group, reorder, selectionIsFree, toggleHidden, toggleLock, ungroup } from "./actions.js";
import { BREAKPOINT_WIDTHS, type Breakpoint } from "../../core/index.js";

const SAVE_LABEL: Record<string, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Not saved — retrying",
  conflict: "Conflict",
  offline: "Offline — will retry",
};

export function Toolbar({ onOpen }: { onOpen: (d: DialogName) => void }) {
  const store = useStore();
  const siteName = useSel((s) => s.siteName);
  const saveState = useSel((s) => s.saveState);
  const canUndo = useSel((s) => s.canUndo);
  const canRedo = useSel((s) => s.canRedo);
  const breakpoint = useSel((s) => s.breakpoint);
  const zoom = useSel((s) => s.zoom);
  const selection = useSel((s) => s.selection);
  const document = useSel((s) => s.document);
  const publication = useSel((s) => s.publication);
  const revision = useSel((s) => s.revision);
  const siteId = useSel((s) => s.siteId);
  const snapping = useSel((s) => s.snapping);
  const showGrid = useSel((s) => s.showGrid);
  const rightOpen = useSel((s) => s.rightOpen);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(siteName);
  const sel = store.selectedNodes();
  const free = selectionIsFree(store);
  const anyLocked = sel.some((f) => f.node.locked);
  const anyHidden = sel.some((f) => f.node.hidden);
  const hasGroup = sel.some((f) => f.node.type === "group");
  const live = publication?.isLive && publication.state === "live";
  const stale = live && publication.revision < revision;

  const commitName = () => {
    setEditingName(false);
    const name = nameDraft.trim();
    if (name && name !== document.name) store.dispatch([{ type: "renameSite", name }]);
    else setNameDraft(document.name);
  };

  return (
    <header className="toolbar" role="toolbar" aria-label="Editor toolbar">
      <div className="toolbar-group">
        <Link to="/" className="icon-btn" aria-label="Back to your websites" title="Your websites"><Logo compact /></Link>
        {editingName ? (
          <input className="toolbar-title" value={nameDraft} autoFocus onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName} onKeyDown={(e) => (e.key === "Enter" ? commitName() : e.key === "Escape" ? setEditingName(false) : undefined)} aria-label="Website name" maxLength={80} />
        ) : (
          <button className="toolbar-title" onClick={() => { setNameDraft(document.name); setEditingName(true); }} title="Rename website">{document.name}</button>
        )}
        <span className="save-state" data-state={saveState} role="status" aria-live="polite"><span className="dot" />{SAVE_LABEL[saveState]}</span>
      </div>
      <div className="toolbar-group">
        <button className="icon-btn" onClick={() => store.undo()} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)"><I.undo /></button>
        <button className="icon-btn" onClick={() => store.redo()} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)"><I.redo /></button>
      </div>
      <div className="toolbar-group">
        <div className="seg" role="group" aria-label="Preview size">
          {(["desktop", "tablet", "mobile"] as Breakpoint[]).map((bp) => {
            const Icon = I[bp];
            return (
              <button key={bp} aria-pressed={breakpoint === bp} onClick={() => store.setBreakpoint(bp)} title={`${bp[0]!.toUpperCase()}${bp.slice(1)} · ${BREAKPOINT_WIDTHS[bp]}px`} aria-label={`${bp} view`}>
                <Icon />
              </button>
            );
          })}
        </div>
        <button className="icon-btn" onClick={() => store.setZoom(zoom / 1.2)} aria-label="Zoom out" title="Zoom out (⌘-)"><I.minus /></button>
        <button className="zoom-readout icon-btn" onClick={() => store.setZoom(1)} title="Reset zoom to 100%" style={{ width: "auto", padding: "0 6px" }}>{Math.round(zoom * 100)}%</button>
        <button className="icon-btn" onClick={() => store.setZoom(zoom * 1.2)} aria-label="Zoom in" title="Zoom in (⌘+)"><I.plus /></button>
        <button className="icon-btn" onClick={() => store.setZoom(1, true)} aria-label="Fit to screen" title="Fit to screen (⌘0)"><I.fit /></button>
        <button className={`icon-btn ${snapping ? "active" : ""}`} aria-pressed={snapping} onClick={() => store.toggleSnapping()} title="Snap to guides"><I.group /></button>
        <button className={`icon-btn ${showGrid ? "active" : ""}`} aria-pressed={showGrid} onClick={() => store.toggleGrid()} title="Snap to 8px grid"><I.elements /></button>
      </div>
      {sel.length > 0 && (
        <div className="toolbar-group" aria-label="Selection">
          {free && (
            <>
              <button className="icon-btn" onClick={() => align(store, "left")} title="Align left (⌥A)" aria-label="Align left"><I.alignLeft /></button>
              <button className="icon-btn" onClick={() => align(store, "centerX")} title="Align centre (⌥H)" aria-label="Align horizontal centre"><I.alignCenterX /></button>
              <button className="icon-btn" onClick={() => align(store, "right")} title="Align right (⌥D)" aria-label="Align right"><I.alignRight /></button>
              <button className="icon-btn" onClick={() => align(store, "top")} title="Align top (⌥W)" aria-label="Align top"><I.alignTop /></button>
              <button className="icon-btn" onClick={() => align(store, "centerY")} title="Align middle (⌥V)" aria-label="Align vertical centre"><I.alignCenterY /></button>
              <button className="icon-btn" onClick={() => align(store, "bottom")} title="Align bottom (⌥S)" aria-label="Align bottom"><I.alignBottom /></button>
              {sel.length >= 3 && (
                <>
                  <button className="icon-btn" onClick={() => distribute(store, "horizontal")} title="Distribute horizontally" aria-label="Distribute horizontally"><I.distributeH /></button>
                  <button className="icon-btn" onClick={() => distribute(store, "vertical")} title="Distribute vertically" aria-label="Distribute vertically"><I.distributeV /></button>
                </>
              )}
              {sel.length >= 2 && <button className="icon-btn" onClick={() => group(store)} title="Group (⌘G)" aria-label="Group"><I.group /></button>}
            </>
          )}
          {hasGroup && <button className="icon-btn" onClick={() => ungroup(store)} title="Ungroup (⇧⌘G)" aria-label="Ungroup"><I.ungroup /></button>}
          <button className="icon-btn" onClick={() => reorder(store, "forward")} title="Bring forward (⌘])" aria-label="Bring forward"><I.front /></button>
          <button className="icon-btn" onClick={() => reorder(store, "backward")} title="Send backward (⌘[)" aria-label="Send backward"><I.back /></button>
          <button className={`icon-btn ${anyLocked ? "active" : ""}`} onClick={() => toggleLock(store)} title={anyLocked ? "Unlock (⌘L)" : "Lock (⌘L)"} aria-label={anyLocked ? "Unlock" : "Lock"} aria-pressed={anyLocked}>{anyLocked ? <I.lock /> : <I.unlock />}</button>
          <button className={`icon-btn ${anyHidden ? "active" : ""}`} onClick={() => toggleHidden(store)} title={anyHidden ? "Show (⇧⌘H)" : "Hide (⇧⌘H)"} aria-label={anyHidden ? "Show" : "Hide"} aria-pressed={anyHidden}>{anyHidden ? <I.eyeOff /> : <I.eye />}</button>
          <button className="icon-btn" onClick={() => store.duplicateSelection()} title="Duplicate (⌘D)" aria-label="Duplicate"><I.copy /></button>
          <button className="icon-btn" onClick={() => store.deleteSelection()} title="Delete" aria-label="Delete" disabled={anyLocked}><I.trash /></button>
        </div>
      )}
      <div className="grow" />
      <div className="toolbar-group">
        <ThemeToggle />
        <button className={`icon-btn ${rightOpen ? "active" : ""}`} aria-pressed={rightOpen} onClick={() => store.toggleRight()} title="Properties panel" aria-label="Toggle properties panel"><I.settings /></button>
        <a className="btn btn-ghost" href={`/api/sites/${siteId}/preview/`} target="_blank" rel="noopener noreferrer" title="Preview in a new tab" onClick={() => void store.flush()}><I.eye /> Preview</a>
        <button className="btn btn-ghost" onClick={() => onOpen("revisions")} title="Revision history"><I.history /> History</button>
        <button className="btn btn-ghost" onClick={() => onOpen("settings")} title="Website settings" aria-label="Website settings"><I.settings /></button>
        <button className={`btn ${stale || !live ? "btn-primary" : ""}`} onClick={() => onOpen("publish")} title="Publish"><I.rocket /> {live ? (stale ? "Publish changes" : "Published") : "Publish"}</button>
      </div>
    </header>
  );
}
