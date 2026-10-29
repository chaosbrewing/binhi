import type { DesignSpec } from "./types.js";

/**
 * Social media graphics. Sizes follow the Design Studio presets. Fonts are
 * the named web fonts whose fallbacks are the system stacks; "Inter" is not
 * used because it is not installed on most devices, so previews would not
 * match what people see. Text boxes keep slack for the wider fallback fonts.
 */
export const SOCIAL: DesignSpec[] = [
  {
    key: "quote-card",
    name: "Quote card",
    description: "A calm serif quote on warm paper with an accent rule and room for a name.",
    category: "social-media",
    sub: "instagram-posts",
    secondary: ["marketing-advertising"],
    format: "social",
    styles: ["minimal", "editorial"],
    keywords: ["quote", "inspiration", "words", "motivation"],
    tags: ["quote"],
    featured: true,
    width: 1080,
    height: 1080,
    bg: "#f3efe6",
    bgBind: "paper",
    alt: "A square quote card: a large orange quotation mark, a serif quote and an author line on warm paper",
    build: (d) => {
      d.rect(96, 112, 72, 8, "#c2410c", { name: "Accent rule", bind: { fill: "accent" } });
      d.text("“", 84, 120, 220, 290, { size: 260, weight: 700, font: "Georgia", color: "#c2410c", lh: 1, name: "Quote mark", bind: { color: "accent" } });
      d.text("Say the simple thing, and say it like you mean it.", 96, 390, 888, 420, { size: 80, weight: 600, font: "Playfair Display", color: "#1f1d1a", lh: 1.2, name: "Quote", bind: { color: "ink", font: "heading" } });
      d.rect(96, 868, 888, 2, "#1f1d1a", { name: "Divider", opacity: 0.18, bind: { fill: "ink" } });
      d.text("Your name, your role", 96, 900, 640, 44, { size: 30, weight: 500, color: "#6b645b", name: "Author", bind: { font: "body" } });
      d.text("@yourhandle", 96, 950, 520, 36, { size: 24, weight: 500, color: "#8a8176", name: "Handle", bind: { font: "body" } });
      d.logoSlot(824, 920, 160, 70);
    },
  },
  {
    key: "announcement-bold",
    name: "Bold announcement",
    description: "A loud yellow post with a heavy two-line headline and a black strip for the details.",
    category: "social-media",
    sub: "instagram-posts",
    secondary: ["marketing-advertising"],
    format: "social",
    styles: ["brutalist", "modern"],
    keywords: ["announcement", "launch", "new drop", "release", "news"],
    tags: ["announcement"],
    width: 1080,
    height: 1080,
    bg: "#ffe600",
    bgBind: "accent",
    alt: "A yellow square post with a huge black NEW DROP headline and a black strip of details at the bottom",
    build: (d) => {
      d.rect(28, 28, 1024, 1024, "transparent", { name: "Frame", stroke: "#111111", strokeWidth: 10, bind: { stroke: "ink" } });
      d.text("VOL. 01", 72, 76, 300, 40, { size: 30, weight: 700, font: "Monospace", color: "#111111", name: "Issue label", bind: { color: "ink" } });
      d.text("NEW\nDROP", 64, 150, 960, 580, { size: 280, weight: 800, font: "Space Grotesk", color: "#111111", lh: 0.95, name: "Headline", bind: { color: "ink", font: "heading" } });
      d.rect(28, 780, 1024, 272, "#111111", { name: "Details strip", bind: { fill: "ink" } });
      d.text("Fresh work, out now.", 72, 816, 936, 70, { size: 56, weight: 700, font: "Space Grotesk", color: "#ffe600", name: "Details", bind: { color: "accent", font: "heading" } });
      d.text("Link in bio  ·  Limited run", 72, 912, 936, 50, { size: 38, weight: 500, font: "Monospace", color: "#ffffff", name: "Call to action", bind: { color: "paper" } });
    },
  },
  {
    key: "product-spotlight",
    name: "Product spotlight",
    description: "A tall product frame beside the name, a short description, the price and a button.",
    category: "social-media",
    sub: "instagram-posts",
    secondary: ["marketing-advertising"],
    format: "social",
    styles: ["modern", "corporate"],
    keywords: ["product", "shop", "store", "new arrival", "price", "sale"],
    tags: ["product"],
    width: 1080,
    height: 1080,
    bg: "#f5f5f2",
    bgBind: "paper",
    alt: "A square product post: a large product photo frame on the left, with name, price and a blue button on the right",
    build: (d) => {
      d.photo(56, 56, 540, 968, { fill: "#e1ded6", radius: 28, label: "Your product photo" });
      d.text("NEW ARRIVAL", 640, 96, 384, 36, { size: 26, weight: 700, color: "#2563eb", name: "Label", bind: { color: "accent" } });
      d.text("Product name goes here", 640, 150, 384, 270, { size: 68, weight: 700, font: "Space Grotesk", color: "#171717", lh: 1.08, name: "Product name", bind: { color: "ink", font: "heading" } });
      d.text("Two short lines about what makes it worth having.", 640, 450, 384, 200, { size: 30, weight: 400, color: "#57534e", lh: 1.35, name: "Description", bind: { font: "body" } });
      d.text("$00", 640, 720, 384, 100, { size: 84, weight: 700, font: "Space Grotesk", color: "#171717", name: "Price", bind: { color: "ink", font: "heading" } });
      d.rect(640, 860, 384, 96, "#2563eb", { name: "Button", radius: 48, bind: { fill: "primary" } });
      d.text("Shop now", 640, 884, 384, 48, { size: 36, weight: 700, color: "#ffffff", align: "center", name: "Button label", bind: { color: "paper" } });
    },
  },
  {
    key: "tip-of-the-day",
    name: "Tip of the day",
    description: "A purple tip card with a huge number, playful circles and a short, readable tip.",
    category: "social-media",
    sub: "instagram-carousel-posts",
    secondary: ["education-learning"],
    format: "social",
    styles: ["playful", "modern"],
    keywords: ["tip", "how to", "advice", "carousel", "tips", "learn"],
    tags: ["tips"],
    width: 1080,
    height: 1080,
    bg: "#6d28d9",
    bgBind: "primary",
    alt: "A purple square post with an oversized number 01, two colored circles and a tip in white text",
    build: (d) => {
      d.ellipse(700, -140, 520, 520, "#f59e0b", { name: "Circle top", bind: { fill: "accent" } });
      d.ellipse(-120, 800, 420, 420, "#22d3ee", { name: "Circle bottom", opacity: 0.9 });
      d.text("01", 60, 40, 640, 440, { size: 400, weight: 800, font: "Space Grotesk", color: "#ddd6fe", lh: 1, name: "Number", opacity: 0.55, bind: { font: "heading" } });
      d.text("TIP OF THE DAY", 72, 520, 700, 44, { size: 32, weight: 700, font: "Monospace", color: "#fde68a", name: "Label", bind: { color: "accent" } });
      d.text("Take a short walk before you start writing.", 72, 584, 936, 260, { size: 76, weight: 700, font: "Space Grotesk", color: "#ffffff", lh: 1.1, name: "Tip", bind: { color: "paper", font: "heading" } });
      d.text("Swipe for more  →", 440, 930, 568, 44, { size: 32, weight: 500, color: "#ede9fe", align: "right", name: "Swipe hint", bind: { font: "body" } });
    },
  },
  {
    key: "testimonial-card",
    name: "Testimonial card",
    description: "A customer quote with five stars, an avatar frame, a name and a navy base.",
    category: "social-media",
    sub: "linkedin-graphics",
    secondary: ["marketing-advertising"],
    format: "social",
    styles: ["corporate", "minimal"],
    keywords: ["testimonial", "review", "customer", "feedback", "client", "proof"],
    tags: ["review"],
    width: 1080,
    height: 1080,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white square testimonial card with gold stars, a customer quote, an avatar circle and a navy bottom band",
    build: (d) => {
      d.text("★★★★★", 88, 96, 600, 90, { size: 72, weight: 400, color: "#f59e0b", name: "Stars", bind: { color: "accent" } });
      d.text("“They listened, delivered early, and the result brought in customers within a week.”", 88, 232, 904, 400, { size: 62, weight: 600, font: "DM Sans", color: "#0f172a", lh: 1.22, name: "Quote", bind: { color: "ink", font: "heading" } });
      d.ellipse(88, 720, 128, 128, "#cbd5e1", { name: "Avatar frame" });
      d.text("AB", 88, 762, 128, 50, { size: 44, weight: 700, color: "#475569", align: "center", name: "Initials" });
      d.text("Alex Brown", 244, 726, 700, 52, { size: 40, weight: 700, color: "#0f172a", name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Owner, Brown & Co.", 244, 786, 700, 44, { size: 30, weight: 400, color: "#64748b", name: "Role", bind: { font: "body" } });
      d.rect(0, 928, 1080, 152, "#0f2a4a", { name: "Base band", bind: { fill: "primary" } });
      d.text("Your business name", 88, 982, 700, 48, { size: 34, weight: 600, color: "#ffffff", name: "Business name", bind: { color: "paper", font: "heading" } });
      d.logoSlot(820, 952, 172, 96);
    },
  },
  {
    key: "sale-story",
    name: "Sale story",
    description: "A tall, loud sale story: a giant percentage, a tilted tag and a pill button.",
    category: "social-media",
    sub: "instagram-stories",
    secondary: ["marketing-advertising", "seasonal-holiday"],
    format: "social",
    styles: ["retro", "playful"],
    keywords: ["sale", "discount", "percent off", "offer", "promo", "story"],
    aliases: ["promo", "reel cover"],
    tags: ["sale"],
    featured: true,
    width: 1080,
    height: 1920,
    bg: "#ffd23f",
    bgBind: "accent",
    alt: "A tall yellow story with a huge red 50% OFF, a tilted black tag and a black button",
    build: (d) => {
      d.ellipse(-260, 1240, 900, 900, "#ff5964", { name: "Sun shape", opacity: 0.9 });
      d.text("END OF SEASON", 80, 150, 920, 60, { size: 44, weight: 700, font: "Monospace", color: "#1a1a1a", name: "Kicker", bind: { color: "ink" } });
      d.text("50%", 60, 260, 960, 440, { size: 400, weight: 800, font: "Space Grotesk", color: "#e11d48", lh: 1, name: "Percent", bind: { color: "primary", font: "heading" } });
      d.text("OFF", 80, 690, 920, 340, { size: 300, weight: 800, font: "Space Grotesk", color: "#1a1a1a", lh: 1, name: "Off", bind: { color: "ink", font: "heading" } });
      d.rect(540, 1100, 440, 130, "#1a1a1a", { name: "Tag", rotation: -6, radius: 12, bind: { fill: "ink" } });
      d.text("TODAY ONLY", 540, 1138, 440, 56, { size: 46, weight: 800, font: "Space Grotesk", color: "#ffd23f", align: "center", rotation: -6, name: "Tag text", bind: { color: "accent" } });
      d.text("Everything in store and online. Use code SALE50 at checkout.", 80, 1330, 760, 200, { size: 44, weight: 500, color: "#1a1a1a", lh: 1.3, name: "Details", bind: { color: "ink", font: "body" } });
      d.rect(80, 1620, 620, 120, "#1a1a1a", { name: "Button", radius: 60, bind: { fill: "ink" } });
      d.text("Shop now", 80, 1650, 620, 60, { size: 48, weight: 700, color: "#ffffff", align: "center", name: "Button label", bind: { color: "paper" } });
      d.logoSlot(720, 1700, 260, 120);
    },
  },
  {
    key: "event-story",
    name: "Event story",
    description: "A dark story that leads with the date, then the event name, time and place.",
    category: "social-media",
    sub: "instagram-stories",
    secondary: ["invitations-events", "posters-flyers"],
    format: "social",
    styles: ["modern", "creative-studio"],
    keywords: ["event", "date", "invite", "story", "party", "launch night", "meetup"],
    tags: ["event"],
    width: 1080,
    height: 1920,
    bg: "#0f172a",
    bgBind: "ink",
    alt: "A dark tall story with a huge lime date 24 OCT, the event title in white and time and place details",
    build: (d) => {
      d.text("SAVE THE DATE", 80, 140, 920, 50, { size: 36, weight: 700, font: "Monospace", color: "#94a3b8", name: "Kicker" });
      d.text("24", 60, 230, 1000, 560, { size: 520, weight: 800, font: "Space Grotesk", color: "#a3e635", lh: 1, name: "Day", bind: { color: "accent", font: "heading" } });
      d.text("OCT", 80, 790, 600, 200, { size: 170, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 1, name: "Month", bind: { color: "paper", font: "heading" } });
      d.rect(80, 1040, 120, 10, "#a3e635", { name: "Rule", bind: { fill: "accent" } });
      d.text("Open studio night", 80, 1100, 920, 220, { size: 104, weight: 700, font: "Space Grotesk", color: "#ffffff", lh: 1.05, name: "Event name", bind: { color: "paper", font: "heading" } });
      d.text("7 pm to late\nYour venue, Your city", 80, 1360, 920, 150, { size: 46, weight: 400, color: "#cbd5e1", lh: 1.35, name: "Details", bind: { font: "body" } });
      d.rect(80, 1600, 560, 112, "#a3e635", { name: "Button", radius: 56, bind: { fill: "accent" } });
      d.text("RSVP free", 80, 1630, 560, 56, { size: 46, weight: 800, font: "Space Grotesk", color: "#0f172a", align: "center", name: "Button label", bind: { color: "ink", font: "heading" } });
    },
  },
  {
    key: "behind-the-scenes-story",
    name: "Behind the scenes",
    description: "A full-height photo frame with a paper caption card, for process and studio stories.",
    category: "social-media",
    sub: "instagram-stories",
    format: "social",
    styles: ["editorial", "artistic"],
    keywords: ["behind the scenes", "process", "studio", "story", "making of", "photo"],
    tags: ["story"],
    width: 1080,
    height: 1920,
    bg: "#c9c5bb",
    alt: "A tall story: a full-height photo frame with a cream caption card and serif headline at the bottom",
    build: (d) => {
      d.photo(0, 0, 1080, 1920, { fill: "#c9c5bb", label: "Your photo, full height", size: 40 });
      d.rect(64, 1380, 952, 440, "#f4f1ea", { name: "Caption card", bind: { fill: "paper" } });
      d.text("BEHIND THE SCENES", 104, 1424, 800, 40, { size: 28, weight: 700, font: "Monospace", color: "#a3411d", name: "Kicker", bind: { color: "accent" } });
      d.text("How one small idea became the whole project", 104, 1488, 872, 220, { size: 70, weight: 600, font: "Playfair Display", color: "#1f1d1a", lh: 1.1, name: "Headline", bind: { color: "ink", font: "heading" } });
      d.text("Tap to see the process  →", 104, 1730, 700, 44, { size: 32, weight: 500, color: "#6b645b", name: "Hint", bind: { font: "body" } });
    },
  },
  {
    key: "thumbnail-bold",
    name: "Bold video thumbnail",
    description: "A red thumbnail with a shouting two-line title, an episode label and a face frame.",
    category: "social-media",
    sub: "youtube-thumbnails",
    format: "social",
    styles: ["brutalist", "playful"],
    keywords: ["youtube", "thumbnail", "video cover", "title", "channel"],
    aliases: ["yt thumbnail"],
    tags: ["youtube"],
    width: 1280,
    height: 720,
    bg: "#ef4444",
    bgBind: "primary",
    alt: "A red video thumbnail with a huge white two-line title, a black EP label and a yellow exclamation circle",
    build: (d) => {
      d.rect(48, 48, 200, 64, "#111111", { name: "Episode label", bind: { fill: "ink" } });
      d.text("EP. 12", 48, 60, 200, 44, { size: 36, weight: 800, font: "Monospace", color: "#ffffff", align: "center", name: "Episode", bind: { color: "paper" } });
      d.text("I TRIED IT\nFOR 30\nDAYS", 48, 140, 780, 420, { size: 126, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 0.98, name: "Title", bind: { color: "paper", font: "heading" } });
      d.rect(48, 580, 760, 80, "#111111", { name: "Subtitle bar", bind: { fill: "ink" } });
      d.text("Here is what actually changed", 70, 596, 720, 50, { size: 38, weight: 700, color: "#ffe600", name: "Subtitle", bind: { color: "accent", font: "body" } });
      d.ellipse(860, 90, 360, 360, "#ffe600", { name: "Face frame", stroke: "#111111", strokeWidth: 10, bind: { fill: "accent" } });
      d.text("Your face", 860, 240, 360, 60, { size: 36, weight: 600, color: "#111111", align: "center", name: "Face label" });
      d.ellipse(980, 480, 200, 200, "#111111", { name: "Dot", bind: { fill: "ink" } });
      d.text("?!", 980, 520, 200, 130, { size: 110, weight: 800, font: "Space Grotesk", color: "#ffe600", align: "center", lh: 1, name: "Punctuation", bind: { color: "accent" } });
    },
  },
  {
    key: "thumbnail-split",
    name: "Split video thumbnail",
    description: "A two-tone thumbnail: bold title on dark, a big circular photo area on amber.",
    category: "social-media",
    sub: "youtube-thumbnails",
    secondary: ["education-learning"],
    format: "social",
    styles: ["modern", "creative-studio"],
    keywords: ["youtube", "thumbnail", "tutorial", "how to", "guide", "video cover"],
    tags: ["youtube", "tutorial"],
    width: 1280,
    height: 720,
    bg: "#111827",
    bgBind: "ink",
    alt: "A split video thumbnail: dark left with HOW TO START in white, amber right with a large circular photo frame",
    build: (d) => {
      d.rect(700, 0, 580, 720, "#fbbf24", { name: "Right panel", bind: { fill: "accent" } });
      d.rect(48, 56, 280, 60, "#fbbf24", { name: "Pill", radius: 30, bind: { fill: "accent" } });
      d.text("FREE GUIDE", 48, 68, 280, 40, { size: 30, weight: 800, font: "Space Grotesk", color: "#111827", align: "center", name: "Pill label", bind: { color: "ink" } });
      d.text("HOW TO\nSTART", 48, 160, 640, 380, { size: 150, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 0.98, name: "Title", bind: { color: "paper", font: "heading" } });
      d.text("in under 10 minutes", 48, 560, 640, 70, { size: 54, weight: 500, color: "#fbbf24", name: "Subtitle", bind: { color: "accent", font: "body" } });
      d.ellipse(770, 110, 440, 440, "#fde68a", { name: "Photo circle", stroke: "#111827", strokeWidth: 12, bind: { stroke: "ink" } });
      d.text("Your photo", 770, 300, 440, 60, { size: 38, weight: 600, color: "#92400e", align: "center", name: "Photo label" });
      d.text("TUTORIAL", 770, 600, 440, 60, { size: 40, weight: 800, font: "Monospace", color: "#111827", align: "center", name: "Tag", bind: { color: "ink" } });
    },
  },
  {
    key: "facebook-cover-brand",
    name: "Brand page cover",
    description: "A calm teal cover with the headline placed clear of the profile picture.",
    category: "social-media",
    sub: "facebook-graphics",
    secondary: ["logos-brand-identity"],
    format: "social",
    styles: ["corporate", "organic"],
    keywords: ["facebook", "cover", "banner", "page header", "brand", "business"],
    tags: ["cover"],
    width: 1640,
    height: 856,
    bg: "#0f3d3e",
    bgBind: "primary",
    alt: "A teal page cover with three soft circles on the left and a headline and tagline on the right",
    build: (d) => {
      d.ellipse(60, 120, 520, 520, "#14595a", { name: "Circle large" });
      d.ellipse(380, 360, 360, 360, "#e6b85c", { name: "Circle gold", opacity: 0.9, bind: { fill: "accent" } });
      d.ellipse(220, 40, 200, 200, "#7fb7a4", { name: "Circle mint", opacity: 0.8 });
      d.text("Your business name", 820, 250, 760, 260, { size: 100, weight: 700, font: "Lora", color: "#f5efe0", lh: 1.08, name: "Headline", bind: { color: "paper", font: "heading" } });
      d.rect(820, 540, 96, 8, "#e6b85c", { name: "Rule", bind: { fill: "accent" } });
      d.text("One line about what you do and who it is for.", 820, 580, 740, 130, { size: 40, weight: 400, color: "#cfe3dc", lh: 1.3, name: "Tagline", bind: { font: "body" } });
      d.logoSlot(1400, 60, 180, 90);
    },
  },
  {
    key: "header-minimal",
    name: "Minimal profile header",
    description: "A quiet banner with a name, a single line of what you do and a small accent dot.",
    category: "social-media",
    sub: "channel-banners",
    secondary: ["portfolios-personal-branding"],
    format: "social",
    styles: ["minimal", "editorial"],
    keywords: ["header", "banner", "x", "twitter", "profile", "channel", "cover"],
    aliases: ["twitter header"],
    tags: ["header"],
    width: 1500,
    height: 500,
    bg: "#fafaf9",
    bgBind: "paper",
    alt: "A wide off-white banner with a bold name, a one-line description and a small orange dot",
    build: (d) => {
      d.rect(80, 100, 1340, 2, "#1c1917", { name: "Top rule", bind: { fill: "ink" } });
      d.text("Your Name", 80, 150, 900, 130, { size: 110, weight: 700, font: "DM Sans", color: "#1c1917", name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Designer, writer and maker of small useful things.", 80, 300, 1120, 60, { size: 38, weight: 400, color: "#57534e", name: "Description", bind: { font: "body" } });
      d.ellipse(1260, 150, 160, 160, "#ea580c", { name: "Accent dot", bind: { fill: "accent" } });
      d.text("Based in Your City", 1060, 380, 360, 40, { size: 28, weight: 500, font: "Monospace", color: "#78716c", align: "right", name: "Location", bind: { font: "body" } });
    },
  },
];
