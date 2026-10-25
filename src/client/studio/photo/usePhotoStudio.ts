import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ProjectSummary, type SiteSummary } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { initialRecipe, PHOTO_LIMITS, validateRecipe, type PhotoRecipe, type RasterMime } from "../../../core/media/photo.js";
import type { PhotoProjectDocument } from "../../../core/creative/index.js";
import { decodePhoto, renderPhoto, type DecodedPhoto } from "./engine.js";
import type { OpenPhoto, PhotoExport, PhotoStudio } from "./types.js";

const HISTORY = 30;

/**
 * Photo editing state. The original is decoded once and kept immutable; every
 * edit is a validated recipe. Saving stores the original privately in the
 * asset library (once) and the recipe in a photo project, so the work can be
 * reopened from any device. Nothing is uploaded until the owner saves.
 */
export function usePhotoStudio(): PhotoStudio {
  const { user } = useAuth();
  const ownerId = user?.id ?? "";
  const [photo, setPhoto] = useState<OpenPhoto | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [exported, setExported] = useState<PhotoExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose a photo. It stays on this device until you save it to your projects.");
  const [past, setPast] = useState<PhotoRecipe[]>([]);
  const [future, setFuture] = useState<PhotoRecipe[]>([]);
  const decoded = useRef<DecodedPhoto | null>(null);
  const active = useRef(true);
  const operation = useRef(false);
  const photoRef = useRef(photo);
  photoRef.current = photo;
  const previewRef = useRef<string | null>(null);
  const originalRef = useRef<string | null>(null);
  const exportRef = useRef<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "The photo operation failed.");
  const refresh = async () => {
    const [p, s] = await Promise.all([api.projects("photo"), api.sites()]);
    if (!active.current) return;
    setProjects(p.projects);
    setSites(s.sites);
  };
  const clearExport = () => {
    if (exportRef.current) URL.revokeObjectURL(exportRef.current);
    exportRef.current = null;
    setExported(null);
  };
  useEffect(() => {
    active.current = true;
    void refresh().catch(fail);
    return () => {
      active.current = false;
      decoded.current?.bitmap.close();
      decoded.current = null;
      for (const value of [previewRef.current, originalRef.current, exportRef.current]) if (value) URL.revokeObjectURL(value);
    };
  }, [ownerId]);

  useEffect(() => {
    if (!photo || !decoded.current) return;
    let cancelled = false;
    clearExport();
    const source = decoded.current;
    const timer = window.setTimeout(() => {
      void renderPhoto(source, photo.recipe, "image/png", 1, true).then((blob) => {
        if (cancelled || !active.current) return;
        const url = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        setPreviewUrl(url);
      }).catch((e) => { if (!cancelled) fail(e); });
    }, 160);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [photo?.recipe, photo?.sourceAssetId, photo?.source]);

  const run = async <T,>(work: () => Promise<T>, fallback: T): Promise<T> => {
    if (operation.current) return fallback;
    operation.current = true;
    setBusy(true);
    setError(null);
    try { return await work(); } catch (e) { if (active.current) fail(e); return fallback; }
    finally { operation.current = false; if (active.current) setBusy(false); }
  };

  const activate = (next: OpenPhoto, source: DecodedPhoto, message: string) => {
    decoded.current?.bitmap.close();
    decoded.current = source;
    if (originalRef.current) URL.revokeObjectURL(originalRef.current);
    originalRef.current = URL.createObjectURL(source.source);
    setOriginalUrl(originalRef.current);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setPast([]);
    setFuture([]);
    clearExport();
    setPhoto(next);
    setStatus(message);
  };

  const change = (recipe: PhotoRecipe, history = true) => {
    const current = photoRef.current;
    if (!current || operation.current) return;
    try {
      const next = validateRecipe(recipe, current.info);
      if (history) { setPast((value) => [...value.slice(-(HISTORY - 1)), current.recipe]); setFuture([]); }
      setPhoto({ ...current, recipe: next, dirty: true });
      clearExport();
      setError(null);
      setStatus(current.projectId ? "Unsaved changes — save to keep them in your project." : "Unsaved changes — save to your projects or download an export.");
    } catch (e) { fail(e); }
  };

  return {
    photo, recipe: photo?.recipe ?? null, projects, sites, previewUrl, originalUrl, busy, loading, error, status, exported,
    canUndo: past.length > 0, canRedo: future.length > 0,
    loadFile: (file) => run(async () => {
      if (!ownerId) throw new Error("Sign in before editing photos.");
      const source = await decodePhoto(file);
      if (!active.current) { source.bitmap.close(); return; }
      activate({ projectId: null, sourceAssetId: null, name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled photo", revision: 0, source: source.source, info: source.info, recipe: initialRecipe(source.info), dirty: true }, source,
        "Photo ready. Edits are reversible; save to your projects to keep them.");
    }, undefined),
    openProject: (id) => run(async () => {
      setLoading(true);
      try {
        const { project } = await api.project<PhotoProjectDocument>(id);
        const res = await fetch(`/api/library/${project.document.sourceAssetId}/file`, { credentials: "same-origin", headers: { "x-binhi-request": "editor" } });
        if (!res.ok) throw new Error(res.status === 404 ? "The original image for this project is no longer in your asset library." : "Could not load the original image.");
        const blob = await res.blob();
        const source = await decodePhoto(blob);
        try { validateRecipe(project.document.recipe, source.info); } catch (e) { source.bitmap.close(); throw e; }
        if (!active.current) { source.bitmap.close(); return; }
        activate({ projectId: project.id, sourceAssetId: project.document.sourceAssetId, name: project.name, revision: project.revision, source: blob, info: source.info, recipe: project.document.recipe, dirty: false }, source,
          `Opened "${project.name}" · revision ${project.revision}.`);
      } finally { if (active.current) setLoading(false); }
    }, undefined),
    updateRecipe: (patch) => {
      const current = photoRef.current;
      if (!current) return;
      const swap = patch.rotation !== undefined && patch.rotation % 180 !== current.recipe.rotation % 180;
      change({ ...current.recipe, ...(swap ? { width: current.recipe.height, height: current.recipe.width } : {}), ...patch });
    },
    undo: () => {
      const current = photoRef.current;
      if (!current || !past.length || operation.current) return;
      const previous = past[past.length - 1]!;
      setFuture((value) => [current.recipe, ...value].slice(0, HISTORY));
      setPast((value) => value.slice(0, -1));
      change(previous, false);
    },
    redo: () => {
      const current = photoRef.current;
      if (!current || !future.length || operation.current) return;
      setPast((value) => [...value, current.recipe].slice(-HISTORY));
      const next = future[0]!;
      setFuture((value) => value.slice(1));
      change(next, false);
    },
    reset: () => { const current = photoRef.current; if (current) change(initialRecipe(current.info)); },
    save: (name) => run(async () => {
      const current = photoRef.current;
      if (!current) throw new Error("Open a photo first.");
      const nextName = (name ?? current.name).trim().slice(0, 80) || "Untitled photo";
      let sourceAssetId = current.sourceAssetId;
      if (!sourceAssetId) {
        const ext = current.info.mimeType === "image/jpeg" ? "jpg" : current.info.mimeType.split("/")[1];
        const file = new File([current.source], `${nextName.replace(/[^a-z0-9_-]/gi, "-")}.${ext}`, { type: current.info.mimeType });
        const uploaded = await api.uploadToLibrary(file, { filename: file.name, origin: "photo-original", tags: "photo original" });
        sourceAssetId = uploaded.asset.id;
      }
      const document: PhotoProjectDocument = { schemaVersion: 1, sourceAssetId, source: current.info, recipe: current.recipe };
      let saved;
      try {
        saved = current.projectId
          ? (await api.updateProject<PhotoProjectDocument>(current.projectId, { name: nextName, document, baseRevision: current.revision })).project
          : (await api.createProject<PhotoProjectDocument>("photo", nextName, document)).project;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) throw new Error("This project was changed somewhere else. Reopen it from My Projects before saving; you can still download your current export.");
        throw e;
      }
      if (!active.current) return saved.id;
      setPhoto({ ...current, projectId: saved.id, sourceAssetId, name: saved.name, revision: saved.revision, dirty: false });
      setStatus(`Saved to your projects · revision ${saved.revision}. The original stays private in your asset library.`);
      void refresh().catch(fail);
      return saved.id;
    }, null),
    exportImage: (mime: RasterMime, quality: number) => run(async () => {
      const current = photoRef.current;
      if (!current || !decoded.current) throw new Error("Open a photo first.");
      clearExport();
      const blob = await renderPhoto(decoded.current, current.recipe, mime, quality);
      if (!active.current) return;
      clearExport();
      const url = URL.createObjectURL(blob);
      exportRef.current = url;
      setExported({ blob, url, mimeType: mime, width: current.recipe.width, height: current.recipe.height, byteSize: blob.size, savingsPercent: (1 - blob.size / current.source.size) * 100 });
      setStatus("Export verified from the actual encoded bytes. Download it, or send the exported copy to a website.");
    }, undefined),
    saveToWebsite: (siteId) => run(async () => {
      const current = photoRef.current;
      if (!exported || !current) throw new Error("Generate a verified export first.");
      if (!sites.some((site) => site.id === siteId)) throw new Error("Choose one of your own websites.");
      if (exported.byteSize > PHOTO_LIMITS.inputBytes) throw new Error("This export exceeds the website media upload limit of 8 MiB. Resize or lower JPEG/WebP quality first.");
      const ext = exported.mimeType === "image/jpeg" ? "jpg" : exported.mimeType.split("/")[1];
      const file = new File([exported.blob], `${current.name.replace(/[^a-z0-9_-]/gi, "-")}.${ext}`, { type: exported.mimeType });
      await api.upload(siteId, file, "", "Studio exports");
      setStatus("Export saved to your website media library. Its media URL is public.");
    }, undefined),
  };
}
