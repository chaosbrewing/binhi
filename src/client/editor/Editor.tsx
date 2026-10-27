import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useStore, useSel } from "./context.js";
import { Toolbar } from "./Toolbar.js";
import { StatusBar } from "./StatusBar.js";
import { LeftSidebar } from "./panels/LeftSidebar.js";
import { Canvas } from "./canvas/Canvas.js";
import { PropertiesPanel } from "./properties/PropertiesPanel.js";
import { useToast } from "../components/Toast.js";
import { align, group, nudge, reorder, toggleHidden, toggleLock, ungroup } from "./actions.js";
import { api } from "../api.js";

export type DialogName = "revisions" | "publish" | "settings" | "submissions" | "shortcuts" | null;

const RevisionsDialog = lazy(() => import("./dialogs/RevisionsDialog.js").then((m) => ({ default: m.RevisionsDialog })));
const PublishDialog = lazy(() => import("./dialogs/PublishDialog.js").then((m) => ({ default: m.PublishDialog })));
const SettingsDialog = lazy(() => import("./dialogs/SettingsDialog.js").then((m) => ({ default: m.SettingsDialog })));
const SubmissionsDialog = lazy(() => import("./dialogs/SubmissionsDialog.js").then((m) => ({ default: m.SubmissionsDialog })));
const ShortcutsDialog = lazy(() => import("./dialogs/ShortcutsDialog.js").then((m) => ({ default: m.ShortcutsDialog })));

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function Editor() {
  const store = useStore();
  const toast = useToast();
  const lastError = useSel((s) => s.lastError);
  const saveState = useSel((s) => s.saveState);
  const conflict = useSel((s) => s.conflict);
  const rightOpen = useSel((s) => s.rightOpen);
  const [dialog, setDialog] = useState<DialogName>(null);

  useEffect(() => {
    if (lastError) {
      toast(lastError, "error");
      store.clearError();
    }
  }, [lastError, toast, store]);

  // Load media once for the media panel + image pickers.
  useEffect(() => {
    api.assets(store.getState().siteId).then((r) => store.setAssets(r.assets)).catch(() => undefined);
  }, [store]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (dialog) return;
      const mod = e.metaKey || e.ctrlKey;
      if (isTypingTarget(e.target)) {
        return;
      }
      const s = store.getState();
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        void store.flush();
        return;
      }
      if (mod && key === "c") {
        e.preventDefault();
        store.copy();
        return;
      }
      if (mod && key === "x") {
        e.preventDefault();
        store.cut();
        return;
      }
      if (mod && key === "v") {
        e.preventDefault();
        store.paste();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        store.duplicateSelection();
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        e.shiftKey ? ungroup(store) : group(store);
        return;
      }
      if (mod && key === "l") {
        e.preventDefault();
        toggleLock(store);
        return;
      }
      if (mod && e.shiftKey && key === "h") {
        e.preventDefault();
        toggleHidden(store);
        return;
      }
      if (mod && (key === "]" || key === "[")) {
        e.preventDefault();
        reorder(store, key === "]" ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward");
        return;
      }
      if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        store.setZoom(s.zoom * 1.2);
        return;
      }
      if (mod && key === "-") {
        e.preventDefault();
        store.setZoom(s.zoom / 1.2);
        return;
      }
      if (mod && key === "0") {
        e.preventDefault();
        store.setZoom(1, true);
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        const sel = store.selectedNodes()[0];
        const siblings = sel?.parent?.children ?? store.page.sections;
        store.select(siblings.map((n) => n.id));
        return;
      }
      if (key === "?" || (e.shiftKey && key === "/")) {
        setDialog("shortcuts");
        return;
      }
      if (!s.selection.length) return;
      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        store.deleteSelection();
        return;
      }
      if (key === "escape") {
        store.select([]);
        return;
      }
      if (key.startsWith("arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(store, key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0);
        return;
      }
      if (e.altKey && !mod) {
        const map: Record<string, Parameters<typeof align>[1]> = { a: "left", h: "centerX", d: "right", w: "top", v: "centerY", s: "bottom" };
        const a = map[key];
        if (a) {
          e.preventDefault();
          align(store, a);
        }
      }
    },
    [store, dialog],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="editor">
      <Toolbar onOpen={setDialog} />
      {saveState === "conflict" && conflict && (
        <div className="banner" role="alert">
          <strong>Someone else changed this website.</strong>
          <span className="grow">Your last edits haven't been saved. Keep your version, or load the latest saved one.</span>
          <button className="btn btn-sm" onClick={() => void store.resolveConflictUseServer()}>Load latest</button>
          <button className="btn btn-sm btn-primary" onClick={() => void store.resolveConflictKeepMine()}>Keep mine</button>
        </div>
      )}
      <LeftSidebar />
      <Canvas />
      <aside className={`right ${rightOpen ? "" : "collapsed"}`} aria-label="Properties">
        <PropertiesPanel />
      </aside>
      <StatusBar onOpen={setDialog} />
      {dialog && (
        <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>
          {dialog === "revisions" && <RevisionsDialog onClose={() => setDialog(null)} />}
          {dialog === "publish" && <PublishDialog onClose={() => setDialog(null)} />}
          {dialog === "settings" && <SettingsDialog onClose={() => setDialog(null)} />}
          {dialog === "submissions" && <SubmissionsDialog onClose={() => setDialog(null)} />}
          {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
        </Suspense>
      )}
    </div>
  );
}
