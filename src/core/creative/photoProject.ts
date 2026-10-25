import { z } from "zod";
import { PhotoRecipe, RasterMime, validateRecipe } from "../media/photo.js";
import { ID_PATTERN } from "../ids.js";

/**
 * A saved photo project: an immutable original in the private asset library
 * plus the non-destructive recipe applied to it. Exports are derived on
 * demand; the original is never modified.
 */
export const PHOTO_PROJECT_SCHEMA_VERSION = 1;

export const PhotoProjectDocument = z
  .object({
    schemaVersion: z.literal(PHOTO_PROJECT_SCHEMA_VERSION),
    sourceAssetId: z.string().regex(ID_PATTERN),
    source: z.object({ mimeType: RasterMime, width: z.number().int().positive(), height: z.number().int().positive() }),
    recipe: PhotoRecipe,
  })
  .strict()
  .superRefine((doc, ctx) => {
    try {
      validateRecipe(doc.recipe, doc.source);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipe"], message: e instanceof Error ? e.message : "Invalid recipe" });
    }
  });
export type PhotoProjectDocument = z.infer<typeof PhotoProjectDocument>;

export function photoProjectAssetIds(doc: PhotoProjectDocument): string[] {
  return [doc.sourceAssetId];
}
