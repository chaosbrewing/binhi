import type { DesignSpec } from "./types.js";

/** Personal branding, invitations and reusable layouts. */
export const MISC: DesignSpec[] = [
  {
    key: "press-kit-cover",
    name: "Press kit cover",
    description: "A calm A4 cover for a personal press kit: a portrait frame, your name, a one-line bio and contact.",
    category: "portfolios-personal-branding",
    sub: "press-kits",
    secondary: ["marketing-advertising"],
    format: "print",
    styles: ["editorial", "minimal"],
    keywords: ["press kit", "bio", "profile", "personal brand", "media", "portfolio", "about"],
    tags: ["press kit"],
    width: 2480,
    height: 3508,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white A4 cover with a large gray portrait frame at the top, a serif name and a short bio with contact lines",
    build: (d) => {
      d.photo(0, 0, 2480, 1900, { fill: "#d8d4cc", label: "Your portrait or signature image", size: 70 });
      d.rect(160, 1700, 1500, 400, "#ffffff", { name: "Title card", bind: { fill: "paper" } });
      d.text("PRESS KIT 2026", 220, 1740, 1300, 70, { size: 52, weight: 700, font: "Monospace", color: "#0f766e", name: "Label", bind: { color: "accent" } });
      d.text("Your Name", 220, 1830, 1400, 230, { size: 200, weight: 600, font: "Playfair Display", color: "#111111", lh: 1, name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Illustrator and author based in Your City. Work has appeared in magazines, books and exhibitions worldwide.", 160, 2300, 1700, 330, { size: 78, weight: 400, color: "#2f2f2f", lh: 1.35, name: "Bio", bind: { font: "body" } });
      d.rect(160, 2800, 2160, 4, "#111111", { name: "Rule", bind: { fill: "ink" } });
      d.text("PRESS CONTACT", 160, 2880, 900, 60, { size: 48, weight: 700, font: "Monospace", color: "#0f766e", name: "Contact label", bind: { color: "accent" } });
      d.text("press@example.com\nyoursite.com", 160, 2970, 1400, 220, { size: 72, weight: 400, color: "#111111", lh: 1.35, name: "Contact", bind: { color: "ink", font: "body" } });
      d.logoSlot(1900, 2900, 420, 300);
    },
  },
  {
    key: "about-me-card",
    name: "About me card",
    description: "A portrait profile card with a round photo, your name, three skill pills and a link, for introductions.",
    category: "portfolios-personal-branding",
    sub: "freelancer-profiles",
    secondary: ["social-media"],
    format: "social",
    styles: ["modern", "playful"],
    keywords: ["about me", "bio", "profile", "intro", "introduction", "freelancer", "skills", "personal brand"],
    tags: ["profile"],
    width: 1080,
    height: 1350,
    bg: "#ede9fe",
    bgBind: "paper",
    alt: "A lilac portrait card with a round photo frame, the name Sam Okafor, three skill pills and a link in a violet button",
    build: (d) => {
      d.rect(60, 60, 960, 1230, "#ffffff", { name: "Card", radius: 40 });
      d.ellipse(340, 130, 400, 400, "#ddd6fe", { name: "Photo circle", bind: { fill: "accent" } });
      d.text("Your photo", 340, 310, 400, 50, { size: 34, weight: 500, color: "#6d28d9", align: "center", name: "Photo label" });
      d.text("Sam Okafor", 120, 590, 840, 110, { size: 90, weight: 800, font: "Space Grotesk", color: "#1e1b4b", align: "center", name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Product designer who loves clear interfaces and good coffee.", 140, 720, 800, 160, { size: 44, weight: 400, color: "#4c4a68", align: "center", lh: 1.3, name: "Bio", bind: { font: "body" } });
      const skills = ["UX design", "Research", "Prototyping"];
      skills.forEach((label, i) => {
        d.rect(120 + i * 290, 920, 270, 80, "#ede9fe", { name: `Pill ${i + 1}`, radius: 40 });
        d.text(label, 120 + i * 290, 940, 270, 44, { size: 32, weight: 700, color: "#5b21b6", align: "center", name: `Skill ${i + 1}` });
      });
      d.rect(240, 1100, 600, 100, "#6d28d9", { name: "Link button", radius: 50, bind: { fill: "primary" } });
      d.text("yoursite.com", 240, 1126, 600, 50, { size: 38, weight: 700, color: "#ffffff", align: "center", name: "Link", bind: { color: "paper" } });
    },
  },
  {
    key: "invitation-wedding",
    name: "Wedding invitation",
    description: "A formal A5 invitation with two names in large serif type, a date, a place and an RSVP line.",
    category: "invitations-events",
    sub: "wedding-invitations",
    secondary: ["posters-flyers"],
    format: "print",
    styles: ["elegant", "minimal"],
    keywords: ["wedding", "invitation", "invite", "marriage", "rsvp", "ceremony", "save the date"],
    tags: ["wedding"],
    width: 1748,
    height: 2480,
    bg: "#fbf8f2",
    bgBind: "paper",
    alt: "A cream A5 wedding invitation with the names Anna and James in large serif type, a date and a thin gold border",
    build: (d) => {
      d.rect(90, 90, 1568, 2300, "transparent", { name: "Border", stroke: "#b08d3e", strokeWidth: 3, bind: { stroke: "accent" } });
      d.text("TOGETHER WITH THEIR FAMILIES", 200, 330, 1348, 70, { size: 48, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "Kicker", bind: { color: "accent" } });
      d.text("Anna", 200, 520, 1348, 340, { size: 290, weight: 500, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1, name: "First name", bind: { color: "ink", font: "heading" } });
      d.text("&", 200, 870, 1348, 200, { size: 170, weight: 400, font: "Playfair Display", color: "#b08d3e", align: "center", lh: 1, name: "Ampersand", bind: { color: "accent" } });
      d.text("James", 200, 1060, 1348, 340, { size: 290, weight: 500, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1, name: "Second name", bind: { color: "ink", font: "heading" } });
      d.text("invite you to celebrate their wedding", 200, 1560, 1348, 80, { size: 58, weight: 400, font: "Playfair Display", color: "#5a4a36", align: "center", name: "Invite line", bind: { font: "body" } });
      d.text("Saturday 12 September 2026\nat four o'clock in the afternoon", 200, 1720, 1348, 220, { size: 66, weight: 500, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1.3, name: "Date", bind: { color: "ink", font: "heading" } });
      d.text("The Garden House, Your City", 200, 2030, 1348, 80, { size: 58, weight: 400, font: "Playfair Display", color: "#5a4a36", align: "center", name: "Place", bind: { font: "body" } });
      d.text("RSVP by 1 August  ·  rsvp@example.com", 200, 2210, 1348, 70, { size: 50, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "RSVP", bind: { color: "accent" } });
    },
  },
  {
    key: "invitation-birthday",
    name: "Birthday party invitation",
    description: "A bright square invitation with confetti circles, big party type and the who, when and where.",
    category: "invitations-events",
    sub: "birthday-invitations",
    secondary: ["seasonal-holiday", "social-media"],
    format: "social",
    styles: ["playful", "retro"],
    keywords: ["birthday", "party", "invitation", "invite", "celebration", "kids", "confetti", "rsvp"],
    tags: ["birthday"],
    width: 1080,
    height: 1080,
    bg: "#fde047",
    bgBind: "accent",
    alt: "A yellow square birthday invitation with colorful confetti circles, huge PARTY TIME text and event details on a white card",
    build: (d) => {
      const confetti: [number, number, number, string][] = [[60, 70, 110, "#ef4444"], [900, 60, 150, "#3b82f6"], [890, 330, 70, "#ec4899"], [40, 330, 90, "#22c55e"], [930, 700, 120, "#a855f7"], [70, 760, 140, "#f97316"]];
      confetti.forEach(([x, y, size, color], i) => d.ellipse(x, y, size, size, color, { name: `Confetti ${i + 1}` }));
      d.text("YOU'RE INVITED", 100, 130, 880, 60, { size: 44, weight: 800, font: "Monospace", color: "#1f2937", align: "center", name: "Kicker", bind: { color: "ink" } });
      d.text("PARTY\nTIME!", 60, 210, 960, 440, { size: 200, weight: 800, font: "Space Grotesk", color: "#be123c", align: "center", lh: 0.95, name: "Headline", bind: { color: "primary", font: "heading" } });
      d.rect(140, 700, 800, 290, "#ffffff", { name: "Details card", radius: 32 });
      d.text("Mia turns 7!", 140, 725, 800, 80, { size: 62, weight: 800, font: "Space Grotesk", color: "#1f2937", align: "center", name: "Who", bind: { color: "ink", font: "heading" } });
      d.text("Saturday 20 June, 2 to 5 pm\n14 Example Street  ·  RSVP 0000 000 000", 160, 820, 760, 150, { size: 38, weight: 500, color: "#374151", align: "center", lh: 1.35, name: "Details", bind: { font: "body" } });
    },
  },
  {
    key: "layout-hero-statement",
    name: "Statement slide layout",
    description: "A reusable landscape layout with one large statement, a supporting line and a footer, for talks and covers.",
    category: "blank-custom-creations",
    sub: "reusable-layouts",
    secondary: ["presentations-pitch-decks"],
    format: "custom",
    styles: ["minimal", "editorial"],
    keywords: ["layout", "statement", "title", "slide", "cover", "presentation", "headline", "quote"],
    tags: ["layout"],
    width: 1920,
    height: 1080,
    bg: "#f5f2ec",
    bgBind: "paper",
    alt: "A warm off-white landscape layout with a large serif statement, a supporting line and a small footer row",
    build: (d) => {
      d.rect(120, 120, 120, 10, "#c2410c", { name: "Accent rule", bind: { fill: "accent" } });
      d.text("One clear idea, said once, said well.", 120, 220, 1500, 520, { size: 150, weight: 600, font: "Playfair Display", color: "#1c1917", lh: 1.08, name: "Statement", bind: { color: "ink", font: "heading" } });
      d.text("A short line that adds context for the statement above.", 120, 800, 1400, 70, { size: 48, weight: 400, color: "#57534e", name: "Support", bind: { font: "body" } });
      d.text("Your name  ·  Event or date", 120, 960, 1000, 44, { size: 30, weight: 500, font: "Monospace", color: "#78716c", name: "Footer", bind: { font: "body" } });
    },
  },
  {
    key: "layout-three-cards",
    name: "Three-card layout",
    description: "A reusable landscape layout with a title and three equal cards, for features, steps or services.",
    category: "blank-custom-creations",
    sub: "reusable-layouts",
    secondary: ["infographics-diagrams", "presentations-pitch-decks"],
    format: "custom",
    styles: ["modern", "corporate"],
    keywords: ["layout", "three columns", "cards", "features", "steps", "services", "overview", "process"],
    tags: ["layout"],
    width: 1920,
    height: 1080,
    bg: "#f1f5f9",
    bgBind: "paper",
    alt: "A light landscape layout with a title and three white rounded cards, each with a numbered circle, a heading and a short text",
    build: (d) => {
      d.text("How it works", 100, 90, 1400, 130, { size: 100, weight: 800, font: "DM Sans", color: "#0f172a", name: "Title", bind: { color: "ink", font: "heading" } });
      d.text("Three simple steps from start to finish.", 100, 230, 1400, 60, { size: 40, weight: 400, color: "#475569", name: "Subtitle", bind: { font: "body" } });
      const cards: [string, string][] = [["Tell us", "Share what you need in a few short lines."], ["We build", "We turn it into a first version within days."], ["You launch", "Review, adjust and publish when you are ready."]];
      cards.forEach(([title, body], i) => {
        const x = 100 + i * 590;
        d.rect(x, 380, 540, 580, "#ffffff", { name: `Card ${i + 1}`, radius: 28 });
        d.ellipse(x + 40, 420, 110, 110, "#2563eb", { name: `Number circle ${i + 1}`, bind: { fill: "primary" } });
        d.text(String(i + 1), x + 40, 445, 110, 70, { size: 60, weight: 800, font: "DM Sans", color: "#ffffff", align: "center", name: `Number ${i + 1}`, bind: { color: "paper" } });
        d.text(title, x + 40, 580, 460, 80, { size: 60, weight: 800, font: "DM Sans", color: "#0f172a", name: `Card title ${i + 1}`, bind: { color: "ink", font: "heading" } });
        d.text(body, x + 40, 690, 460, 200, { size: 38, weight: 400, color: "#475569", lh: 1.35, name: `Card text ${i + 1}`, bind: { font: "body" } });
      });
    },
  },
  {
    key: "planner-weekly",
    name: "Weekly planner",
    description: "A printable A4 week: seven ruled day rows, a priorities box and a notes strip.",
    category: "planners-productivity",
    sub: "weekly-planners",
    secondary: ["blank-custom-creations"],
    format: "print",
    styles: ["minimal", "organic"],
    keywords: ["planner", "weekly", "schedule", "to do", "calendar", "organizer", "productivity", "printable"],
    aliases: ["week planner", "timetable"],
    tags: ["planner"],
    width: 2480,
    height: 3508,
    bg: "#fcfbf7",
    bgBind: "paper",
    alt: "A cream A4 weekly planner with seven day rows, a priorities box on the right and a notes strip at the bottom",
    build: (d) => {
      d.text("Week of ____ / ____", 160, 140, 1500, 130, { size: 110, weight: 700, font: "Lora", color: "#1f2a1f", name: "Title", bind: { color: "ink", font: "heading" } });
      d.rect(160, 300, 2160, 6, "#3f7d58", { name: "Title rule", bind: { fill: "primary" } });
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      days.forEach((day, i) => {
        const y = 360 + i * 400;
        d.text(day, 160, y + 60, 420, 80, { size: 66, weight: 700, font: "Lora", color: "#3f7d58", name: day, bind: { color: "primary", font: "heading" } });
        d.rect(600, y + 170, 1000, 3, "#c9d3c7", { name: `${day} line one` });
        d.rect(600, y + 290, 1000, 3, "#c9d3c7", { name: `${day} line two` });
      });
      d.rect(1720, 360, 600, 1300, "#e7efe6", { name: "Priorities box", radius: 20, bind: { fill: "paper" } });
      d.text("Top priorities", 1760, 400, 520, 80, { size: 62, weight: 700, font: "Lora", color: "#1f2a1f", name: "Priorities title", bind: { color: "ink", font: "heading" } });
      [1, 2, 3, 4].forEach((n) => d.rect(1760, 440 + n * 240, 520, 3, "#9db39a", { name: `Priority line ${n}` }));
      d.rect(1720, 1760, 600, 1400, "#f3efe2", { name: "Notes box", radius: 20 });
      d.text("Notes", 1760, 1800, 520, 80, { size: 62, weight: 700, font: "Lora", color: "#1f2a1f", name: "Notes title", bind: { color: "ink", font: "heading" } });
      d.text("Make it a good week.", 160, 3330, 2160, 80, { size: 56, weight: 500, font: "Lora", color: "#6b756a", name: "Footer", bind: { font: "body" } });
    },
  },
  {
    key: "menu-restaurant",
    name: "Restaurant menu",
    description: "A dark green A5 menu with gold headings: starters, mains and desserts with prices.",
    category: "food-hospitality",
    sub: "restaurant-menus",
    secondary: ["business-essentials"],
    format: "print",
    styles: ["elegant", "editorial"],
    keywords: ["menu", "restaurant", "cafe", "food", "dishes", "dining", "prices", "bistro"],
    aliases: ["food menu"],
    tags: ["menu"],
    width: 1748,
    height: 2480,
    bg: "#16261f",
    bgBind: "primary",
    alt: "A dark green A5 menu with a gold serif title and three sections of dishes with prices",
    build: (d) => {
      d.text("The Garden Table", 140, 130, 1468, 200, { size: 150, weight: 600, font: "Playfair Display", color: "#e8c872", align: "center", lh: 1, name: "Restaurant name", bind: { color: "accent", font: "heading" } });
      d.text("SEASONAL KITCHEN  ·  EST. 2026", 140, 340, 1468, 60, { size: 46, weight: 500, font: "Monospace", color: "#a8b8a8", align: "center", name: "Tagline", bind: { color: "paper" } });
      d.rect(724, 440, 300, 3, "#e8c872", { name: "Rule", bind: { fill: "accent" } });
      const sections: [string, [string, string][]][] = [
        ["STARTERS", [["Roasted beetroot, goat cheese", "12"], ["Wild mushroom soup", "10"], ["Smoked trout, pickled fennel", "14"]]],
        ["MAINS", [["Herb-crusted lamb, greens", "28"], ["Pan-fried sea bass, citrus", "26"], ["Garden risotto, parmesan", "21"]]],
        ["DESSERTS", [["Honey and fig tart", "9"], ["Dark chocolate pot", "9"]]],
      ];
      let y = 540;
      for (const [title, items] of sections) {
        d.text(title, 140, y, 1468, 70, { size: 56, weight: 700, font: "Monospace", color: "#e8c872", name: `${title} heading`, bind: { color: "accent" } });
        y += 100;
        for (const [dish, price] of items) {
          d.text(dish, 140, y, 1200, 70, { size: 60, weight: 400, font: "Playfair Display", color: "#f2ede0", name: dish, bind: { color: "paper", font: "body" } });
          d.text(price, 1400, y, 208, 70, { size: 60, weight: 600, font: "Playfair Display", color: "#e8c872", align: "right", name: `${dish} price`, bind: { color: "accent" } });
          y += 128;
        }
        y += 80;
      }
      d.text("Please tell us about any allergies.", 140, 2290, 1468, 60, { size: 46, weight: 400, font: "Playfair Display", color: "#a8b8a8", align: "center", name: "Note", bind: { font: "body" } });
      d.logoSlot(724, 2370, 300, 80);
    },
  },
  {
    key: "flyer-property-listing",
    name: "Property listing flyer",
    description: "A portrait listing flyer: a large photo frame, price and address, three key facts and agent details.",
    category: "real-estate-architecture",
    sub: "property-listings",
    secondary: ["posters-flyers", "marketing-advertising"],
    format: "print",
    styles: ["corporate", "modern"],
    keywords: ["property", "real estate", "listing", "house", "for sale", "apartment", "estate agent", "open house"],
    aliases: ["house for sale", "estate flyer"],
    tags: ["property"],
    width: 1748,
    height: 2480,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white A5 property flyer with a large photo frame, a navy price band, three fact tiles and agent contact details",
    build: (d) => {
      d.photo(0, 0, 1748, 1150, { fill: "#d5d9de", label: "Main property photo", size: 64 });
      d.rect(0, 1150, 1748, 230, "#12355b", { name: "Price band", bind: { fill: "primary" } });
      d.text("FOR SALE", 120, 1190, 600, 56, { size: 44, weight: 700, font: "Monospace", color: "#8cc4ff", name: "Status", bind: { color: "accent" } });
      d.text("$450,000", 120, 1250, 900, 110, { size: 100, weight: 800, font: "DM Sans", color: "#ffffff", name: "Price", bind: { color: "paper", font: "heading" } });
      d.text("12 Example Street, Your City", 120, 1430, 1508, 90, { size: 68, weight: 700, font: "DM Sans", color: "#0f172a", name: "Address", bind: { color: "ink", font: "heading" } });
      const facts: [string, string][] = [["3", "Bedrooms"], ["2", "Bathrooms"], ["140 m²", "Living area"]];
      facts.forEach(([n, label], i) => {
        const x = 120 + i * 520;
        d.rect(x, 1580, 470, 220, "#eef4fb", { name: `Fact tile ${i + 1}`, radius: 20 });
        d.text(n, x, 1610, 470, 110, { size: 90, weight: 800, font: "DM Sans", color: "#12355b", align: "center", name: `Fact ${i + 1}`, bind: { color: "primary", font: "heading" } });
        d.text(label, x, 1730, 470, 60, { size: 46, weight: 400, color: "#475569", align: "center", name: `Fact label ${i + 1}` });
      });
      d.text("Bright family home with a south-facing garden, close to schools and transport. Viewings by appointment.", 120, 1880, 1508, 190, { size: 54, weight: 400, color: "#1e293b", lh: 1.35, name: "Description", bind: { font: "body" } });
      d.rect(120, 2140, 1508, 3, "#cbd5e1", { name: "Rule" });
      d.text("Your Name  ·  Your Agency\n+00 000 000 000  ·  agent@example.com", 120, 2200, 1100, 150, { size: 52, weight: 600, color: "#0f172a", lh: 1.4, name: "Agent", bind: { color: "ink", font: "body" } });
      d.logoSlot(1328, 2190, 300, 160);
    },
  },
  {
    key: "podcast-cover",
    name: "Podcast cover art",
    description: "Square cover art with a big show title, a sun-and-wave motif and a host line, sized for podcast apps.",
    category: "music-podcasts-entertainment",
    sub: "podcast-covers",
    secondary: ["social-media"],
    format: "social",
    styles: ["retro", "playful"],
    keywords: ["podcast", "cover art", "show", "audio", "episode", "host", "radio", "album"],
    aliases: ["podcast artwork"],
    tags: ["podcast"],
    width: 3000,
    height: 3000,
    bg: "#1f1147",
    bgBind: "ink",
    alt: "A deep purple square podcast cover with an orange sun, pink waves, the title The Slow Hour and a host line",
    build: (d) => {
      d.ellipse(700, 300, 1600, 1600, "#ff8a3d", { name: "Sun", bind: { fill: "accent" } });
      d.rect(0, 1650, 3000, 1350, "#1f1147", { name: "Horizon cover", bind: { fill: "ink" } });
      for (let i = 0; i < 4; i += 1) d.rect(0, 1650 + i * 90, 3000, 40 - i * 7, "#ff5d9e", { name: `Wave ${i + 1}`, bind: { fill: "primary" } });
      d.text("THE SLOW\nHOUR", 200, 1900, 2600, 800, { size: 380, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 0.95, name: "Title", bind: { color: "paper", font: "heading" } });
      d.text("Conversations about living at a gentler pace", 200, 2760, 2600, 110, { size: 76, weight: 500, font: "DM Sans", color: "#e5d9ff", name: "Tagline", bind: { font: "body" } });
      d.text("HOSTED BY YOUR NAME", 200, 180, 2600, 100, { size: 80, weight: 700, font: "Monospace", color: "#ffd9b8", name: "Host", bind: { color: "paper" } });
    },
  },
];
