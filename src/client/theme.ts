export type EditorTheme = "light" | "dark" | "system";
const KEY = "binhi.editorTheme";

export function getStoredTheme(): EditorTheme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyStoredTheme(theme: EditorTheme = getStoredTheme()): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: fine */
  }
}

export function effectiveTheme(): "light" | "dark" {
  const t = getStoredTheme();
  if (t !== "system") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
