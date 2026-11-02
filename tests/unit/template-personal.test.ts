import { describe, it, expect } from "vitest";
import { PERSONAL_LIMITS, PersonalMetaPatch } from "../../src/core/templates/library/personal.js";

/** First issue message for an input, or null when it is valid. */
function firstMessage(input: unknown): string | null {
  const r = PersonalMetaPatch.safeParse(input);
  return r.success ? null : (r.error.issues[0]?.message ?? "");
}

describe("personal template details: validation messages are written for the person typing", () => {
  it("names the real limit for a tag that is too long", () => {
    expect(firstMessage({ tags: ["x".repeat(PERSONAL_LIMITS.tagLength + 1)] })).toBe(`Each tag must be ${PERSONAL_LIMITS.tagLength} characters or fewer.`);
    expect(firstMessage({ tags: ["x".repeat(PERSONAL_LIMITS.tagLength)] })).toBeNull();
  });

  it("names the real limit for too many tags", () => {
    expect(firstMessage({ tags: Array.from({ length: PERSONAL_LIMITS.tags + 1 }, (_, i) => `t${i}`) })).toBe(`You can add up to ${PERSONAL_LIMITS.tags} tags.`);
    expect(firstMessage({ tags: Array.from({ length: PERSONAL_LIMITS.tags }, (_, i) => `t${i}`) })).toBeNull();
  });

  it("explains empty and symbol-only tags", () => {
    expect(firstMessage({ tags: ["   "] })).toBe("Remove the empty tag.");
    expect(firstMessage({ tags: ["!!!"] })).toBe("Each tag needs at least one letter or number.");
    expect(firstMessage({ tags: ["a\u0007b"] })).toBe("Tags cannot contain control characters.");
  });

  it("explains description and category problems", () => {
    expect(firstMessage({ description: "x".repeat(PERSONAL_LIMITS.description + 1) })).toBe(`The description must be ${PERSONAL_LIMITS.description} characters or fewer.`);
    expect(firstMessage({ description: "two\nlines" })).toBe("The description cannot contain line breaks.");
    expect(firstMessage({ category: "not-a-category" })).toBe("Choose a category from the list.");
  });

  it("never shows a raw schema default for the covered cases", () => {
    for (const bad of [{ tags: ["x".repeat(31)] }, { tags: Array.from({ length: 9 }, () => "t") }, { tags: [""] }, { description: "x".repeat(281) }]) {
      const m = firstMessage(bad) ?? "";
      expect(m).not.toMatch(/must contain|element\(s\)|character\(s\)/);
      expect(m.endsWith(".")).toBe(true);
    }
  });

  it("leaves the rules themselves unchanged: valid input still passes and is normalised", () => {
    const r = PersonalMetaPatch.parse({ description: "  A calm layout ", category: "social-media", tags: ["Brand Voice", "quote"] });
    expect(r).toEqual({ description: "A calm layout", category: "social-media", tags: ["brand-voice", "quote"] });
  });
});
