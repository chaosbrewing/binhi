import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { initialRecipe, PHOTO_LIMITS, validateRecipe, type PhotoRecipe, type RasterMime } from "../../../core/media/photo.js";
import { decodePhoto, renderPhoto, type DecodedPhoto } from "./engine.js";
import { localPhotoRepository } from "./repository.js";
import type { PhotoDocument, PhotoExport, PhotoStudio, PhotoSummary } from "./types.js";
import type { SiteSummary } from "../../api.js";

export function usePhotoStudio(): PhotoStudio {
  const { user } = useAuth();
  const ownerId = user?.id ?? "";
  const [doc, setDoc] = useState<PhotoDocument | null>(null);
  const [projects, setProjects] = useState<PhotoSummary[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [exported, setExported] = useState<PhotoExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose a photo. It stays in your browser until you explicitly upload an export.");
  const [past, setPast] = useState<PhotoRecipe[]>([]);
  const [future, setFuture] = useState<PhotoRecipe[]>([]);
  const decoded = useRef<DecodedPhoto | null>(null);
  const active = useRef(true);
  const operation = useRef(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const previewRef = useRef<string | null>(null);
  const originalRef = useRef<string | null>(null);
  const exportRef = useRef<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "The photo operation failed.");
  const refresh = async () => { if (ownerId) setProjects(await localPhotoRepository.list(ownerId)); };
  const clearExport = () => {
    if (exportRef.current) URL.revokeObjectURL(exportRef.current);
    exportRef.current = null;
    setExported(null);
  };
  useEffect(() => {
    active.current = true;
    void refresh().catch(fail);
    void api.sites().then(result => { if (active.current) setSites(result.sites); }).catch(fail);
    return () => {
      active.current = false;
      decoded.current?.bitmap.close();
      decoded.current = null;
      for (const value of [previewRef.current, originalRef.current, exportRef.current]) if (value) URL.revokeObjectURL(value);
    };
  }, [ownerId]);

  useEffect(() => {
    if (!doc || !decoded.current) return;
    let cancelled = false;
    clearExport();
    const photo = decoded.current;
    const timer = window.setTimeout(() => {
      void renderPhoto(photo, doc.recipe, "image/png", 1, true).then(blob => {
        if (cancelled || !active.current) return;
        const url = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        setPreviewUrl(url);
      }).catch(e => { if (!cancelled) fail(e); });
    }, 160);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [doc?.recipe, doc?.id]);

  const run = async (work: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try { await work(); } catch (e) { if (active.current) fail(e); }
    finally { operation.current = false; if (active.current) setBusy(false); }
  };

  const activate = (next: PhotoDocument, photo: DecodedPhoto) => {
    decoded.current?.bitmap.close();
    decoded.current = photo;
    if (originalRef.current) URL.revokeObjectURL(originalRef.current);
    originalRef.current = URL.createObjectURL(photo.source);
    setOriginalUrl(originalRef.current);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setPast([]); setFuture([]);
    clearExport();
    setDoc(next);
    setStatus("Photo ready. Edits are reversible; save a browser draft before leaving.");
  };

  const change = (recipe: PhotoRecipe, history = true) => {
    if (!doc || operation.current) return;
    try {
      const next = validateRecipe(recipe, doc.info);
      if (history) { setPast(value => [...value.slice(-29), doc.recipe]); setFuture([]); }
      setDoc({ ...doc, recipe: next });
      clearExport();
      setError(null);
      setStatus("Unsaved browser changes — save a draft or download before leaving.");
    } catch (e) { fail(e); }
  };

  return {
    document: doc, recipe: doc?.recipe ?? null, projects, sites, previewUrl, originalUrl, busy, error, status, exported,
    canUndo: past.length > 0, canRedo: future.length > 0,
    loadFile: file => run(async () => {
      if (!ownerId) throw new Error("Sign in before editing photos.");
      const photo = await decodePhoto(file);
      if (!active.current) { photo.bitmap.close(); return; }
      const now = new Date().toISOString();
      activate({ id: crypto.randomUUID(), ownerId, name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        schemaVersion: 1, revision: 0, createdAt: now, updatedAt: now, source: photo.source, info: photo.info, recipe: initialRecipe(photo.info) }, photo);
    }),
    updateRecipe: patch => {
      if (!doc) return;
      const swap = patch.rotation !== undefined && patch.rotation % 180 !== doc.recipe.rotation % 180;
      change({ ...doc.recipe, ...(swap ? { width: doc.recipe.height, height: doc.recipe.width } : {}), ...patch });
    },
    undo: () => {
      if (!doc || !past.length || operation.current) return;
      const previous = past[past.length - 1]!;
      setFuture(value => [doc.recipe, ...value].slice(0, 30));
      setPast(value => value.slice(0, -1));
      change(previous, false);
    },
    redo: () => {
      if (!doc || !future.length || operation.current) return;
      setPast(value => [...value, doc.recipe].slice(-30));
      const next = future[0]!;
      setFuture(value => value.slice(1));
      change(next, false);
    },
    reset: () => { if (doc) change(initialRecipe(doc.info)); },
    saveDraft: name => run(async () => {
      const current = docRef.current;
      if (!current || current.ownerId !== ownerId) throw new Error("Open a photo first.");
      const saved = await localPhotoRepository.save(ownerId, { ...current, name: name ?? current.name });
      if (!active.current) return;
      setDoc(saved);
      await refresh();
      setStatus(`Saved in this browser · revision ${saved.revision}. Not a cloud backup.`);
    }),
    openDraft: id => run(async () => {
      const next = await localPhotoRepository.get(ownerId, id);
      const photo = await decodePhoto(next.source);
      try { validateRecipe(next.recipe, photo.info); }
      catch (e) { photo.bitmap.close(); throw e; }
      if (!active.current) { photo.bitmap.close(); return; }
      activate(next, photo);
      setStatus(`Opened browser draft · revision ${next.revision}.`);
    }),
    deleteDraft: id => run(async () => {
      await localPhotoRepository.remove(ownerId, id);
      await refresh();
      if (doc?.id === id) setDoc({ ...doc, id: crypto.randomUUID(), revision: 0 });
      setStatus("Browser draft deleted. Any open image is still available to export.");
    }),
    exportImage: (mime: RasterMime, quality: number) => run(async () => {
      if (!doc || !decoded.current) throw new Error("Open a photo first.");
      clearExport();
      const blob = await renderPhoto(decoded.current, doc.recipe, mime, quality);
      if (!active.current) return;
      clearExport();
      const url = URL.createObjectURL(blob);
      exportRef.current = url;
      setExported({ blob, url, mimeType: mime, width: doc.recipe.width, height: doc.recipe.height,
        byteSize: blob.size, savingsPercent: (1 - blob.size / doc.source.size) * 100 });
      setStatus("Export verified from actual encoded bytes. Download it or explicitly upload the exported copy.");
    }),
    saveToWebsite: siteId => run(async () => {
      if (!exported || !doc) throw new Error("Generate a verified export first.");
      if (!sites.some(site => site.id === siteId)) throw new Error("Choose one of your own websites.");
      if (exported.byteSize > PHOTO_LIMITS.inputBytes) throw new Error("This export exceeds the website media upload limit of 8 MiB. Resize or lower JPEG/WebP quality first.");
      const ext = exported.mimeType === "image/jpeg" ? "jpg" : exported.mimeType.split("/")[1];
      const file = new File([exported.blob], `${doc.name.replace(/[^a-z0-9_-]/gi, "-")}.${ext}`, { type: exported.mimeType });
      await api.upload(siteId, file, "", "Studio exports");
      setStatus("Export saved to your website media library. Its media URL is public.");
    }),
  };
}
