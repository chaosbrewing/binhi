import type { Theme, TextStyle, FontName } from "../schema/document.js";

const ts = (fontFamily: "heading" | "body", fontSize: number, fontWeight: number, lineHeight: number, extra: Partial<TextStyle> = {}): TextStyle => ({
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing: 0,
  textTransform: "none",
  ...extra,
});

export interface ThemeSeed {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  heading: FontName;
  body: FontName;
  radius?: number;
}

export function buildTheme(seed: ThemeSeed): Theme {
  const r = seed.radius ?? 8;
  return {
    colors: {
      primary: seed.primary,
      secondary: seed.secondary,
      accent: seed.accent,
      background: seed.background,
      surface: seed.surface,
      text: seed.text,
      muted: seed.muted,
      border: seed.border,
    },
    palette: [],
    fonts: { heading: seed.heading, body: seed.body },
    textStyles: {
      display: ts("heading", 64, 700, 1.05, { letterSpacing: -0.02, mobileFontSize: 40 }),
      heading1: ts("heading", 48, 700, 1.1, { letterSpacing: -0.015, mobileFontSize: 34 }),
      heading2: ts("heading", 36, 700, 1.15, { letterSpacing: -0.01, mobileFontSize: 28 }),
      heading3: ts("heading", 24, 600, 1.25, { mobileFontSize: 20 }),
      body: ts("body", 18, 400, 1.6, { mobileFontSize: 16 }),
      small: ts("body", 15, 400, 1.5),
      caption: ts("body", 13, 400, 1.4, { letterSpacing: 0.02 }),
      button: ts("body", 16, 600, 1.2),
      navigation: ts("body", 16, 500, 1.2),
    },
    buttons: {
      primary: { background: seed.primary, color: "#ffffff", borderWidth: 0, radius: r, paddingX: 22, paddingY: 13, hoverBackground: seed.secondary, shadow: "none" },
      secondary: { background: "transparent", color: seed.primary, borderColor: seed.primary, borderWidth: 2, radius: r, paddingX: 20, paddingY: 11, hoverBackground: seed.primary, hoverColor: "#ffffff", shadow: "none" },
      ghost: { background: "transparent", color: seed.text, borderWidth: 0, radius: r, paddingX: 12, paddingY: 10, hoverBackground: seed.surface, shadow: "none" },
    },
    links: { color: seed.primary, hoverColor: seed.secondary, underline: true },
    radii: { sm: Math.min(64, Math.max(0, r - 4)), md: Math.min(64, r), lg: Math.min(128, r * 2), pill: 999 },
    shadows: {
      sm: "0 1px 2px rgba(0,0,0,0.08)",
      md: "0 4px 12px rgba(0,0,0,0.10)",
      lg: "0 12px 32px rgba(0,0,0,0.14)",
      xl: "0 24px 64px rgba(0,0,0,0.18)",
    },
    spacing: { contentWidth: 1200, sectionPaddingY: 80, gap: 24 },
  };
}

export const DEFAULT_THEME_SEED: ThemeSeed = {
  primary: "#2f855a",
  secondary: "#276749",
  accent: "#9ae6b4",
  background: "#ffffff",
  surface: "#f4f7f5",
  text: "#1a202c",
  muted: "#5f6b66",
  border: "#dde3df",
  heading: "Inter",
  body: "Inter",
};
