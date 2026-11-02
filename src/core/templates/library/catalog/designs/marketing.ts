import type { DesignSpec } from "./types.js";

/** Marketing graphics for the web and print. Web sizes follow the Design Studio presets. */
export const MARKETING: DesignSpec[] = [
  {
    key: "banner-promo",
    name: "Promo web banner",
    description: "A wide split banner: a bold offer headline and button on the left, color shapes on the right.",
    category: "marketing-advertising",
    sub: "marketing-banners",
    format: "social",
    styles: ["modern", "playful"],
    keywords: ["banner", "web banner", "promo", "ad", "offer", "header", "campaign"],
    tags: ["banner"],
    width: 1600,
    height: 600,
    bg: "#fff7ed",
    bgBind: "paper",
    alt: "A wide cream banner with a bold orange offer headline and a button on the left and overlapping circles on the right",
    build: (d) => {
      d.ellipse(1020, -140, 760, 760, "#fb923c", { name: "Circle orange", bind: { fill: "primary" } });
      d.ellipse(1240, 220, 520, 520, "#1c1917", { name: "Circle dark", bind: { fill: "ink" } });
      d.ellipse(1100, 330, 280, 280, "#fde047", { name: "Circle yellow", bind: { fill: "accent" } });
      d.text("NEW SEASON OFFER", 90, 80, 800, 50, { size: 32, weight: 700, font: "Monospace", color: "#c2410c", name: "Kicker", bind: { color: "primary" } });
      d.text("Save 30% on everything this week", 90, 140, 940, 280, { size: 80, weight: 800, font: "Space Grotesk", color: "#1c1917", lh: 1.05, name: "Headline", bind: { color: "ink", font: "heading" } });
      d.rect(90, 430, 340, 94, "#c2410c", { name: "Button", radius: 47, bind: { fill: "primary" } });
      d.text("Shop the offer", 90, 454, 340, 50, { size: 34, weight: 700, color: "#ffffff", align: "center", name: "Button label", bind: { color: "paper" } });
    },
  },
  {
    key: "launch-link-preview",
    name: "Product launch preview",
    description: "A link-preview image for a launch: product name, one benefit and a stylised device block.",
    category: "marketing-advertising",
    sub: "product-launches",
    secondary: ["ui-ux-digital-products"],
    format: "social",
    styles: ["modern", "corporate"],
    keywords: ["launch", "product", "open graph", "link preview", "app", "saas", "announcement"],
    aliases: ["og image", "social share"],
    tags: ["launch"],
    width: 1200,
    height: 630,
    bg: "#0b1220",
    bgBind: "ink",
    alt: "A dark link-preview image with the product name and benefit on the left and a stylised blue device on the right",
    build: (d) => {
      d.text("INTRODUCING", 70, 80, 600, 40, { size: 28, weight: 700, font: "Monospace", color: "#7dd3fc", name: "Kicker", bind: { color: "accent" } });
      d.text("Product Name", 70, 140, 640, 140, { size: 76, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 1, name: "Product name", bind: { color: "paper", font: "heading" } });
      d.text("Plan, track and finish your work in half the time.", 70, 310, 560, 170, { size: 38, weight: 400, color: "#cbd5e1", lh: 1.3, name: "Benefit", bind: { font: "body" } });
      d.rect(70, 510, 240, 70, "#38bdf8", { name: "Button", radius: 35, bind: { fill: "accent" } });
      d.text("Try it free", 70, 526, 240, 40, { size: 28, weight: 800, color: "#0b1220", align: "center", name: "Button label", bind: { color: "ink" } });
      d.rect(700, 70, 430, 490, "#1e293b", { name: "Device", radius: 36 });
      d.rect(724, 94, 382, 442, "#0f172a", { name: "Screen", radius: 24 });
      d.rect(750, 126, 200, 26, "#38bdf8", { name: "Screen bar", radius: 13, bind: { fill: "accent" } });
      d.rect(750, 180, 330, 80, "#1e293b", { name: "Card one", radius: 14 });
      d.rect(750, 280, 330, 80, "#1e293b", { name: "Card two", radius: 14 });
      d.rect(750, 380, 330, 80, "#1e293b", { name: "Card three", radius: 14 });
      d.ellipse(1010, 392, 56, 56, "#38bdf8", { name: "Screen dot", bind: { fill: "accent" } });
    },
  },
  {
    key: "lead-magnet-cover",
    name: "Free guide cover",
    description: "A portrait cover for a free guide or checklist: a big title, a FREE label and bold geometry.",
    category: "marketing-advertising",
    sub: "lead-magnets",
    secondary: ["books-publishing", "education-learning"],
    format: "social",
    styles: ["editorial", "modern"],
    keywords: ["guide", "ebook", "checklist", "lead magnet", "cover", "download", "free", "report"],
    tags: ["guide", "cover"],
    width: 1080,
    height: 1350,
    bg: "#f4efe6",
    bgBind: "paper",
    alt: "A cream portrait cover with a green circle and bar, a FREE GUIDE label and a large serif title",
    build: (d) => {
      d.ellipse(580, -240, 640, 640, "#2f6b3f", { name: "Circle green", bind: { fill: "primary" } });
      d.rect(0, 300, 620, 40, "#e4a62b", { name: "Bar gold", bind: { fill: "accent" } });
      d.rect(80, 90, 230, 66, "#1a1a1a", { name: "Label pill", radius: 33, bind: { fill: "ink" } });
      d.text("FREE GUIDE", 80, 104, 230, 40, { size: 28, weight: 800, font: "Monospace", color: "#ffffff", align: "center", name: "Label", bind: { color: "paper" } });
      d.text("The 10-minute\nweekly plan", 80, 500, 920, 470, { size: 130, weight: 700, font: "Playfair Display", color: "#1a1a1a", lh: 1.05, name: "Title", bind: { color: "ink", font: "heading" } });
      d.text("A simple checklist to keep your week on track without a complicated system.", 80, 1020, 860, 150, { size: 40, weight: 400, color: "#4a4a42", lh: 1.35, name: "Subtitle", bind: { font: "body" } });
      d.text("BY YOUR NAME", 80, 1240, 600, 44, { size: 30, weight: 700, font: "Monospace", color: "#2f6b3f", name: "Author", bind: { color: "primary" } });
      d.logoSlot(820, 1210, 180, 90);
    },
  },
  {
    key: "coupon-offer",
    name: "Discount coupon",
    description: "A coupon card with a big percentage, a code box and terms, for print or sharing online.",
    category: "marketing-advertising",
    sub: "promotional-campaigns",
    secondary: ["posters-flyers"],
    format: "print",
    styles: ["retro", "playful"],
    keywords: ["coupon", "voucher", "discount", "code", "promo", "gift", "offer"],
    aliases: ["voucher"],
    tags: ["coupon"],
    width: 1050,
    height: 600,
    bg: "#fff3c4",
    bgBind: "accent",
    alt: "A yellow coupon card with a framed border, a big red 20% OFF, a dashed-style code box and small terms",
    build: (d) => {
      d.rect(24, 24, 1002, 552, "transparent", { name: "Frame", stroke: "#b91c1c", strokeWidth: 6, bind: { stroke: "primary" } });
      d.text("20%", 70, 60, 580, 280, { size: 235, weight: 800, font: "Space Grotesk", color: "#b91c1c", lh: 1, name: "Percent", bind: { color: "primary", font: "heading" } });
      d.text("OFF", 70, 330, 400, 120, { size: 110, weight: 800, font: "Space Grotesk", color: "#1f1f1f", lh: 1, name: "Off", bind: { color: "ink", font: "heading" } });
      d.text("YOUR NEXT ORDER", 640, 90, 340, 90, { size: 34, weight: 700, font: "Monospace", color: "#1f1f1f", lh: 1.3, name: "Kicker", bind: { color: "ink" } });
      d.rect(640, 220, 340, 130, "#ffffff", { name: "Code box", stroke: "#b91c1c", strokeWidth: 4, radius: 12 });
      d.text("SAVE20", 640, 250, 340, 70, { size: 60, weight: 800, font: "Monospace", color: "#b91c1c", align: "center", name: "Code", bind: { color: "primary" } });
      d.text("Valid until 31 December.\nOne use per customer.", 70, 480, 900, 80, { size: 26, weight: 400, color: "#3f3f3f", lh: 1.35, name: "Terms", bind: { font: "body" } });
    },
  },
  {
    key: "banner-summer",
    name: "Seasonal sale banner",
    description: "A wide banner with a rising sun, a short headline and a date line, easy to re-label for any season.",
    category: "marketing-advertising",
    sub: "marketing-banners",
    secondary: ["seasonal-holiday"],
    format: "social",
    styles: ["playful", "retro"],
    keywords: ["seasonal", "sale", "summer", "banner", "campaign", "holiday", "header"],
    tags: ["seasonal", "banner"],
    width: 1500,
    height: 500,
    bg: "#0ea5b7",
    bgBind: "primary",
    alt: "A wide teal banner with a yellow sun rising behind the words Summer Sale in white and a date line",
    build: (d) => {
      d.ellipse(1000, 150, 700, 700, "#fde047", { name: "Sun", bind: { fill: "accent" } });
      d.ellipse(1100, 250, 500, 500, "#fbbf24", { name: "Sun core", opacity: 0.9 });
      d.rect(0, 400, 1500, 100, "#0b7c8a", { name: "Waterline", bind: { fill: "ink" } });
      d.text("Summer Sale", 80, 90, 1000, 170, { size: 150, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 1, name: "Headline", bind: { color: "paper", font: "heading" } });
      d.text("Up to 40% off  ·  1 to 15 July", 80, 290, 1000, 70, { size: 52, weight: 500, color: "#ecfeff", name: "Dates", bind: { font: "body" } });
    },
  },
  {
    key: "media-kit-cover",
    name: "Media kit cover",
    description: "A confident A4 cover for a media kit: your name, three headline stats and contact details.",
    category: "marketing-advertising",
    sub: "media-kits",
    secondary: ["portfolios-personal-branding", "music-podcasts-entertainment"],
    format: "print",
    styles: ["editorial", "creative-studio"],
    keywords: ["media kit", "press kit", "creator", "influencer", "rate card", "brand deck", "stats"],
    tags: ["media kit"],
    width: 2480,
    height: 3508,
    bg: "#f6f1ea",
    bgBind: "paper",
    alt: "A warm A4 cover with a dark portrait frame, the words Media Kit in large serif type and three statistic blocks",
    build: (d) => {
      d.photo(160, 160, 1000, 1400, { fill: "#2b2623", label: "Your portrait", labelColor: "#bdb4aa", size: 64 });
      d.text("MEDIA KIT", 1280, 200, 1040, 80, { size: 66, weight: 700, font: "Monospace", color: "#b4532a", name: "Label", bind: { color: "accent" } });
      d.text("Your\nName", 1280, 320, 1040, 700, { size: 280, weight: 600, font: "Playfair Display", color: "#1f1b18", lh: 1, name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Creator, writer and host of the Your Show podcast.", 1280, 1100, 1040, 300, { size: 76, weight: 400, color: "#4a443d", lh: 1.3, name: "Bio", bind: { font: "body" } });
      const stats: [string, string][] = [["120K", "Followers"], ["48K", "Monthly listeners"], ["6.2%", "Engagement"]];
      stats.forEach(([n, label], i) => {
        const x = 160 + i * 740;
        d.rect(x, 1800, 700, 520, "#ffffff", { name: `Stat card ${i + 1}`, radius: 24 });
        d.text(n, x, 1900, 700, 260, { size: 230, weight: 800, font: "Space Grotesk", color: "#b4532a", align: "center", lh: 1, name: `Stat ${i + 1}`, bind: { color: "accent", font: "heading" } });
        d.text(label, x, 2200, 700, 70, { size: 58, weight: 500, color: "#4a443d", align: "center", name: `Stat label ${i + 1}`, bind: { font: "body" } });
      });
      d.rect(160, 2640, 2160, 5, "#1f1b18", { name: "Rule", bind: { fill: "ink" } });
      d.text("CONTACT", 160, 2720, 800, 60, { size: 48, weight: 700, font: "Monospace", color: "#b4532a", name: "Contact label", bind: { color: "accent" } });
      d.text("hello@example.com\nyoursite.com\n@yourhandle", 160, 2810, 1400, 330, { size: 70, weight: 400, color: "#1f1b18", lh: 1.4, name: "Contact", bind: { color: "ink", font: "body" } });
      d.logoSlot(1900, 2900, 420, 240);
    },
  },
];
