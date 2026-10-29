import type { DesignSpec } from "./types.js";

/** Logos, brand identity sheets and moodboards. Logos are text and shape compositions the owner edits; they are not auto-generated marks. */
export const BRAND: DesignSpec[] = [
  {
    key: "logo-monogram",
    name: "Monogram logo",
    description: "A ring monogram with two serif initials, a small caps name and a thin gold rule.",
    category: "logos-brand-identity",
    sub: "monograms",
    secondary: ["invitations-events"],
    format: "custom",
    styles: ["elegant", "minimal"],
    keywords: ["logo", "monogram", "initials", "wedding", "personal brand", "emblem"],
    tags: ["logo", "monogram"],
    featured: true,
    width: 1080,
    height: 1080,
    bg: "#f7f2e8",
    bgBind: "paper",
    alt: "A cream square with a thin ring around two large serif initials and a small caps name beneath a gold rule",
    build: (d) => {
      d.ellipse(220, 130, 640, 640, "transparent", { name: "Ring outer", stroke: "#b08d3e", strokeWidth: 6, bind: { stroke: "accent" } });
      d.ellipse(246, 156, 588, 588, "transparent", { name: "Ring inner", stroke: "#b08d3e", strokeWidth: 2, bind: { stroke: "accent" } });
      d.text("AJ", 220, 296, 640, 330, { size: 300, weight: 600, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1, name: "Initials", bind: { color: "ink", font: "heading" } });
      d.rect(440, 830, 200, 4, "#b08d3e", { name: "Rule", bind: { fill: "accent" } });
      d.text("ANNA & JAMES", 140, 870, 800, 80, { size: 60, weight: 500, font: "Playfair Display", color: "#2a2118", align: "center", name: "Names", bind: { color: "ink", font: "heading" } });
      d.text("EST. 2026", 140, 960, 800, 50, { size: 34, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "Established", bind: { color: "accent" } });
    },
  },
  {
    key: "logo-wordmark",
    name: "Stacked wordmark",
    description: "A lowercase two-line wordmark in heavy sans with a dot accent and a quiet tagline.",
    category: "logos-brand-identity",
    sub: "wordmarks",
    format: "custom",
    styles: ["minimal", "modern"],
    keywords: ["logo", "wordmark", "type", "text logo", "startup", "brand name"],
    tags: ["logo", "wordmark"],
    width: 1080,
    height: 1080,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white square with a lowercase two-line wordmark north field in heavy black sans and a green dot",
    build: (d) => {
      d.text("north\nfield", 140, 250, 800, 500, { size: 230, weight: 800, font: "Space Grotesk", color: "#111111", lh: 0.95, name: "Wordmark", bind: { color: "ink", font: "heading" } });
      d.ellipse(716, 640, 74, 74, "#16a34a", { name: "Dot", bind: { fill: "accent" } });
      d.rect(146, 810, 90, 8, "#111111", { name: "Rule", bind: { fill: "ink" } });
      d.text("studio for useful things", 146, 850, 800, 60, { size: 44, weight: 400, font: "DM Sans", color: "#525252", name: "Tagline", bind: { font: "body" } });
    },
  },
  {
    key: "logo-badge",
    name: "Round badge logo",
    description: "A retro round badge with a heavy center word, two ribbons and a year, for coffee, craft and small shops.",
    category: "logos-brand-identity",
    sub: "logos",
    secondary: ["food-hospitality", "packaging-product-labels"],
    format: "custom",
    styles: ["retro", "organic"],
    keywords: ["logo", "badge", "emblem", "coffee", "craft", "stamp", "label", "roasters"],
    tags: ["logo", "badge"],
    width: 1080,
    height: 1080,
    bg: "#efe3c8",
    bgBind: "paper",
    alt: "A cream square with a dark green round badge, a heavy center word ROAST, two ribbons and a year",
    build: (d) => {
      d.ellipse(140, 140, 800, 800, "#1f4d3a", { name: "Badge", bind: { fill: "primary" } });
      d.ellipse(176, 176, 728, 728, "transparent", { name: "Badge ring", stroke: "#efe3c8", strokeWidth: 6, bind: { stroke: "paper" } });
      d.text("SMALL BATCH", 240, 290, 600, 60, { size: 48, weight: 700, font: "Monospace", color: "#efe3c8", align: "center", name: "Top text", bind: { color: "paper" } });
      d.text("ROAST", 190, 400, 700, 240, { size: 186, weight: 800, font: "Georgia", color: "#f2b84b", align: "center", lh: 1, name: "Center word", bind: { color: "accent", font: "heading" } });
      d.rect(190, 650, 700, 90, "#efe3c8", { name: "Ribbon", bind: { fill: "paper" } });
      d.text("COFFEE COMPANY", 190, 672, 700, 56, { size: 46, weight: 800, font: "Space Grotesk", color: "#1f4d3a", align: "center", name: "Ribbon text", bind: { color: "primary", font: "heading" } });
      d.text("EST. 2026", 240, 780, 600, 60, { size: 44, weight: 700, font: "Monospace", color: "#efe3c8", align: "center", name: "Year", bind: { color: "paper" } });
    },
  },
  {
    key: "brand-board",
    name: "Brand identity board",
    description: "One landscape board for the logo, five brand colours with hex codes, type samples and tone words.",
    category: "logos-brand-identity",
    sub: "brand-boards",
    secondary: ["marketing-advertising"],
    format: "custom",
    styles: ["corporate", "modern"],
    keywords: ["brand board", "brand guide", "style guide", "colors", "typography", "identity", "palette"],
    aliases: ["brand guidelines", "style sheet"],
    tags: ["brand"],
    width: 1920,
    height: 1080,
    bg: "#f8fafc",
    bgBind: "paper",
    alt: "A light landscape brand board with a logo area, five color swatches, type samples and tone words",
    build: (d) => {
      d.text("BRAND BOARD", 80, 60, 700, 50, { size: 34, weight: 700, font: "Monospace", color: "#64748b", name: "Label" });
      d.rect(80, 140, 640, 440, "#0f2a4a", { name: "Logo area", radius: 24, bind: { fill: "primary" } });
      d.text("Your\nbrand", 80, 250, 640, 240, { size: 120, weight: 800, font: "DM Sans", color: "#ffffff", align: "center", lh: 1, name: "Logo placeholder", bind: { color: "paper", font: "heading" } });
      d.logoSlot(240, 190, 320, 340);
      const swatches: [string, string, string][] = [["#0f2a4a", "Navy", "#0F2A4A"], ["#2563eb", "Blue", "#2563EB"], ["#f59e0b", "Amber", "#F59E0B"], ["#e2e8f0", "Mist", "#E2E8F0"], ["#0f172a", "Ink", "#0F172A"]];
      swatches.forEach(([fill, name, hex], i) => {
        const x = 80 + i * 124;
        d.rect(x, 620, 112, 220, fill, { name: `Swatch ${name}`, radius: 16, ...(i === 0 ? { bind: { fill: "primary" as const } } : i === 2 ? { bind: { fill: "accent" as const } } : {}) });
        d.text(name, x, 860, 112, 36, { size: 24, weight: 700, color: "#0f172a", name: `${name} name` });
        d.text(hex, x, 898, 112, 30, { size: 20, weight: 500, font: "Monospace", color: "#64748b", name: `${name} hex` });
      });
      d.text("Aa", 800, 120, 480, 300, { size: 260, weight: 800, font: "DM Sans", color: "#0f2a4a", lh: 1, name: "Heading sample", bind: { color: "primary", font: "heading" } });
      d.text("Headline font", 800, 430, 480, 50, { size: 34, weight: 700, color: "#0f172a", name: "Heading label" });
      d.text("Aa", 1340, 120, 480, 300, { size: 260, weight: 400, font: "Lora", color: "#2563eb", lh: 1, name: "Body sample", bind: { font: "body" } });
      d.text("Body font", 1340, 430, 480, 50, { size: 34, weight: 700, color: "#0f172a", name: "Body label" });
      d.rect(800, 540, 1020, 3, "#cbd5e1", { name: "Divider" });
      d.text("VOICE", 800, 590, 400, 40, { size: 28, weight: 700, font: "Monospace", color: "#64748b", name: "Voice label" });
      d.text("Clear.  Warm.  Direct.", 800, 640, 1020, 100, { size: 72, weight: 700, color: "#0f2a4a", name: "Tone words", bind: { color: "primary", font: "heading" } });
      d.text("We explain things plainly and never use jargon.", 800, 770, 1020, 100, { size: 40, weight: 400, color: "#475569", name: "Voice note", bind: { font: "body" } });
    },
  },
  {
    key: "moodboard-grid",
    name: "Moodboard grid",
    description: "A six-frame moodboard with a palette strip and a title block, ready for your reference images.",
    category: "logos-brand-identity",
    sub: "moodboards",
    secondary: ["photography-collages", "fashion-beauty-lifestyle"],
    format: "custom",
    styles: ["artistic", "editorial"],
    keywords: ["moodboard", "inspiration", "references", "collage", "vision board", "palette"],
    tags: ["moodboard"],
    width: 1920,
    height: 1080,
    bg: "#ece7df",
    bgBind: "paper",
    alt: "A warm landscape moodboard with six frames of different sizes, a title block and a row of palette dots",
    build: (d) => {
      d.photo(60, 60, 560, 620, { fill: "#c9b8a3", label: "Hero image", radius: 8 });
      d.photo(650, 60, 380, 290, { fill: "#a8b5a0", label: "Image", radius: 8 });
      d.photo(1060, 60, 380, 440, { fill: "#d6a99a", label: "Image", radius: 8 });
      d.photo(1470, 60, 390, 290, { fill: "#8f9fb3", label: "Image", radius: 8 });
      d.photo(650, 380, 380, 300, { fill: "#e3d2a4", label: "Image", radius: 8 });
      d.photo(1470, 380, 390, 300, { fill: "#b9a6c4", label: "Image", radius: 8 });
      d.text("Soft\nearth", 60, 720, 700, 300, { size: 140, weight: 600, font: "Playfair Display", color: "#2a2520", lh: 1, name: "Title", bind: { color: "ink", font: "heading" } });
      d.text("Autumn collection, mood and palette", 800, 760, 1000, 60, { size: 40, weight: 400, color: "#5b5348", name: "Subtitle", bind: { font: "body" } });
      (["#c9b8a3", "#a8b5a0", "#d6a99a", "#8f9fb3", "#e3d2a4"] as const).forEach((c, i) => d.ellipse(800 + i * 130, 880, 100, 100, c, { name: `Palette ${i + 1}` }));
    },
  },
  {
    key: "brand-colors-sheet",
    name: "Brand colors sheet",
    description: "A tall palette sheet with four large swatch blocks, names and codes to share with your team.",
    category: "logos-brand-identity",
    sub: "color-palettes",
    format: "custom",
    styles: ["modern", "minimal"],
    keywords: ["colors", "palette", "swatches", "hex", "brand colours", "color scheme"],
    aliases: ["colour palette"],
    tags: ["palette"],
    width: 1080,
    height: 1350,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white portrait sheet with four stacked color blocks in navy, coral, sand and mint with names and hex codes",
    build: (d) => {
      d.text("Our colors", 80, 70, 920, 110, { size: 96, weight: 800, font: "Space Grotesk", color: "#111827", name: "Title", bind: { color: "ink", font: "heading" } });
      const blocks: [string, string, string, string, "primary" | "accent" | "ink" | "paper" | null][] = [
        ["#1d3557", "Deep Navy", "#1D3557", "#ffffff", "primary"],
        ["#e76f51", "Warm Coral", "#E76F51", "#ffffff", "accent"],
        ["#f1e3c8", "Soft Sand", "#F1E3C8", "#1d3557", null],
        ["#a8dadc", "Cool Mint", "#A8DADC", "#1d3557", null],
      ];
      blocks.forEach(([fill, name, hex, ink, token], i) => {
        const y = 230 + i * 270;
        d.rect(80, y, 920, 240, fill, { name: `Block ${name}`, radius: 20, ...(token ? { bind: { fill: token } } : {}) });
        d.text(name, 120, y + 40, 600, 70, { size: 54, weight: 700, font: "Space Grotesk", color: ink, name: `${name} label` });
        d.text(hex, 120, y + 130, 600, 50, { size: 38, weight: 500, font: "Monospace", color: ink, name: `${name} hex` });
      });
    },
  },
];
