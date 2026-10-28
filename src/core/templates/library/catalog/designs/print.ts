import type { DesignSpec } from "./types.js";

/**
 * Posters and flyers. A4 is 2480 x 3508 and A5 is 1748 x 2480 at 300 dpi.
 * Exports are PNG or JPEG: there is no PDF export yet, so these are
 * print-size images. Body text stays at or above 56 px (about 14 pt).
 */
export const PRINT: DesignSpec[] = [
  {
    key: "poster-open-air",
    name: "Open-air event poster",
    description: "A type-led black poster with huge stacked words, a hot orange accent and a clear details block.",
    category: "posters-flyers",
    sub: "event-posters",
    secondary: ["invitations-events"],
    format: "print",
    styles: ["brutalist", "modern"],
    keywords: ["event", "festival", "poster", "open air", "music", "outdoor"],
    tags: ["poster"],
    featured: true,
    width: 2480,
    height: 3508,
    bg: "#101010",
    bgBind: "ink",
    alt: "A black A4 poster with huge OPEN AIR letters in orange and white and a block of event details",
    build: (d) => {
      d.text("SUMMER SERIES 2026", 160, 160, 1600, 90, { size: 72, weight: 700, font: "Monospace", color: "#ff5a36", name: "Kicker", bind: { color: "accent" } });
      d.text("OPEN", 140, 280, 2200, 700, { size: 600, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 1, name: "Word one", bind: { color: "paper", font: "heading" } });
      d.text("AIR", 140, 920, 2200, 700, { size: 600, weight: 800, font: "Space Grotesk", color: "#ff5a36", lh: 1, name: "Word two", bind: { color: "accent", font: "heading" } });
      d.rect(160, 1730, 2160, 8, "#ffffff", { name: "Rule", opacity: 0.4 });
      d.text("SATURDAY 14 JUNE", 160, 1830, 2160, 190, { size: 160, weight: 800, font: "Space Grotesk", color: "#ffffff", name: "Date", bind: { color: "paper", font: "heading" } });
      d.text("Riverside Park, Your City\nGates 2 pm  ·  Music from 4 pm", 160, 2090, 2160, 300, { size: 96, weight: 400, color: "#d4d4d4", lh: 1.35, name: "Place and time", bind: { font: "body" } });
      d.text("Free entry. Bring a blanket.", 160, 2490, 2160, 130, { size: 96, weight: 600, color: "#ff5a36", name: "Note", bind: { color: "accent", font: "body" } });
      d.rect(0, 2930, 2480, 578, "#ff5a36", { name: "Ticket band", bind: { fill: "accent" } });
      d.text("TICKETS", 160, 3040, 1500, 200, { size: 170, weight: 800, font: "Space Grotesk", color: "#101010", name: "Tickets", bind: { color: "ink", font: "heading" } });
      d.text("yoursite.com/openair", 160, 3260, 1700, 110, { size: 80, weight: 600, font: "Monospace", color: "#101010", name: "Web address", bind: { color: "ink" } });
      d.logoSlot(1900, 3080, 420, 260);
    },
  },
  {
    key: "poster-gig-retro",
    name: "Retro gig poster",
    description: "A cream gig poster with a striped rising sun, a heavy serif band name and a lineup.",
    category: "posters-flyers",
    sub: "concert-posters",
    secondary: ["music-podcasts-entertainment"],
    format: "print",
    styles: ["retro", "artistic"],
    keywords: ["concert", "gig", "band", "live music", "retro", "poster", "tour"],
    tags: ["music", "poster"],
    width: 2480,
    height: 3508,
    bg: "#f1e4c3",
    bgBind: "paper",
    alt: "A cream A4 gig poster with concentric red, orange and yellow sun circles and a heavy serif band name",
    build: (d) => {
      d.ellipse(390, 260, 1700, 1700, "#d8432b", { name: "Sun outer", bind: { fill: "primary" } });
      d.ellipse(570, 440, 1340, 1340, "#ee8a2b", { name: "Sun middle", bind: { fill: "accent" } });
      d.ellipse(750, 620, 980, 980, "#f6c945", { name: "Sun inner" });
      d.rect(0, 1560, 2480, 120, "#f1e4c3", { name: "Horizon stripe one", bind: { fill: "paper" } });
      d.rect(0, 1760, 2480, 80, "#f1e4c3", { name: "Horizon stripe two", bind: { fill: "paper" } });
      d.text("LIVE ON STAGE", 160, 150, 2160, 100, { size: 84, weight: 700, font: "Monospace", color: "#2b1b0e", align: "center", name: "Kicker", bind: { color: "ink" } });
      d.text("THE MIDNIGHT\nCOLLECTIVE", 100, 2040, 2280, 700, { size: 270, weight: 800, font: "Georgia", color: "#2b1b0e", align: "center", lh: 1.02, name: "Band name", bind: { color: "ink", font: "heading" } });
      d.text("with Paper Lanterns  ·  Low Tide  ·  Sol", 160, 2780, 2160, 100, { size: 72, weight: 500, font: "Georgia", color: "#5a3d22", align: "center", name: "Support acts", bind: { font: "body" } });
      d.rect(160, 2960, 2160, 6, "#2b1b0e", { name: "Rule", bind: { fill: "ink" } });
      d.text("FRIDAY 3 OCTOBER  ·  DOORS 8 PM\nThe Old Hall, Your City\nTickets at the door", 160, 3020, 2160, 400, { size: 80, weight: 700, font: "Monospace", color: "#2b1b0e", align: "center", lh: 1.4, name: "Details", bind: { color: "ink" } });
    },
  },
  {
    key: "flyer-sale-tiles",
    name: "Sale flyer",
    description: "A pink A5 flyer with three bold percentage tiles, a short offer line and the store details.",
    category: "posters-flyers",
    sub: "sale-announcements",
    secondary: ["marketing-advertising"],
    format: "print",
    styles: ["playful", "modern"],
    keywords: ["sale", "discount", "flyer", "offer", "store", "shop", "percent"],
    tags: ["sale", "flyer"],
    width: 1748,
    height: 2480,
    bg: "#ffe4ea",
    bgBind: "paper",
    alt: "A pink A5 flyer with a huge SALE headline and three rounded tiles reading 20, 30 and 50 percent",
    build: (d) => {
      d.text("BIG", 120, 130, 1500, 330, { size: 300, weight: 800, font: "Space Grotesk", color: "#be123c", lh: 1, name: "Headline one", bind: { color: "primary", font: "heading" } });
      d.text("SALE", 120, 430, 1500, 460, { size: 440, weight: 800, font: "Space Grotesk", color: "#1c1917", lh: 1, name: "Headline two", bind: { color: "ink", font: "heading" } });
      d.rect(120, 1000, 480, 560, "#be123c", { name: "Tile one", radius: 48, bind: { fill: "primary" } });
      d.rect(634, 1000, 480, 560, "#1c1917", { name: "Tile two", radius: 48, bind: { fill: "ink" } });
      d.rect(1148, 1000, 480, 560, "#f59e0b", { name: "Tile three", radius: 48, bind: { fill: "accent" } });
      d.text("20%", 120, 1090, 480, 200, { size: 150, weight: 800, font: "Space Grotesk", color: "#ffffff", align: "center", name: "Percent one" });
      d.text("30%", 634, 1090, 480, 200, { size: 150, weight: 800, font: "Space Grotesk", color: "#ffffff", align: "center", name: "Percent two" });
      d.text("50%", 1148, 1090, 480, 200, { size: 150, weight: 800, font: "Space Grotesk", color: "#1c1917", align: "center", name: "Percent three" });
      d.text("Tops", 120, 1360, 480, 90, { size: 66, weight: 600, color: "#ffe4ea", align: "center", name: "Label one" });
      d.text("Shoes", 634, 1360, 480, 90, { size: 66, weight: 600, color: "#f5f5f4", align: "center", name: "Label two" });
      d.text("Bags", 1148, 1360, 480, 90, { size: 66, weight: 600, color: "#1c1917", align: "center", name: "Label three" });
      d.text("Three days only. In store and online.", 120, 1700, 1500, 170, { size: 84, weight: 600, color: "#1c1917", lh: 1.2, name: "Offer", bind: { color: "ink", font: "body" } });
      d.text("Thursday to Saturday  ·  10 am to 8 pm\n12 Example Street, Your City", 120, 1960, 1500, 200, { size: 62, weight: 400, color: "#57534e", lh: 1.4, name: "Store details", bind: { font: "body" } });
      d.logoSlot(1240, 2200, 400, 190);
    },
  },
  {
    key: "flyer-hiring",
    name: "We're hiring flyer",
    description: "A clear recruitment flyer: a navy header, open roles, how to apply and contact details.",
    category: "posters-flyers",
    sub: "recruitment-flyers",
    secondary: ["business-essentials"],
    format: "print",
    styles: ["corporate", "minimal"],
    keywords: ["hiring", "jobs", "recruitment", "vacancy", "careers", "team", "join us"],
    tags: ["hiring"],
    width: 1748,
    height: 2480,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white A5 flyer with a navy header reading WE'RE HIRING, a list of three open roles and an apply box",
    build: (d) => {
      d.rect(0, 0, 1748, 760, "#0f2a4a", { name: "Header block", bind: { fill: "primary" } });
      d.text("JOIN OUR TEAM", 120, 130, 1500, 70, { size: 56, weight: 700, font: "Monospace", color: "#7dd3fc", name: "Kicker", bind: { color: "accent" } });
      d.text("We're\nhiring", 120, 230, 1500, 440, { size: 200, weight: 800, font: "DM Sans", color: "#ffffff", lh: 1, name: "Headline", bind: { color: "paper", font: "heading" } });
      d.text("OPEN ROLES", 120, 880, 1500, 70, { size: 56, weight: 700, font: "Monospace", color: "#0f2a4a", name: "Roles label", bind: { color: "primary" } });
      const roles: [string, string][] = [["Customer care lead", "Full time  ·  Your City"], ["Delivery driver", "Part time  ·  Flexible hours"], ["Kitchen assistant", "Full time  ·  Morning shift"]];
      roles.forEach(([title, meta], i) => {
        const y = 1000 + i * 250;
        d.rect(120, y, 16, 190, "#38bdf8", { name: `Role bar ${i + 1}`, bind: { fill: "accent" } });
        d.text(title, 180, y, 1400, 100, { size: 76, weight: 700, color: "#0f172a", name: `Role ${i + 1}`, bind: { color: "ink", font: "heading" } });
        d.text(meta, 180, y + 108, 1400, 70, { size: 56, weight: 400, color: "#475569", name: `Role detail ${i + 1}`, bind: { font: "body" } });
      });
      d.rect(120, 1840, 1508, 380, "#e0f2fe", { name: "Apply box", radius: 32 });
      d.text("How to apply", 180, 1880, 1300, 90, { size: 70, weight: 700, color: "#0f2a4a", name: "Apply title", bind: { color: "primary", font: "heading" } });
      d.text("Send your name and a short note to\njobs@yourcompany.com by 30 November.", 180, 1990, 1400, 200, { size: 58, weight: 400, color: "#0f172a", lh: 1.35, name: "Apply details", bind: { font: "body" } });
      d.logoSlot(1248, 2290, 380, 130);
    },
  },
  {
    key: "flyer-community-notice",
    name: "Community notice",
    description: "A friendly green notice with the key facts in rows and six tear-off tabs along the bottom.",
    category: "posters-flyers",
    sub: "community-notices",
    secondary: ["nonprofits-community"],
    format: "print",
    styles: ["organic", "playful"],
    keywords: ["community", "notice", "volunteer", "neighbourhood", "clean up", "tear off", "announcement"],
    tags: ["community"],
    width: 1748,
    height: 2480,
    bg: "#f3f1e4",
    bgBind: "paper",
    alt: "A cream A5 notice with a green header, three fact rows and six vertical tear-off tabs at the bottom",
    build: (d) => {
      d.rect(0, 0, 1748, 640, "#2f6b3f", { name: "Header block", bind: { fill: "primary" } });
      d.ellipse(1300, -120, 640, 640, "#4f9a5d", { name: "Leaf shape", opacity: 0.7 });
      d.text("COMMUNITY NOTICE", 120, 120, 1500, 70, { size: 56, weight: 700, font: "Monospace", color: "#cfe8c8", name: "Kicker", bind: { color: "paper" } });
      d.text("Neighbourhood clean-up day", 120, 220, 1400, 360, { size: 130, weight: 800, font: "Lora", color: "#ffffff", lh: 1.05, name: "Headline", bind: { color: "paper", font: "heading" } });
      const rows: [string, string][] = [["WHEN", "Saturday 9 May, 9 am to noon"], ["WHERE", "Meet at the Example Street playground"], ["BRING", "Gloves, a bag and a friend"]];
      rows.forEach(([label, value], i) => {
        const y = 780 + i * 280;
        d.text(label, 120, y, 380, 80, { size: 56, weight: 800, font: "Monospace", color: "#2f6b3f", name: `Label ${i + 1}`, bind: { color: "primary" } });
        d.text(value, 520, y - 8, 1110, 200, { size: 68, weight: 600, color: "#1f2a1f", lh: 1.2, name: `Fact ${i + 1}`, bind: { color: "ink", font: "body" } });
      });
      d.text("Tea and snacks provided. Everyone is welcome.", 120, 1660, 1500, 150, { size: 64, weight: 500, color: "#3f4a3f", lh: 1.3, name: "Note", bind: { font: "body" } });
      d.rect(0, 1900, 1748, 6, "#2f6b3f", { name: "Cut line", bind: { fill: "primary" } });
      for (let i = 0; i < 6; i += 1) {
        const x = 20 + i * 285;
        d.rect(x, 1906, 6, 574, "#2f6b3f", { name: `Tab edge ${i + 1}`, opacity: 0.5 });
        d.text("Your name  ·  0000 000 000", x - 195, 2150, 540, 70, { size: 38, weight: 600, color: "#1f2a1f", align: "center", rotation: 90, name: `Tab ${i + 1}` });
      }
    },
  },
  {
    key: "poster-exhibition",
    name: "Exhibition poster",
    description: "A quiet editorial poster with an abstract shape composition, a big serif title and a ruled details grid.",
    category: "posters-flyers",
    sub: "exhibition-posters",
    secondary: ["books-publishing"],
    format: "print",
    styles: ["editorial", "artistic"],
    keywords: ["exhibition", "gallery", "art", "show", "museum", "opening", "editorial"],
    tags: ["art", "exhibition"],
    width: 2480,
    height: 3508,
    bg: "#efece6",
    bgBind: "paper",
    alt: "An off-white A4 poster with abstract terracotta, blue and mustard shapes above a large serif title and a ruled details grid",
    build: (d) => {
      d.rect(160, 160, 1500, 1500, "#c8553d", { name: "Shape terracotta", bind: { fill: "primary" } });
      d.ellipse(1060, 700, 1260, 1260, "#2f4b7c", { name: "Shape blue", opacity: 0.92, bind: { fill: "ink" } });
      d.rect(600, 1260, 900, 900, "#e8b84a", { name: "Shape mustard", opacity: 0.95, bind: { fill: "accent" } });
      d.text("Surfaces", 160, 2250, 2160, 420, { size: 330, weight: 700, font: "Playfair Display", color: "#1a1a1a", lh: 1, name: "Title", bind: { color: "ink", font: "heading" } });
      d.text("New work by Your Name", 160, 2690, 2160, 110, { size: 90, weight: 400, font: "Playfair Display", color: "#3a3a3a", name: "Subtitle", bind: { font: "heading" } });
      d.rect(160, 2900, 2160, 5, "#1a1a1a", { name: "Rule one", bind: { fill: "ink" } });
      d.text("OPENING\nThu 12 March, 6 pm", 160, 2960, 1000, 200, { size: 64, weight: 500, font: "Monospace", color: "#1a1a1a", lh: 1.4, name: "Opening", bind: { color: "ink" } });
      d.text("ON VIEW\n13 March to 12 April", 1160, 2960, 1160, 200, { size: 64, weight: 500, font: "Monospace", color: "#1a1a1a", lh: 1.4, name: "Dates", bind: { color: "ink" } });
      d.rect(160, 3230, 2160, 5, "#1a1a1a", { name: "Rule two", bind: { fill: "ink" } });
      d.text("Gallery name  ·  1 Example Street, Your City  ·  Free entry", 160, 3290, 2160, 90, { size: 60, weight: 500, font: "Monospace", color: "#1a1a1a", name: "Venue", bind: { color: "ink" } });
    },
  },
  {
    key: "flyer-workshop",
    name: "Workshop flyer",
    description: "A modern lilac and ink flyer with a clear title, a simple day schedule and a price pill.",
    category: "posters-flyers",
    sub: "promotional-flyers",
    secondary: ["education-learning"],
    format: "print",
    styles: ["modern", "creative-studio"],
    keywords: ["workshop", "class", "course", "schedule", "learn", "training", "flyer"],
    tags: ["workshop", "class"],
    width: 1748,
    height: 2480,
    bg: "#f5f3ff",
    bgBind: "paper",
    alt: "A lilac A5 flyer with a dark title block reading Make something, a four-row schedule and a yellow price pill",
    build: (d) => {
      d.rect(0, 0, 1748, 980, "#1e1b4b", { name: "Title block", bind: { fill: "ink" } });
      d.ellipse(1240, 380, 640, 640, "#a78bfa", { name: "Shape violet", opacity: 0.9, bind: { fill: "primary" } });
      d.text("ONE-DAY WORKSHOP", 120, 120, 1500, 70, { size: 56, weight: 700, font: "Monospace", color: "#c4b5fd", name: "Kicker" });
      d.text("Make\nsomething", 120, 230, 1500, 560, { size: 230, weight: 800, font: "Space Grotesk", color: "#ffffff", lh: 1, name: "Title", bind: { color: "paper", font: "heading" } });
      d.text("Saturday 20 September", 120, 830, 1300, 90, { size: 70, weight: 600, color: "#e9d5ff", name: "Date", bind: { font: "body" } });
      const rows: [string, string][] = [["10:00", "Welcome and warm-up"], ["11:00", "Hands-on session"], ["13:00", "Lunch together"], ["14:00", "Show and tell"]];
      rows.forEach(([time, what], i) => {
        const y = 1130 + i * 190;
        d.text(time, 120, y, 380, 100, { size: 76, weight: 800, font: "Space Grotesk", color: "#6d28d9", name: `Time ${i + 1}`, bind: { color: "primary", font: "heading" } });
        d.text(what, 520, y + 6, 1100, 100, { size: 70, weight: 500, color: "#1e1b4b", name: `Session ${i + 1}`, bind: { color: "ink", font: "body" } });
        d.rect(120, y + 150, 1508, 4, "#c4b5fd", { name: `Row line ${i + 1}` });
      });
      d.rect(120, 1960, 560, 150, "#fde047", { name: "Price pill", radius: 75, bind: { fill: "accent" } });
      d.text("$45 per person", 120, 2005, 560, 70, { size: 56, weight: 800, color: "#1e1b4b", align: "center", name: "Price", bind: { color: "ink" } });
      d.text("Book at yoursite.com/workshop\nLimited to 12 people", 120, 2210, 1500, 190, { size: 58, weight: 500, color: "#1e1b4b", lh: 1.35, name: "Booking", bind: { color: "ink", font: "body" } });
    },
  },
  {
    key: "flyer-open-day",
    name: "Open day flyer",
    description: "An elegant, centered flyer with a double border, a serif title and a gold ornament.",
    category: "posters-flyers",
    sub: "digital-flyers",
    secondary: ["invitations-events", "education-learning"],
    format: "print",
    styles: ["elegant", "editorial"],
    keywords: ["open day", "open house", "invitation", "elegant", "school", "gallery", "welcome"],
    tags: ["open day"],
    width: 1748,
    height: 2480,
    bg: "#fbf7ef",
    bgBind: "paper",
    alt: "A cream A5 flyer with a thin double border, a centered serif title Open Day, a gold ornament and event details",
    build: (d) => {
      d.rect(70, 70, 1608, 2340, "transparent", { name: "Border outer", stroke: "#a67c2e", strokeWidth: 6, bind: { stroke: "accent" } });
      d.rect(110, 110, 1528, 2260, "transparent", { name: "Border inner", stroke: "#a67c2e", strokeWidth: 2, bind: { stroke: "accent" } });
      d.text("YOU ARE WARMLY INVITED", 200, 360, 1348, 80, { size: 56, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "Kicker", bind: { color: "accent" } });
      d.text("Open\nDay", 200, 560, 1348, 760, { size: 330, weight: 600, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1, name: "Title", bind: { color: "ink", font: "heading" } });
      d.rect(574, 1450, 250, 4, "#a67c2e", { name: "Ornament line left", bind: { fill: "accent" } });
      d.ellipse(864, 1424, 56, 56, "#a67c2e", { name: "Ornament dot", bind: { fill: "accent" } });
      d.rect(924, 1450, 250, 4, "#a67c2e", { name: "Ornament line right", bind: { fill: "accent" } });
      d.text("Saturday 18 October\n10 am to 4 pm", 200, 1580, 1348, 260, { size: 88, weight: 500, font: "Playfair Display", color: "#2a2118", align: "center", lh: 1.3, name: "Date and time", bind: { color: "ink", font: "heading" } });
      d.text("Come and see the studios, meet the team\nand stay for tea.", 200, 1910, 1348, 200, { size: 62, weight: 400, font: "Playfair Display", color: "#5a4a36", align: "center", lh: 1.35, name: "Welcome", bind: { font: "body" } });
      d.text("1 Example Street, Your City", 200, 2180, 1348, 80, { size: 58, weight: 500, color: "#7a5a1e", align: "center", name: "Address", bind: { color: "accent" } });
    },
  },
];
