const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => MAP[c] ?? c);
}

/** Escape for use inside a CSS string/url() context: strip anything risky. */
export function cssUrl(value: string): string {
  return value.replace(/["'()\\\s]/g, (c) => encodeURIComponent(c));
}

/** Escape text and convert newlines to <br>. */
export function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

/** CSS class-safe version of a node id. */
export function cls(id: string): string {
  return "b-n-" + id.replace(/[^a-zA-Z0-9_-]/g, "");
}
