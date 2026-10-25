import type { RasterInfo, PhotoRecipe, RasterMime } from "../../../core/media/photo.js";
import type { ProjectSummary, SiteSummary } from "../../api.js";

/** The photo open in the editor. `projectId`/`sourceAssetId` are null until the first save. */
export type OpenPhoto = {
  projectId: string | null;
  sourceAssetId: string | null;
  name: string;
  revision: number;
  source: Blob;
  info: RasterInfo;
  recipe: PhotoRecipe;
  /** True when the recipe or name differs from the last saved state. */
  dirty: boolean;
};
export type PhotoExport = {
  blob: Blob; url: string; mimeType: RasterMime; width: number; height: number;
  byteSize: number; savingsPercent: number;
};
export type PhotoStudio = {
  photo: OpenPhoto | null; recipe: PhotoRecipe | null;
  projects: ProjectSummary[]; sites: SiteSummary[];
  previewUrl: string | null; originalUrl: string | null;
  busy: boolean; loading: boolean; error: string | null; status: string;
  exported: PhotoExport | null; canUndo: boolean; canRedo: boolean;
  loadFile: (file: File) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  updateRecipe: (patch: Partial<PhotoRecipe>) => void;
  undo: () => void; redo: () => void; reset: () => void;
  save: (name?: string) => Promise<string | null>;
  exportImage: (mime: RasterMime, quality: number) => Promise<void>;
  saveToWebsite: (siteId: string) => Promise<void>;
};
