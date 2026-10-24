import { z } from "zod";
import { DesignDocument, designAssetIds } from "./design.js";
import { BrandKitDocument } from "./brandKit.js";
import { PhotoProjectDocument, photoProjectAssetIds } from "./photoProject.js";

export * from "./design.js";
export * from "./brandKit.js";
export * from "./photoProject.js";

/**
 * Project kinds share one list, one ownership rule and one revision model,
 * but each kind has its own validated document. Website projects stay in
 * `binhi_sites`; the dashboard merges them read-only.
 */
export const PROJECT_KINDS = ["photo", "design", "design-template"] as const;
export const ProjectKind = z.enum(PROJECT_KINDS);
export type ProjectKind = z.infer<typeof ProjectKind>;

export function parseProjectDocument(kind: ProjectKind, value: unknown): PhotoProjectDocument | DesignDocument {
  switch (kind) {
    case "photo":
      return PhotoProjectDocument.parse(value);
    case "design":
    case "design-template":
      return DesignDocument.parse(value);
  }
}

/** Asset library ids a document depends on; used for usage tracking and delete protection. */
export function projectAssetIds(kind: ProjectKind, document: unknown): string[] {
  switch (kind) {
    case "photo":
      return photoProjectAssetIds(PhotoProjectDocument.parse(document));
    case "design":
    case "design-template":
      return designAssetIds(DesignDocument.parse(document));
  }
}

export { BrandKitDocument };
