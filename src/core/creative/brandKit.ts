import { z } from "zod";
import { Color, FontName } from "../schema/document.js";
import { ID_PATTERN } from "../ids.js";

/**
 * A brand kit is the small, reusable set of decisions every tool should
 * respect: colours, two fonts and a logo. It is stored once per account and
 * applied explicitly; nothing changes a website or design until the owner
 * chooses to apply the kit.
 */
export const BRAND_KIT_SCHEMA_VERSION = 1;
export const BRAND_KIT_LIMITS = { maxColors: 12, maxKits: 20 } as const;

export const BrandColor = z.object({
  name: z.string().trim().min(1).max(40),
  value: Color,
});

export const BrandKitDocument = z
  .object({
    schemaVersion: z.literal(BRAND_KIT_SCHEMA_VERSION),
    colors: z.array(BrandColor).min(1).max(BRAND_KIT_LIMITS.maxColors),
    fonts: z.object({ heading: FontName, body: FontName }),
    /** Asset library id of the logo, if one was chosen. */
    logoAssetId: z.string().regex(ID_PATTERN).nullable().default(null),
    tagline: z.string().trim().max(120).default(""),
  })
  .strict();
export type BrandKitDocument = z.infer<typeof BrandKitDocument>;

export function createBrandKitDocument(): BrandKitDocument {
  return BrandKitDocument.parse({
    schemaVersion: BRAND_KIT_SCHEMA_VERSION,
    colors: [
      { name: "Primary", value: "#1f6f4a" },
      { name: "Accent", value: "#e0397a" },
      { name: "Ink", value: "#15201a" },
      { name: "Paper", value: "#f4f7f5" },
    ],
    fonts: { heading: "Inter", body: "Inter" },
    logoAssetId: null,
    tagline: "",
  });
}

export function brandKitAssetIds(doc: BrandKitDocument): string[] {
  return doc.logoAssetId ? [doc.logoAssetId] : [];
}

/**
 * Map a kit onto the website theme patch understood by the `updateTheme`
 * operation. The first colour becomes primary, the second the accent; ink and
 * paper are detected by name when present so a kit's roles stay explicit.
 */
export function brandKitToThemePatch(doc: BrandKitDocument): { colors: Record<string, string>; fonts: { heading: FontName; body: FontName }; palette: string[] } {
  const byName = (needle: string) => doc.colors.find((c) => c.name.toLowerCase().includes(needle))?.value;
  const colors: Record<string, string> = {};
  const primary = byName("primary") ?? doc.colors[0]!.value;
  const accent = byName("accent") ?? doc.colors[1]?.value ?? primary;
  colors.primary = primary;
  colors.accent = accent;
  const text = byName("ink") ?? byName("text");
  const background = byName("paper") ?? byName("background");
  if (text) colors.text = text;
  if (background) colors.background = background;
  return { colors, fonts: doc.fonts, palette: doc.colors.map((c) => c.value) };
}
