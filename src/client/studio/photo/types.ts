import type { RasterInfo, PhotoRecipe, RasterMime } from "../../../core/media/photo.js";
import type { SiteSummary } from "../../api.js";

export type PhotoDocument = {
  id: string; ownerId: string; name: string; schemaVersion: 1; revision: number;
  createdAt: string; updatedAt: string; source: Blob; info: RasterInfo; recipe: PhotoRecipe;
};
export type PhotoSummary = Omit<PhotoDocument, "source" | "recipe">;
export type PhotoExport = {
  blob: Blob; url: string; mimeType: RasterMime; width: number; height: number;
  byteSize: number; savingsPercent: number;
};
export type PhotoStudio = {
  document: PhotoDocument | null; recipe: PhotoRecipe | null;
  projects: PhotoSummary[]; sites: SiteSummary[];
  previewUrl: string | null; originalUrl: string | null;
  busy: boolean; error: string | null; status: string;
  exported: PhotoExport | null; canUndo: boolean; canRedo: boolean;
  loadFile: (file: File) => Promise<void>;
  updateRecipe: (patch: Partial<PhotoRecipe>) => void;
  undo: () => void; redo: () => void; reset: () => void;
  saveDraft: (name?: string) => Promise<void>;
  openDraft: (id: string) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  exportImage: (mime: RasterMime, quality: number) => Promise<void>;
  saveToWebsite: (siteId: string) => Promise<void>;
};
