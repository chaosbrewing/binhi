import { z } from "zod";
import { Color } from "../schema/document.js";
import { getIcon, ICON_ID_PATTERN, iconSupportsVariant } from "./registry.js";
import { ICON_MAX_SIZE, ICON_MIN_SIZE, ICON_STROKE_DEFAULT, ICON_STROKE_MAX, ICON_STROKE_MIN, ICON_VARIANTS, type IconVariant } from "./render.js";

/**
 * Presentation settings shared by the Website Builder `icon` component and the Design Studio `icon` layer.
 * The canonical asset id is the only thing that selects geometry; nothing here can carry markup.
 */
export const IconAssetId = z.string().max(80)
  .refine(id => ICON_ID_PATTERN.test(id) || /^ICN-(00[1-9]|0[1-9]\d|1\d\d|2[0-4]\d|250)$/.test(id), "invalid icon id")
  .transform(id => getIcon(id)?.id ?? id);

export const IconGradientSpec = z.object({
  from: Color,
  to: Color,
  angle: z.number().min(0).max(360).default(45),
});

export const IconPresentation = z.object({
  variant: z.enum(ICON_VARIANTS as unknown as [IconVariant, ...IconVariant[]]).default("outline"),
  strokeWidth: z.number().min(ICON_STROKE_MIN).max(ICON_STROKE_MAX).default(ICON_STROKE_DEFAULT),
  rotation: z.number().min(-360).max(360).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  gradient: IconGradientSpec.optional(),
});
export type IconPresentation = z.infer<typeof IconPresentation>;

export const IconSizeSpec = z.number().min(ICON_MIN_SIZE).max(ICON_MAX_SIZE);

/** Cross-field rules: the id must resolve in the registry and the variant must be one that icon supports. */
export function iconUsageProblem(id: string, variant: IconVariant | undefined): string | null {
  const def = getIcon(id);
  if (!def) return `unknown icon ${id}`;
  if (def.deprecated?.replacedBy) return null; // deprecated icons keep rendering; the UI suggests the replacement
  if (variant && !iconSupportsVariant(id, variant)) return `${def.name} does not support the ${variant} variant`;
  return null;
}
