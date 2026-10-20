import { useState } from "react";
import { applyStoredTheme, effectiveTheme } from "../theme.js";
import { I } from "./Icons.js";

export function ThemeToggle() {
  const [theme, setTheme] = useState(effectiveTheme());
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyStoredTheme(next);
    setTheme(next);
  };
  return (
    <button className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Switch editor to light theme" : "Switch editor to dark theme"} title="Editor theme (does not affect your website)">
      {theme === "dark" ? <I.sun /> : <I.moon />}
    </button>
  );
}
