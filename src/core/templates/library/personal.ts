/**
 * Limits and validation for what a person can attach to their own saved
 * templates and to their favorites. Shared by the server (which enforces it)
 * and the browser (which uses the same limits for its inputs). Text is plain
 * text: it is shown as text and never interpreted as markup.
 */
import { z } from "zod";
import { CATEGORIES, slugify } from "./taxonomy.js";

export const PERSONAL_LIMITS = { description: 280, tags: 8, tagLength: 30, favorites: 200 } as const;

export const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

// No control characters (newlines included): a description is one short line of text.
const NO_CONTROL = /^[^\u0000-\u001f\u007f]*$/;

const Tag = z
  .string()
  .trim()
  .min(1)
  .max(PERSONAL_LIMITS.tagLength)
  .regex(NO_CONTROL, "Tags cannot contain control characters")
  .transform((t) => slugify(t))
  .refine((t) => t.length > 0, "Tags need at least one letter or number");

/** What `PATCH /mine/:projectId` accepts. `null` clears a field. Anything else is rejected. */
export const PersonalMetaPatch = z
  .object({
    description: z.string().trim().max(PERSONAL_LIMITS.description).regex(NO_CONTROL, "The description cannot contain line breaks").nullable().optional(),
    category: z.string().refine((id) => CATEGORY_IDS.includes(id), "Choose a category from the list").nullable().optional(),
    tags: z.array(Tag).max(PERSONAL_LIMITS.tags).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export type PersonalMetaPatch = z.infer<typeof PersonalMetaPatch>;

/** Tags are stored once each, in the order given. */
export function uniqueTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags));
}
