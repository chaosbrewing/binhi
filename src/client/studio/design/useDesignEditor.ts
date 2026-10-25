import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type ProjectDetail } from "../../api.js";
import { DesignDocument, makeLayer, type DesignLayer } from "../../../core/creative/index.js";
import type { ProjectKind } from "../../../core/creative/index.js";

export type SaveState = "saved" | "unsaved" | "saving" | "conflict" | "error";
const HISTORY = 60;
const AUTOSAVE_MS = 800;

export interface DesignEditorState {
  project: ProjectDetail<DesignDocument> | null;
  doc: DesignDocument | null;
  selectedId: string | null;
  saveState: SaveState;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Design document state with undo/redo and a debounced autosave that uses the
 * project's revision for optimistic concurrency. Every change is validated
 * locally with the same schema the server enforces, so invalid edits never
 * leave the browser.
 */
export function useDesignEditor(projectId: string | undefined) {
  const [project, setProject] = useState<ProjectDetail<DesignDocument> | null>(null);
  const [doc, setDoc] = useState<DesignDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const docRef = useRef<DesignDocument | null>(null);
  const revisionRef = useRef(0);
  const nameRef = useRef("");
  const timer = useRef<number | null>(null);
  const inflight = useRef(false);
  const dirty = useRef(false);
  const active = useRef(true);
  docRef.current = doc;

  useEffect(() => {
    active.current = true;
    if (!projectId) return;
    setProject(null);
    setDoc(null);
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setError(null);
    api.project<DesignDocument>(projectId)
      .then(({ project }) => {
        if (!active.current) return;
        const parsed = DesignDocument.safeParse(project.document);
        if (!parsed.success) throw new Error("This design could not be read.");
        revisionRef.current = project.revision;
        nameRef.current = project.name;
        setProject(project);
        setDoc(parsed.data);
        setSaveState("saved");
      })
      .catch((e) => active.current && setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not load this design"));
    return () => {
      active.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [projectId]);

  const flush = useCallback(async () => {
    if (!projectId || inflight.current || !dirty.current || !docRef.current) return;
    inflight.current = true;
    dirty.current = false;
    setSaveState("saving");
    try {
      const { project: saved } = await api.updateProject<DesignDocument>(projectId, { document: docRef.current, name: nameRef.current, baseRevision: revisionRef.current });
      revisionRef.current = saved.revision;
      if (active.current) {
        setProject(saved);
        setSaveState(dirty.current ? "unsaved" : "saved");
      }
    } catch (e) {
      if (!active.current) return;
      if (e instanceof ApiError && e.status === 409) {
        setSaveState("conflict");
        setError("This design was changed somewhere else. Reload to continue from the latest copy.");
      } else {
        dirty.current = true;
        setSaveState("error");
        setError(e instanceof ApiError ? e.message : "Could not save. Your changes are kept here until the connection returns.");
      }
    } finally {
      inflight.current = false;
      if (dirty.current && active.current) schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const commit = useCallback((next: DesignDocument, record = true) => {
    const parsed = DesignDocument.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That change is not allowed");
      return false;
    }
    const current = docRef.current;
    if (record && current) {
      setPast((p) => [...p.slice(-(HISTORY - 1)), current]);
      setFuture([]);
    }
    setDoc(parsed.data);
    docRef.current = parsed.data;
    dirty.current = true;
    setError(null);
    setSaveState((s) => (s === "conflict" ? s : "unsaved"));
    schedule();
    return true;
  }, [schedule]);

  const updateLayer = useCallback((id: string, patch: Partial<DesignLayer>, record = true) => {
    const current = docRef.current;
    if (!current) return;
    commit({ ...current, layers: current.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as DesignLayer) : l)) }, record);
  }, [commit]);

  const addLayer = useCallback((type: DesignLayer["type"], extra: Record<string, unknown> = {}) => {
    const current = docRef.current;
    if (!current) return;
    const layer = makeLayer(type, current, extra);
    if (commit({ ...current, layers: [...current.layers, layer] })) setSelectedId(layer.id);
  }, [commit]);

  const removeLayer = useCallback((id: string) => {
    const current = docRef.current;
    if (!current) return;
    commit({ ...current, layers: current.layers.filter((l) => l.id !== id) });
    setSelectedId((s) => (s === id ? null : s));
  }, [commit]);

  const duplicateLayer = useCallback((id: string) => {
    const current = docRef.current;
    const source = current?.layers.find((l) => l.id === id);
    if (!current || !source) return;
    const copy = makeLayer(source.type, current, { ...source, id: undefined, x: source.x + 24, y: source.y + 24, name: source.name ? `${source.name} copy` : "" });
    if (commit({ ...current, layers: [...current.layers, copy] })) setSelectedId(copy.id);
  }, [commit]);

  const pasteLayer = useCallback((source: DesignLayer) => {
    const current = docRef.current;
    if (!current) return;
    const copy = makeLayer(source.type, current, { ...source, id: undefined, x: source.x + 24, y: source.y + 24, locked: false, name: source.name ? `${source.name} copy` : "" });
    if (commit({ ...current, layers: [...current.layers, copy] })) setSelectedId(copy.id);
  }, [commit]);

  const moveLayer = useCallback((id: string, direction: -1 | 1 | "front" | "back") => {
    const current = docRef.current;
    if (!current) return;
    const index = current.layers.findIndex((l) => l.id === id);
    if (index < 0) return;
    const layers = [...current.layers];
    const [layer] = layers.splice(index, 1);
    const target = direction === "front" ? layers.length : direction === "back" ? 0 : Math.max(0, Math.min(layers.length, index + direction));
    layers.splice(target, 0, layer!);
    commit({ ...current, layers });
  }, [commit]);

  const setBackground = useCallback((background: string) => {
    const current = docRef.current;
    if (current) commit({ ...current, background });
  }, [commit]);

  const resize = useCallback((width: number, height: number) => {
    const current = docRef.current;
    if (current) commit({ ...current, width, height });
  }, [commit]);

  const undo = useCallback(() => {
    const current = docRef.current;
    if (!current || !past.length) return;
    const previous = past[past.length - 1]!;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f].slice(0, HISTORY));
    commit(previous, false);
  }, [past, commit]);

  const redo = useCallback(() => {
    const current = docRef.current;
    if (!current || !future.length) return;
    const next = future[0]!;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current].slice(-HISTORY));
    commit(next, false);
  }, [future, commit]);

  const rename = useCallback((name: string) => {
    nameRef.current = name.trim().slice(0, 80) || nameRef.current;
    setProject((p) => (p ? { ...p, name: nameRef.current } : p));
    dirty.current = true;
    setSaveState((s) => (s === "conflict" ? s : "unsaved"));
    schedule();
  }, [schedule]);

  const reloadFromServer = useCallback(async () => {
    if (!projectId) return;
    const { project: fresh } = await api.project<DesignDocument>(projectId);
    const parsed = DesignDocument.parse(fresh.document);
    revisionRef.current = fresh.revision;
    nameRef.current = fresh.name;
    dirty.current = false;
    setProject(fresh);
    setDoc(parsed);
    docRef.current = parsed;
    setPast([]);
    setFuture([]);
    setError(null);
    setSaveState("saved");
  }, [projectId]);

  const saveNow = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    await flush();
  }, [flush]);

  const saveAs = useCallback(async (kind: ProjectKind, name: string) => {
    if (!projectId) throw new Error("Nothing to copy yet");
    await saveNow();
    return (await api.duplicateProject(projectId, { kind, name })).project;
  }, [projectId, saveNow]);

  return {
    state: { project, doc, selectedId, saveState, error, canUndo: past.length > 0, canRedo: future.length > 0 } as DesignEditorState,
    select: setSelectedId,
    commit,
    updateLayer,
    addLayer,
    removeLayer,
    duplicateLayer,
    pasteLayer,
    moveLayer,
    setBackground,
    resize,
    undo,
    redo,
    rename,
    saveNow,
    saveAs,
    reloadFromServer,
    clearError: () => setError(null),
  };
}
