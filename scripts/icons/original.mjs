// BINHI-authored icon geometry (24×24 grid, 2px round stroke, no fills — same grammar as the Lucide-derived set).
// Authored from scratch for BINHI; licence: same as the repository (BINHI), attribution not required.
// Each value is a list of [tag, attributes] nodes using only: path, circle, rect, line, polyline, polygon, ellipse.
export const ORIGINAL = {
  // Half-hatched disc: a visible "see-through" cue without relying on fill or colour.
  Opacity: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M12 3v18" }],
    ["path", { d: "M12 8h5.5" }],
    ["path", { d: "M12 12h8" }],
    ["path", { d: "M12 16h5.5" }],
  ],
  // Four sample dots.
  "Color Swatches": [
    ["circle", { cx: 7, cy: 7, r: 3 }],
    ["circle", { cx: 17, cy: 7, r: 3 }],
    ["circle", { cx: 7, cy: 17, r: 3 }],
    ["circle", { cx: 17, cy: 17, r: 3 }],
  ],
  // Wide screen with a side button.
  "Landscape Orientation": [
    ["rect", { x: 2, y: 6, width: 20, height: 12, rx: 2 }],
    ["path", { d: "M19 12h.01" }],
  ],
  // Tall screen with a bottom button.
  "Portrait Orientation": [
    ["rect", { x: 6, y: 2, width: 12, height: 20, rx: 2 }],
    ["path", { d: "M12 19h.01" }],
  ],
  // Panel with two tabs on its top edge.
  Tabs: [
    ["rect", { x: 3, y: 8, width: 18, height: 13, rx: 2 }],
    ["path", { d: "M3 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" }],
    ["path", { d: "M10 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" }],
  ],
};
