// Icons whose "filled" variant was checked by eye (docs/ICON_LIBRARY.md, "Visual verification") and reads clearly:
// each is a single closed silhouette, so filling it hides no inner detail.
// Duotone is derived automatically: an icon supports it when it has at least one fully closed shape.
export const FILLED = new Set([
  "rectangle", "circle", "triangle", "polygon", "star", "arrow-shape", "cloud", "water-drop",
  "mountain", "shield", "heart", "highlights", "selection-cursor", "folder", "message", "airplane", "brand-colors",
]);

// Single-outline icons whose path already ends where it starts but lacks a closing "z" in Lucide's source.
// The generator appends "Z" so duotone/filled can fill them (the stroke is visually unchanged).
export const CLOSE_PATHS = new Set(["heart"]);
