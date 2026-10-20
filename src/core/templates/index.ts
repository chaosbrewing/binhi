import type { Node, Page, SiteDocument } from "../schema/document.js";
import { SCHEMA_VERSION } from "../schema/document.js";
import { makeNode } from "../registry/components.js";
import { newId } from "../ids.js";
import { buildTheme, DEFAULT_THEME_SEED, type ThemeSeed } from "./theme.js";
import { validateDocument } from "../ops/apply.js";

export interface TemplateDefinition {
  id: string;
  name: string;
  category: "Personal portfolio" | "Creative studio" | "Freelancer services" | "Small business" | "Minimal landing page" | "Blank";
  description: string;
  /** Accent colour shown on the template card. */
  swatch: [string, string, string];
  build: (siteName: string) => SiteDocument;
}

/* ---- helpers ---- */

function section(children: Node[], opts: { bg?: Node["style"]["background"]; padY?: number; name?: string; align?: "center" | "stretch"; contentWidth?: number | null; anchor?: string } = {}): Node {
  const s = makeNode("section", {}, { name: opts.name, children });
  s.style = { ...s.style, padding: { top: opts.padY ?? 96, bottom: opts.padY ?? 96, left: 24, right: 24 }, alignItems: opts.align ?? "stretch" };
  if (opts.bg) s.style.background = opts.bg;
  if (opts.contentWidth !== undefined) s.layout = { ...s.layout!, contentWidth: opts.contentWidth };
  if (opts.anchor) s.anchorId = opts.anchor;
  return s;
}

const heading = (text: string, level: 1 | 2 | 3 | 4 = 2, style?: Node["style"], textStyle?: string) =>
  makeNode("heading", { text, level }, { style, textStyle: textStyle ?? (level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3") });
const para = (text: string, style?: Node["style"], textStyle = "body") => makeNode("paragraph", { text }, { style, textStyle });
const button = (label: string, variant: "primary" | "secondary" | "ghost" = "primary", link: Record<string, unknown> = { kind: "none" }) => makeNode("button", { label, variant, link });
const image = (alt: string, style?: Node["style"]) => makeNode("image", { src: "", alt }, { style: { width: "100%", aspectRatio: "4 / 3", radius: 16, objectFit: "cover", ...(style ?? {}) } });

function card(title: string, body: string, icon?: string): Node {
  const children: Node[] = [];
  if (icon) children.push(makeNode("icon", { name: icon, size: 28 }));
  children.push(heading(title, 3), para(body, undefined, "small"));
  return makeNode("card", {}, { children });
}

function columns(count: number, cells: Node[][]): Node {
  const c = makeNode("columns", { count, stackBelow: count > 2 ? "tablet" : "mobile" }, { children: cells.map((kids) => makeNode("container", {}, { children: kids, style: { display: "flex", flexDirection: "column", gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 }, width: "100%" } })) });
  c.style.gridColumns = count;
  return c;
}

function stack(children: Node[], style?: Node["style"]): Node {
  return makeNode("stack", {}, { children, style: { display: "flex", flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap", ...(style ?? {}) } });
}

function navHeader(siteName: string, ctaLabel?: string, contactPageId?: string): Node {
  const nav = makeNode("navigation", {
    logoText: siteName,
    alignment: "space-between",
    ...(ctaLabel && contactPageId ? { cta: { label: ctaLabel, link: { kind: "page", pageId: contactPageId }, variant: "primary" } } : {}),
  });
  nav.style = { ...nav.style, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  const s = section([nav], { padY: 18, name: "Header" });
  s.a11y = { role: "banner" };
  s.style.background = { type: "color", color: "var(--b-background)" };
  s.style.border = { width: 1, style: "solid", color: "var(--b-border)", sides: { top: false, right: false, bottom: true, left: false } };
  return s;
}

function footerNode(siteName: string, socials = true): Node {
  const f = makeNode("footer", { text: `© ${new Date().getFullYear()} ${siteName}. Built with BINHI.`, showNavigation: true });
  f.children = socials ? [makeNode("socialLinks", { links: [{ network: "instagram", url: "https://instagram.com/" }, { network: "facebook", url: "https://facebook.com/" }] })] : [];
  return f;
}

function page(name: string, slug: string, sections: Node[], opts: Partial<Page> = {}): Page {
  return { id: newId("page"), name, slug, isHome: false, hiddenFromNav: false, seo: { noIndex: false }, sections, ...opts };
}

function finish(name: string, seed: ThemeSeed, pages: Page[], header: Node | null, footer: Node | null, defaultSeoDescription?: string): SiteDocument {
  pages[0]!.isHome = true;
  const doc: SiteDocument = {
    schemaVersion: SCHEMA_VERSION,
    name,
    theme: buildTheme(seed),
    settings: { language: "en", headerSticky: false, ...(defaultSeoDescription ? { defaultSeoDescription } : {}) },
    pages,
    navigation: { auto: true, items: [] },
    header,
    footer,
    reusableSections: [],
  };
  return validateDocument(doc);
}

/* ---- templates ---- */

const blank: TemplateDefinition = {
  id: "blank",
  name: "Blank canvas",
  category: "Blank",
  description: "Start from nothing: one empty section and the default style.",
  swatch: ["#ffffff", "#f4f7f5", "#2f855a"],
  build: (name) => {
    const home = page("Home", "home", [section([heading("Welcome", 1), para("Start building by adding elements from the left panel.")], { align: "center" })]);
    return finish(name, DEFAULT_THEME_SEED, [home], navHeader(name), footerNode(name, false));
  },
};

const portfolio: TemplateDefinition = {
  id: "portfolio",
  name: "Personal portfolio",
  category: "Personal portfolio",
  description: "Introduce yourself, show selected work and make it easy to get in touch.",
  swatch: ["#faf8f3", "#1f1d1a", "#c2410c"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#c2410c", secondary: "#9a3412", accent: "#fdba74", background: "#faf8f3", surface: "#f1ede3", text: "#1f1d1a", muted: "#6b645b", border: "#e3dccd", heading: "Playfair Display", body: "Inter", radius: 4 };
    const contact = page("Contact", "contact", [
      section([heading("Let's work together", 1), para("Tell me about your project and I'll reply within two working days."), makeNode("form", {})], { align: "stretch", contentWidth: 720 }),
    ]);
    const work = page("Work", "work", [
      section([heading("Selected work", 1), para("A few projects I'm proud of."), makeNode("gallery", { columns: 3, aspect: "landscape", gap: 20 })]),
    ]);
    const about = page("About", "about", [
      section([columns(2, [[image("Portrait")], [heading("About me", 1), para("I'm a designer and photographer based in Manila. I make calm, honest work for people who care about detail."), para("Previously at a small studio; now independent. Available for commissions and collaborations."), stack([button("See my work", "secondary", { kind: "page", pageId: work.id })])]])]),
    ]);
    const home = page("Home", "home", [
      section([
        makeNode("hero", { align: "left" }, {
          style: { display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start", textAlign: "left", maxWidth: 760 },
          children: [
            para("Designer · Photographer", { letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--b-primary)" }, "caption"),
            heading(`Hi, I'm ${name.split(" ")[0] ?? "Alex"}. I make things that feel considered.`, 1, undefined, "display"),
            para("A portfolio of design, photography and the occasional experiment."),
            stack([button("View work", "primary", { kind: "page", pageId: work.id }), button("Get in touch", "ghost", { kind: "page", pageId: contact.id })]),
          ],
        }),
      ], { padY: 120 }),
      section([heading("Recent projects"), makeNode("gallery", { columns: 3, aspect: "square", gap: 24 })], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([columns(3, [[card("Brand identity", "Logos, type systems and guidelines for small teams.")], [card("Editorial photography", "Portraits and places, shot with patience.")], [card("Web design", "Simple sites that load fast and read well.")]])]),
      section([heading("Have a project in mind?", 2, { textAlign: "center" }), stack([button("Start a conversation", "primary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, work, about, contact], navHeader(name, "Hire me", contact.id), footerNode(name), "Portfolio of design and photography work.");
  },
};

const studio: TemplateDefinition = {
  id: "studio",
  name: "Creative studio",
  category: "Creative studio",
  description: "A bold, dark home for a studio or collective: services, work and a clear brief form.",
  swatch: ["#0f1115", "#f5f5f4", "#a3e635"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#a3e635", secondary: "#84cc16", accent: "#d9f99d", background: "#0f1115", surface: "#181b22", text: "#f5f5f4", muted: "#a1a1aa", border: "#2a2e38", heading: "Space Grotesk", body: "DM Sans", radius: 999 };
    const contact = page("Start a project", "start", [section([heading("Tell us about it", 1), para("A few lines are enough. We'll come back with questions and a rough plan."), makeNode("form", { fields: [{ id: newId("fld"), type: "text", label: "Name", required: true }, { id: newId("fld"), type: "email", label: "Email", required: true }, { id: newId("fld"), type: "select", label: "Budget", options: ["Under $5k", "$5k–$15k", "$15k+"], required: false }, { id: newId("fld"), type: "textarea", label: "What are you making?", required: true }] })], { contentWidth: 720 })]);
    const work = page("Work", "work", [section([heading("Work", 1), makeNode("gallery", { columns: 2, aspect: "landscape", gap: 32 })])]);
    const home = page("Home", "home", [
      section([
        makeNode("hero", { align: "left" }, { style: { display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start", textAlign: "left", maxWidth: 900 }, children: [
          heading("We design brands and websites that people remember.", 1, undefined, "display"),
          para("A small studio for ambitious founders, cultural projects and good causes."),
          stack([button("Start a project", "primary", { kind: "page", pageId: contact.id }), button("See the work", "secondary", { kind: "page", pageId: work.id })]),
        ] }),
      ], { padY: 140 }),
      section([heading("What we do"), columns(3, [[card("Brand", "Strategy, identity and voice that hold together.", "sparkle")], [card("Websites", "Designed and built to be fast, clear and yours.", "globe")], [card("Campaigns", "Launches, film and social that earn attention.", "play")]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([columns(2, [[heading("Selected projects"), para("A handful of things we've made recently. Ask us for the longer list."), stack([button("All work", "ghost", { kind: "page", pageId: work.id })])], [makeNode("gallery", { columns: 2, aspect: "square", gap: 16 })]])]),
      section([heading("Working on something?", 2, { textAlign: "center" }, "heading1"), para("We take on a few projects each season.", { textAlign: "center" }), stack([button("Get in touch", "primary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, work, contact], navHeader(name, "Start a project", contact.id), footerNode(name), "A creative studio for brands and websites.");
  },
};

const freelancer: TemplateDefinition = {
  id: "freelancer",
  name: "Freelancer services",
  category: "Freelancer services",
  description: "Explain what you offer, show proof, list packages and collect enquiries.",
  swatch: ["#ffffff", "#0f172a", "#2563eb"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#2563eb", secondary: "#1d4ed8", accent: "#bfdbfe", background: "#ffffff", surface: "#f1f5f9", text: "#0f172a", muted: "#64748b", border: "#e2e8f0", heading: "Inter", body: "Inter", radius: 10 };
    const contact = page("Contact", "contact", [section([columns(2, [[heading("Book a free 20-minute call", 1), para("Tell me what you need and when. I'll confirm availability and a quote."), makeNode("contact", { email: "hello@example.com", phone: "+63 900 000 0000", hours: "Mon–Fri, 9am–6pm" })], [makeNode("form", {})]])])]);
    const services = page("Services", "services", [
      section([heading("Services", 1), columns(3, [[card("Starter", "One-page website, copy review and launch support.", "leaf")], [card("Growth", "Up to five pages, SEO basics and a contact flow.", "sun")], [card("Ongoing", "Monthly updates, fixes and improvements.", "clock")]])]),
    ]);
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [heading(`${name}: websites and content for small businesses`, 1), para("I help owners explain what they do clearly online, without jargon or long timelines."), stack([button("See services", "primary", { kind: "page", pageId: services.id }), button("Book a call", "secondary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })] })], { padY: 120 }),
      section([heading("How I help", 2, { textAlign: "center" }), columns(3, [[card("Clear websites", "Simple structure, fast pages, easy to update.", "globe")], [card("Words that work", "Copy that says what you do and who it's for.", "quote")], [card("Launch support", "Domains, email and the first month after going live.", "sparkle")]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([columns(2, [[image("Working at a desk", { aspectRatio: "1 / 1" })], [heading("Why work with me"), para("Ten years of building for cafés, clinics, tutors and makers. Fixed quotes, plain language and a site you own outright."), makeNode("richText", { blocks: [{ type: "bullet", runs: [{ text: "Fixed price, agreed up front" }] }, { type: "bullet", runs: [{ text: "You own everything we make" }] }, { type: "bullet", runs: [{ text: "Training included so you can edit it yourself" }] }] })]])]),
      section([heading("Ready when you are", 2, { textAlign: "center" }), stack([button("Book a free call", "primary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, services, contact], navHeader(name, "Book a call", contact.id), footerNode(name), "Websites and content for small businesses.");
  },
};

const business: TemplateDefinition = {
  id: "business",
  name: "Small business",
  category: "Small business",
  description: "A local business site: what you offer, where to find you, hours and a way to reach you.",
  swatch: ["#fffbeb", "#78350f", "#d97706"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#b45309", secondary: "#92400e", accent: "#fcd34d", background: "#fffbeb", surface: "#fef3c7", text: "#3f2a14", muted: "#7c5a2e", border: "#f1e2bd", heading: "Lora", body: "DM Sans", radius: 12 };
    const contact = page("Find us", "find-us", [
      section([columns(2, [[heading("Visit", 1), makeNode("contact", { email: "hello@example.com", phone: "+63 2 8000 0000", address: "123 Example Street\nQuezon City", hours: "Tue–Sun, 7am–7pm\nClosed Mondays" }), makeNode("socialLinks", {})], [makeNode("map", { address: "Quezon City, Philippines", zoom: 13 })]])]),
      section([heading("Send a message"), makeNode("form", {})], { contentWidth: 720, bg: { type: "color", color: "var(--b-surface)" } }),
    ]);
    const menu = page("Menu", "menu", [section([heading("Menu", 1), para("Seasonal and simple. Ask about allergens."), columns(2, [[card("Coffee", "Espresso, filter and cold brew from local roasters."), card("Pastries", "Baked each morning. Gone by noon.")], [card("Brunch", "Served until 2pm on weekends."), card("Catering", "Boxes and platters for offices and events.")]])])]);
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [heading(`Welcome to ${name}`, 1), para("A neighbourhood café with good coffee, honest food and a long table for everyone."), stack([button("See the menu", "primary", { kind: "page", pageId: menu.id }), button("Find us", "secondary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })] })], { padY: 130, bg: { type: "color", color: "var(--b-surface)" } }),
      section([columns(3, [[image("Fresh pastries", { aspectRatio: "1 / 1" }), heading("Baked daily", 3)], [image("Coffee being poured", { aspectRatio: "1 / 1" }), heading("Roasted nearby", 3)], [image("Our long table", { aspectRatio: "1 / 1" }), heading("Room for everyone", 3)]])]),
      section([columns(2, [[heading("Opening hours"), makeNode("contact", { email: "", phone: "+63 2 8000 0000", address: "123 Example Street, Quezon City", hours: "Tue–Sun 7am–7pm" })], [heading("What people say"), makeNode("richText", { blocks: [{ type: "quote", runs: [{ text: "The best flat white in the area, and the staff remember your name.", italic: true }] }, { type: "paragraph", runs: [{ text: "— A regular", bold: true }] }] })]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Come and say hello", 2, { textAlign: "center" }), stack([button("Get directions", "primary", { kind: "page", pageId: contact.id })], { justifyContent: "center" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, menu, contact], navHeader(name, "Find us", contact.id), footerNode(name), "A neighbourhood café: coffee, food and a long table.");
  },
};

const landing: TemplateDefinition = {
  id: "landing",
  name: "Minimal landing page",
  category: "Minimal landing page",
  description: "One page, one message, one action. Good for launches and waitlists.",
  swatch: ["#ffffff", "#111827", "#7c3aed"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#7c3aed", secondary: "#6d28d9", accent: "#ddd6fe", background: "#ffffff", surface: "#f5f3ff", text: "#111827", muted: "#6b7280", border: "#e5e7eb", heading: "Inter", body: "Inter", radius: 8 };
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [heading(`${name} is coming soon`, 1, undefined, "display"), para("One sentence about the problem you solve and for whom. Keep it plain."), makeNode("form", { fields: [{ id: newId("fld"), type: "email", label: "Email", placeholder: "you@example.com", required: true }], submitLabel: "Join the waitlist", successMessage: "You're on the list. Thank you!" }, { style: { width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 } })] })], { padY: 140 }),
      section([columns(3, [[card("Simple", "Explain the first benefit in one sentence.", "check")], [card("Fast", "Explain the second benefit in one sentence.", "sparkle")], [card("Yours", "Explain the third benefit in one sentence.", "heart")]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Questions?", 2, { textAlign: "center" }), para("Email hello@example.com and a human will reply.", { textAlign: "center" })], { align: "center" }),
    ]);
    const header = navHeader(name);
    return finish(name, seed, [home], header, footerNode(name, false), "Coming soon.");
  },
};

export const TEMPLATES: TemplateDefinition[] = [blank, portfolio, studio, freelancer, business, landing];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function createSiteDocument(templateId: string, siteName: string): SiteDocument {
  const t = getTemplate(templateId) ?? blank;
  return t.build(siteName.trim() || "My website");
}
