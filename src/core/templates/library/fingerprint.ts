/**
 * Content fingerprints. A published (id, version) is immutable: the catalog
 * lock records a SHA-256 of each template's canonical content and a test
 * fails when the content changes without a version bump. Pure and
 * dependency free; the SHA-256 itself is computed by the caller (Node's
 * crypto in tests and scripts) so this file runs in the browser too.
 *
 * Website builders generate random node ids and stamp the current year, so
 * both are normalised before hashing: ids become `#1`, `#2`… in first-seen
 * order, and a "© <year>" becomes "© YEAR".
 */
import { ID_PATTERN } from "../../ids.js";

export function canonicalContent(value: unknown): string {
  const seen = new Map<string, string>();
  const norm = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (ID_PATTERN.test(v)) {
        if (!seen.has(v)) seen.set(v, `#${seen.size + 1}`);
        return seen.get(v);
      }
      return v.replace(/©\s*\d{4}/g, "© YEAR");
    }
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(norm(value));
}
