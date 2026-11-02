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

// Every message is written for the person typing, with the real limit in it, so a limit
// can never disagree with its message. The server sends these as issue messages; the
// browser shows the first one as it is.
const Tag = z
  .string()
  .trim()
  .min(1, "Remove the empty tag.")
  .max(PERSONAL_LIMITS.tagLength, `Each tag must be ${PERSONAL_LIMITS.tagLength} characters or fewer.`)
  .regex(NO_CONTROL, "Tags cannot contain control characters.")
  .transform((t) => slugify(t))
  .refine((t) => t.length > 0, "Each tag needs at least one letter or number.");

/** What `PATCH /mine/:projectId` accepts. `null` clears a field. Anything else is rejected. */
export const PersonalMetaPatch = z
  .object({
    description: z.string().trim().max(PERSONAL_LIMITS.description, `The description must be ${PERSONAL_LIMITS.description} characters or fewer.`).regex(NO_CONTROL, "The description cannot contain line breaks.").nullable().optional(),
    category: z.string().refine((id) => CATEGORY_IDS.includes(id), "Choose a category from the list.").nullable().optional(),
    tags: z.array(Tag).max(PERSONAL_LIMITS.tags, `You can add up to ${PERSONAL_LIMITS.tags} tags.`).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();
export type PersonalMetaPatch = z.infer<typeof PersonalMetaPatch>;

/** Tags are stored once each, in the order given. */
export function uniqueTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags));
}
