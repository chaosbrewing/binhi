import type { DesignSpec } from "./types.js";

/** Business essentials. Cards are 3.5 x 2 in at 300 dpi; A4 is 2480 x 3508, A5 1748 x 2480. Exports are PNG or JPEG images. */
export const BUSINESS: DesignSpec[] = [
  {
    key: "card-minimal",
    name: "Minimal business card",
    description: "A white card with a name, a role and three contact lines on a quiet grid, with an accent bar.",
    category: "business-essentials",
    sub: "business-cards",
    format: "print",
    styles: ["minimal", "corporate"],
    keywords: ["business card", "contact", "card", "name card", "visiting card"],
    tags: ["business card"],
    featured: true,
    width: 1050,
    height: 600,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white business card with a bold name, a role, three contact lines and a thin green bar on the left",
    build: (d) => {
      d.rect(0, 0, 24, 600, "#1f6f4a", { name: "Accent bar", bind: { fill: "primary" } });
      d.text("Your Name", 90, 80, 700, 80, { size: 64, weight: 700, font: "DM Sans", color: "#0f1a14", name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("Role or title", 90, 168, 700, 50, { size: 34, weight: 400, color: "#4b5b52", name: "Role", bind: { font: "body" } });
      d.text("you@example.com\n+00 000 000 000\nyoursite.com", 90, 380, 700, 160, { size: 30, weight: 400, color: "#1f2a24", lh: 1.4, name: "Contact", bind: { font: "body" } });
      d.logoSlot(790, 70, 200, 120);
    },
  },
  {
    key: "card-bold",
    name: "Bold business card",
    description: "A dark card with a large initial, a lime accent and a name set big, for studios and makers.",
    category: "business-essentials",
    sub: "business-cards",
    secondary: ["portfolios-personal-branding"],
    format: "print",
    styles: ["creative-studio", "brutalist"],
    keywords: ["business card", "creative", "studio", "maker", "freelancer", "card"],
    tags: ["business card"],
    width: 1050,
    height: 600,
    bg: "#0f1115",
    bgBind: "ink",
    alt: "A dark business card with a huge lime initial A, the name in white and contact lines in grey",
    build: (d) => {
      d.text("A", 20, 0, 460, 600, { size: 520, weight: 800, font: "Space Grotesk", color: "#a3e635", lh: 1, name: "Initial", bind: { color: "accent", font: "heading" } });
      d.text("Alex Rivera", 500, 120, 520, 90, { size: 66, weight: 800, font: "Space Grotesk", color: "#ffffff", name: "Name", bind: { color: "paper", font: "heading" } });
      d.text("Designer and photographer", 500, 220, 520, 50, { size: 30, weight: 400, color: "#a1a1aa", name: "Role", bind: { font: "body" } });
      d.rect(500, 300, 90, 6, "#a3e635", { name: "Rule", bind: { fill: "accent" } });
      d.text("hello@example.com\n+00 000 000 000\n@yourhandle", 500, 350, 520, 170, { size: 30, weight: 400, color: "#d4d4d8", lh: 1.4, name: "Contact", bind: { font: "body" } });
    },
  },
  {
    key: "card-elegant",
    name: "Elegant business card",
    description: "A cream, centered card with a fine gold frame and a serif name, for consultants, salons and boutiques.",
    category: "business-essentials",
    sub: "business-cards",
    secondary: ["fashion-beauty-lifestyle"],
    format: "print",
    styles: ["elegant", "editorial"],
    keywords: ["business card", "elegant", "boutique", "salon", "consultant", "gold", "card"],
    tags: ["business card"],
    width: 1050,
    height: 600,
    bg: "#faf6ee",
    bgBind: "paper",
    alt: "A cream business card with a thin gold frame, a centered serif name, a role in small caps and contact lines",
    build: (d) => {
      d.rect(30, 30, 990, 540, "transparent", { name: "Frame", stroke: "#b08d3e", strokeWidth: 3, bind: { stroke: "accent" } });
      d.text("Isabelle Moreau", 75, 120, 900, 90, { size: 70, weight: 600, font: "Playfair Display", color: "#2a2118", align: "center", name: "Name", bind: { color: "ink", font: "heading" } });
      d.text("INTERIOR STYLIST", 75, 225, 900, 44, { size: 28, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "Role", bind: { color: "accent" } });
      d.rect(485, 305, 80, 3, "#b08d3e", { name: "Rule", bind: { fill: "accent" } });
      d.text("hello@example.com   ·   +00 000 000 000\nyoursite.com", 75, 350, 900, 120, { size: 28, weight: 400, font: "Playfair Display", color: "#4a3f30", align: "center", lh: 1.5, name: "Contact", bind: { font: "body" } });
    },
  },
  {
    key: "invoice-a4",
    name: "Simple invoice",
    description: "A clean A4 invoice layout: from and to blocks, an itemised table, totals and payment notes.",
    category: "business-essentials",
    sub: "invoices",
    secondary: ["documents-reports"],
    format: "print",
    styles: ["corporate", "minimal"],
    keywords: ["invoice", "bill", "billing", "payment", "freelance", "quote", "receipt"],
    tags: ["invoice"],
    width: 2480,
    height: 3508,
    bg: "#ffffff",
    bgBind: "paper",
    alt: "A white A4 invoice with INVOICE in large type, from and to blocks, a five-row table and totals at the bottom right",
    build: (d) => {
      d.rect(0, 0, 2480, 40, "#1f4e79", { name: "Top band", bind: { fill: "primary" } });
      d.text("INVOICE", 160, 180, 1200, 200, { size: 170, weight: 800, font: "DM Sans", color: "#1f4e79", name: "Title", bind: { color: "primary", font: "heading" } });
      d.text("No. 0001\nDate: 1 January 2026\nDue: 15 January 2026", 1500, 190, 820, 280, { size: 62, weight: 400, color: "#374151", align: "right", lh: 1.4, name: "Invoice meta", bind: { font: "body" } });
      d.text("FROM", 160, 600, 900, 60, { size: 48, weight: 700, font: "Monospace", color: "#6b7280", name: "From label" });
      d.text("Your Business Name\n1 Example Street\nYour City\nyou@example.com", 160, 680, 1000, 370, { size: 62, weight: 400, color: "#111827", lh: 1.4, name: "From", bind: { font: "body" } });
      d.text("BILL TO", 1320, 600, 900, 60, { size: 48, weight: 700, font: "Monospace", color: "#6b7280", name: "To label" });
      d.text("Client Name\n2 Sample Road\nTheir City\nclient@example.com", 1320, 680, 1000, 370, { size: 62, weight: 400, color: "#111827", lh: 1.4, name: "To", bind: { font: "body" } });
      d.rect(160, 1180, 2160, 130, "#1f4e79", { name: "Table header", bind: { fill: "primary" } });
      d.text("Description", 200, 1215, 1000, 60, { size: 54, weight: 700, color: "#ffffff", name: "Head description", bind: { color: "paper" } });
      d.text("Qty", 1360, 1215, 200, 60, { size: 54, weight: 700, color: "#ffffff", align: "right", name: "Head qty", bind: { color: "paper" } });
      d.text("Price", 1640, 1215, 300, 60, { size: 54, weight: 700, color: "#ffffff", align: "right", name: "Head price", bind: { color: "paper" } });
      d.text("Amount", 2000, 1215, 280, 60, { size: 54, weight: 700, color: "#ffffff", align: "right", name: "Head amount", bind: { color: "paper" } });
      const items: [string, string, string, string][] = [["Design work", "1", "800.00", "800.00"], ["Revisions", "2", "120.00", "240.00"], ["Hosting setup", "1", "150.00", "150.00"], ["Service item", "1", "00.00", "00.00"], ["Service item", "1", "00.00", "00.00"]];
      items.forEach(([desc, qty, price, amount], i) => {
        const y = 1330 + i * 150;
        d.text(desc, 200, y + 35, 1100, 60, { size: 56, weight: 400, color: "#111827", name: `Item ${i + 1}`, bind: { font: "body" } });
        d.text(qty, 1360, y + 35, 200, 60, { size: 56, weight: 400, color: "#111827", align: "right", name: `Qty ${i + 1}` });
        d.text(price, 1640, y + 35, 300, 60, { size: 56, weight: 400, color: "#111827", align: "right", name: `Price ${i + 1}` });
        d.text(amount, 2000, y + 35, 280, 60, { size: 56, weight: 400, color: "#111827", align: "right", name: `Amount ${i + 1}` });
        d.rect(160, y + 140, 2160, 3, "#e5e7eb", { name: `Row line ${i + 1}` });
      });
      d.text("Subtotal", 1500, 2150, 500, 60, { size: 56, weight: 400, color: "#374151", align: "right", name: "Subtotal label" });
      d.text("1,190.00", 2000, 2150, 280, 60, { size: 56, weight: 400, color: "#111827", align: "right", name: "Subtotal" });
      d.rect(1500, 2290, 820, 150, "#e8f0f8", { name: "Total box", bind: { fill: "paper" } });
      d.text("Total due", 1540, 2335, 460, 70, { size: 62, weight: 700, color: "#1f4e79", name: "Total label", bind: { color: "primary", font: "heading" } });
      d.text("$1,190.00", 1900, 2335, 380, 70, { size: 62, weight: 800, color: "#1f4e79", align: "right", name: "Total", bind: { color: "primary", font: "heading" } });
      d.text("PAYMENT NOTES", 160, 2700, 1200, 60, { size: 48, weight: 700, font: "Monospace", color: "#6b7280", name: "Notes label" });
      d.text("Bank: Your Bank   ·   Account: 0000 0000\nPlease pay within 14 days. Thank you for your business.", 160, 2780, 2100, 200, { size: 56, weight: 400, color: "#374151", lh: 1.4, name: "Notes", bind: { font: "body" } });
      d.logoSlot(1900, 3200, 420, 200);
    },
  },
  {
    key: "price-list",
    name: "Price list",
    description: "A tidy A5 price list: a serif title, eight dotted rows of services and prices, and a footer line.",
    category: "business-essentials",
    sub: "price-lists",
    secondary: ["food-hospitality", "fashion-beauty-lifestyle"],
    format: "print",
    styles: ["elegant", "organic"],
    keywords: ["price list", "services", "menu", "rates", "salon", "pricing", "tariff"],
    aliases: ["service menu"],
    tags: ["price list"],
    width: 1748,
    height: 2480,
    bg: "#fbf7f0",
    bgBind: "paper",
    alt: "A cream A5 price list with a serif title Services and Prices and eight rows of service names with prices",
    build: (d) => {
      d.text("Services\n& Prices", 140, 140, 1400, 420, { size: 190, weight: 600, font: "Playfair Display", color: "#2f2a24", lh: 1, name: "Title", bind: { color: "ink", font: "heading" } });
      d.rect(140, 600, 140, 6, "#9a6b3a", { name: "Rule", bind: { fill: "accent" } });
      const rows: [string, string][] = [["Consultation", "40"], ["Standard session", "80"], ["Extended session", "120"], ["Half-day package", "260"], ["Full-day package", "480"], ["Follow-up", "35"], ["Gift voucher", "50"], ["Custom request", "Ask"]];
      rows.forEach(([name, price], i) => {
        const y = 700 + i * 150;
        d.text(name, 140, y, 1100, 80, { size: 66, weight: 500, font: "Playfair Display", color: "#2f2a24", name: `Service ${i + 1}`, bind: { color: "ink", font: "body" } });
        d.text(price, 1300, y, 308, 80, { size: 66, weight: 700, font: "Playfair Display", color: "#9a6b3a", align: "right", name: `Price ${i + 1}`, bind: { color: "accent" } });
        d.rect(140, y + 100, 1468, 2, "#cdbfa8", { name: `Row line ${i + 1}` });
      });
      d.text("Prices include tax. Please book ahead.", 140, 2000, 1468, 70, { size: 54, weight: 400, font: "Playfair Display", color: "#6b5f50", name: "Footnote", bind: { font: "body" } });
      d.text("yoursite.com   ·   +00 000 000 000", 140, 2300, 1468, 70, { size: 54, weight: 500, color: "#2f2a24", name: "Contact", bind: { color: "ink", font: "body" } });
      d.logoSlot(1308, 2200, 300, 180);
    },
  },
  {
    key: "certificate-classic",
    name: "Certificate of achievement",
    description: "A landscape certificate with a double border, a serif heading, a name line and two signature lines.",
    category: "business-essentials",
    sub: "certificates",
    secondary: ["education-learning"],
    format: "print",
    styles: ["elegant", "corporate"],
    keywords: ["certificate", "award", "achievement", "diploma", "recognition", "completion", "course"],
    tags: ["certificate"],
    width: 3508,
    height: 2480,
    bg: "#fffdf7",
    bgBind: "paper",
    alt: "A landscape cream certificate with a navy and gold double border, the words Certificate of Achievement and signature lines",
    build: (d) => {
      d.rect(100, 100, 3308, 2280, "transparent", { name: "Border outer", stroke: "#1f3a5f", strokeWidth: 16, bind: { stroke: "primary" } });
      d.rect(160, 160, 3188, 2160, "transparent", { name: "Border inner", stroke: "#b08d3e", strokeWidth: 6, bind: { stroke: "accent" } });
      d.text("CERTIFICATE", 300, 360, 2908, 330, { size: 270, weight: 600, font: "Playfair Display", color: "#1f3a5f", align: "center", lh: 1, name: "Title", bind: { color: "primary", font: "heading" } });
      d.text("OF ACHIEVEMENT", 300, 700, 2908, 100, { size: 80, weight: 500, font: "Monospace", color: "#7a5a1e", align: "center", name: "Subtitle", bind: { color: "accent" } });
      d.text("This certificate is proudly presented to", 300, 930, 2908, 90, { size: 70, weight: 400, font: "Playfair Display", color: "#4a4a4a", align: "center", name: "Presented to", bind: { font: "body" } });
      d.text("Recipient Name", 300, 1080, 2908, 220, { size: 190, weight: 500, font: "Playfair Display", color: "#111111", align: "center", name: "Recipient", bind: { color: "ink", font: "heading" } });
      d.rect(1004, 1330, 1500, 5, "#b08d3e", { name: "Name line", bind: { fill: "accent" } });
      d.text("in recognition of outstanding effort and dedication to\ncompleting the program with distinction.", 400, 1420, 2708, 220, { size: 64, weight: 400, font: "Playfair Display", color: "#4a4a4a", align: "center", lh: 1.4, name: "Reason", bind: { font: "body" } });
      d.rect(500, 1980, 900, 4, "#1f3a5f", { name: "Signature line one", bind: { fill: "primary" } });
      d.text("Signature  ·  Name, Title", 500, 2010, 900, 70, { size: 48, weight: 400, color: "#4a4a4a", align: "center", name: "Signature one", bind: { font: "body" } });
      d.rect(2108, 1980, 900, 4, "#1f3a5f", { name: "Signature line two", bind: { fill: "primary" } });
      d.text("Date  ·  1 January 2026", 2108, 2010, 900, 70, { size: 48, weight: 400, color: "#4a4a4a", align: "center", name: "Date", bind: { font: "body" } });
      d.logoSlot(1554, 1760, 400, 200);
    },
  },
];
