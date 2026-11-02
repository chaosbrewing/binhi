import type { DesignSpec } from "./types.js";

/**
 * Photography layouts. The Design Studio has no image slots yet, so every
 * photo area is a labelled frame: add your image on top of it, or delete the
 * frame once the photo is placed. These are layouts, not photo effects.
 */
export const PHOTO: DesignSpec[] = [
  {
    key: "photo-grid-three",
    name: "Three-photo grid",
    description: "One large and two small photo frames with a caption bar, for a set of three pictures from the same day.",
    category: "photography-collages",
    sub: "photo-grids",
    secondary: ["social-media"],
    format: "custom",
    styles: ["minimal", "editorial"],
    keywords: ["photo grid", "collage", "three photos", "gallery", "layout", "frames", "photos"],
    tags: ["grid"],
    width: 1080,
    height: 1080,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white square with one large and two small gray photo frames and a caption line beneath",
    build: (d) => {
      d.photo(40, 40, 620, 880, { fill: "#d9d6d0", label: "Photo 1", radius: 6 });
      d.photo(690, 40, 350, 430, { fill: "#cfd5d4", label: "Photo 2", radius: 6 });
      d.photo(690, 490, 350, 430, { fill: "#d6d0d6", label: "Photo 3", radius: 6 });
      d.text("Saturday in the hills", 40, 960, 700, 50, { size: 38, weight: 700, font: "DM Sans", color: "#111111", name: "Caption", bind: { color: "ink", font: "heading" } });
      d.text("Three frames from one good day.", 40, 1010, 900, 36, { size: 26, weight: 400, color: "#6b6b66", name: "Caption detail", bind: { font: "body" } });
    },
  },
  {
    key: "collage-four-portrait",
    name: "Four-photo collage",
    description: "A tall collage of four frames at different sizes with a bold title strip.",
    category: "photography-collages",
    sub: "photo-collages",
    secondary: ["social-media", "travel-tourism"],
    format: "custom",
    styles: ["playful", "artistic"],
    keywords: ["collage", "photo collage", "four photos", "scrapbook", "memories", "travel", "layout"],
    tags: ["collage"],
    width: 1080,
    height: 1350,
    bg: "#fef3c7",
    bgBind: "accent",
    alt: "A warm yellow portrait collage with four tinted photo frames of different sizes and a dark title strip",
    build: (d) => {
      d.rect(0, 0, 1080, 170, "#1c1917", { name: "Title strip", bind: { fill: "ink" } });
      d.text("Summer, in four frames", 50, 44, 980, 90, { size: 64, weight: 800, font: "Space Grotesk", color: "#fde68a", name: "Title", bind: { color: "accent", font: "heading" } });
      d.photo(50, 210, 600, 520, { fill: "#fdba74", label: "Photo 1", radius: 18 });
      d.photo(680, 210, 350, 250, { fill: "#a5b4fc", label: "Photo 2", radius: 18 });
      d.photo(680, 490, 350, 240, { fill: "#86efac", label: "Photo 3", radius: 18 });
      d.photo(50, 760, 980, 520, { fill: "#f9a8d4", label: "Photo 4", radius: 18 });
    },
  },
  {
    key: "before-after",
    name: "Before and after",
    description: "Two equal frames side by side with BEFORE and AFTER labels and a caption, for edits, makeovers and progress.",
    category: "photography-collages",
    sub: "before-and-after-comparisons",
    secondary: ["fashion-beauty-lifestyle", "real-estate-architecture"],
    format: "custom",
    styles: ["modern", "minimal"],
    keywords: ["before and after", "comparison", "transformation", "makeover", "renovation", "progress", "edit"],
    aliases: ["before after"],
    tags: ["comparison"],
    width: 1920,
    height: 1080,
    bg: "#0f172a",
    bgBind: "ink",
    alt: "A dark landscape layout with two equal photo frames labelled BEFORE and AFTER and a caption underneath",
    build: (d) => {
      d.photo(60, 60, 890, 800, { fill: "#334155", label: "Before photo", labelColor: "#94a3b8", radius: 10 });
      d.photo(970, 60, 890, 800, { fill: "#475569", label: "After photo", labelColor: "#cbd5e1", radius: 10 });
      d.rect(60, 60, 200, 64, "#e2e8f0", { name: "Before tag", bind: { fill: "paper" } });
      d.text("BEFORE", 60, 72, 200, 44, { size: 32, weight: 800, font: "Monospace", color: "#0f172a", align: "center", name: "Before label", bind: { color: "ink" } });
      d.rect(970, 60, 200, 64, "#22d3ee", { name: "After tag", bind: { fill: "accent" } });
      d.text("AFTER", 970, 72, 200, 44, { size: 32, weight: 800, font: "Monospace", color: "#0f172a", align: "center", name: "After label", bind: { color: "ink" } });
      d.text("Small kitchen refresh: new paint, new handles, same layout.", 60, 910, 1500, 100, { size: 50, weight: 500, font: "DM Sans", color: "#f1f5f9", name: "Caption", bind: { color: "paper", font: "body" } });
    },
  },
  {
    key: "contact-sheet",
    name: "Contact sheet",
    description: "A film-style contact sheet with twelve numbered frames on a black strip, for a shoot overview.",
    category: "photography-collages",
    sub: "contact-sheets",
    secondary: ["portfolios-personal-branding"],
    format: "custom",
    styles: ["retro", "editorial"],
    keywords: ["contact sheet", "film", "shoot", "proofs", "selects", "photographer", "frames", "photos"],
    tags: ["contact sheet"],
    width: 1800,
    height: 1200,
    bg: "#111111",
    bgBind: "ink",
    alt: "A black landscape contact sheet with twelve numbered gray photo frames in four columns and three rows",
    build: (d) => {
      d.text("SHOOT 014  ·  SELECTS", 60, 36, 1000, 40, { size: 30, weight: 700, font: "Monospace", color: "#f5c542", name: "Header", bind: { color: "accent" } });
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          const n = r * 4 + c + 1;
          const x = 60 + c * 430;
          const y = 100 + r * 350;
          d.photo(x, y, 400, 290, { fill: "#2a2a2a", label: `Frame ${n}`, labelColor: "#777777", size: 26, name: `Frame ${n}` });
          d.text(`${String(n).padStart(2, "0")}A`, x, y + 296, 120, 30, { size: 22, weight: 600, font: "Monospace", color: "#f5c542", name: `Number ${n}`, bind: { color: "accent" } });
        }
      }
    },
  },
];
