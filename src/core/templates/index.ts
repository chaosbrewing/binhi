import type { Node, Page, SiteDocument } from "../schema/document.js";
import { SCHEMA_VERSION } from "../schema/document.js";
import { makeNode } from "../registry/components.js";
import { newId } from "../ids.js";
import { buildTheme, DEFAULT_THEME_SEED, type ThemeSeed } from "./theme.js";
import { validateDocument } from "../ops/apply.js";

export interface TemplateDefinition {
  id: string;
  name: string;
  category: "Personal portfolio" | "Creative studio" | "Freelancer services" | "Small business" | "Minimal landing page" | "Blank" | "Link in bio" | "Event" | "Product launch" | "Community";
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

const linkinbio: TemplateDefinition = {
  id: "linkinbio",
  name: "Link in bio",
  category: "Link in bio",
  description: "One short page for your social profiles: a photo, a line about you and a stack of big buttons.",
  swatch: ["#fdf2f8", "#831843", "#db2777"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#db2777", secondary: "#be185d", accent: "#fbcfe8", background: "#fdf2f8", surface: "#ffffff", text: "#500724", muted: "#9d4a6c", border: "#fbcfe8", heading: "DM Sans", body: "DM Sans", radius: 999 };
    const link = (label: string, variant: "primary" | "secondary" | "ghost") => {
      const b = button(label, variant, { kind: "url", href: "https://example.com", newTab: true });
      b.style = { ...b.style, width: "100%", justifyContent: "center" };
      return b;
    };
    const home = page("Home", "home", [
      section(
        [
          image(`${name}`, { width: 140, aspectRatio: "1 / 1", radius: 999, objectFit: "cover" }),
          heading(name, 1, { textAlign: "center" }, "heading2"),
          para("Designer and maker. New work every week.", { textAlign: "center" }),
          link("My latest project", "primary"),
          link("Shop the prints", "secondary"),
          link("Book a session", "secondary"),
          link("Read the newsletter", "secondary"),
          makeNode("socialLinks", { links: [{ network: "instagram", url: "https://instagram.com/" }, { network: "youtube", url: "https://youtube.com/" }, { network: "email", url: "mailto:hello@example.com" }], size: 28, style: "circle" }, { style: { display: "flex", gap: 14, justifyContent: "center" } }),
        ],
        { padY: 56, align: "center", contentWidth: 480 },
      ),
    ]);
    return finish(name, seed, [home], null, footerNode(name, false), "Links to everything in one place.");
  },
};

const event: TemplateDefinition = {
  id: "event",
  name: "Event website",
  category: "Event",
  description: "A one-day event page: date and place, the programme, what to expect and an RSVP form.",
  swatch: ["#f0fdfa", "#134e4a", "#0e7490"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#0e7490", secondary: "#155e75", accent: "#fcd34d", background: "#f0fdfa", surface: "#ccfbf1", text: "#134e4a", muted: "#41706b", border: "#99f6e4", heading: "Georgia", body: "DM Sans", radius: 10 };
    const rsvp = page("RSVP", "rsvp", [
      section([heading("Will you join us?", 1), para("Let us know you are coming so we can plan for everyone."), makeNode("form", { title: "", fields: [{ id: newId("fld"), type: "text", label: "Name", required: true }, { id: newId("fld"), type: "email", label: "Email", required: true }, { id: newId("fld"), type: "select", label: "Guests", options: ["Just me", "2", "3", "4 or more"], required: true }, { id: newId("fld"), type: "textarea", label: "Anything we should know?", required: false }], submitLabel: "RSVP", successMessage: "Thank you! We will see you there." })], { contentWidth: 720 }),
    ]);
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [para("Saturday 14 June · 2 pm to late", { letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--b-primary)" }, "caption"), heading(name, 1, undefined, "display"), para("Riverside Park, Your City. Music, food and good company by the water. Free for everyone."), stack([button("RSVP", "primary", { kind: "page", pageId: rsvp.id }), button("See the programme", "secondary", { kind: "anchor", anchor: "programme" })], { justifyContent: "center" })] })], { padY: 130, bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Programme", 2, { textAlign: "center" }), columns(3, [[card("2 pm", "Gates open, food stalls and games for children.")], [card("4 pm", "Live music from local bands on the main stage.")], [card("8 pm", "Lanterns on the water and a closing set.")]])], { anchor: "programme" }),
      section([columns(2, [[heading("Good to know"), para("Bring a blanket. Food and drink are on sale, and water is free. The site is step-free and there is a quiet space near the entrance.")], [makeNode("contact", { email: "hello@example.com", phone: "+00 000 000 000", address: "Riverside Park, Your City", hours: "Saturday 2 pm to 11 pm" })]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Save your place", 2, { textAlign: "center" }), stack([button("RSVP now", "primary", { kind: "page", pageId: rsvp.id })], { justifyContent: "center" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, rsvp], navHeader(name, "RSVP", rsvp.id), footerNode(name), "An open-air community day by the river.");
  },
};

const launch: TemplateDefinition = {
  id: "launch",
  name: "Product launch",
  category: "Product launch",
  description: "A launch page with a bold headline, three benefits, three plans and a questions section.",
  swatch: ["#fafafa", "#18181b", "#e11d48"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#e11d48", secondary: "#be123c", accent: "#fecdd3", background: "#fafafa", surface: "#ffffff", text: "#18181b", muted: "#71717a", border: "#e4e4e7", heading: "Space Grotesk", body: "Inter", radius: 14 };
    const plan = (title: string, price: string, body: string, featured = false) => {
      const c = card(title, body);
      c.children = [heading(title, 3), heading(price, 2), para(body, undefined, "small"), button(featured ? "Start free trial" : "Choose plan", featured ? "primary" : "secondary", { kind: "anchor", anchor: "signup" })];
      return c;
    };
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [para("Now in public beta", { letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--b-primary)" }, "caption"), heading(`${name}: finish your work in half the time`, 1, undefined, "display"), para("A calmer way to plan, track and ship. Set up in minutes, no training needed."), stack([button("Start free", "primary", { kind: "anchor", anchor: "signup" }), button("See pricing", "ghost", { kind: "anchor", anchor: "pricing" })], { justifyContent: "center" })] })], { padY: 130 }),
      section([columns(3, [[card("Plan in minutes", "Turn a messy list into a clear week with one click.", "check")], [card("See progress", "A single view shows what is done and what is next.", "sparkle")], [card("Share easily", "Send a link. No account needed to follow along.", "heart")]])], { bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Simple pricing", 2, { textAlign: "center" }), columns(3, [[plan("Starter", "Free", "For one person trying it out.")], [plan("Team", "$12", "Per person per month, billed yearly.", true)], [plan("Business", "$29", "Per person per month with priority support.")]])], { anchor: "pricing" }),
      section([heading("Questions", 2), heading("Can I try it first?", 3), para("Yes. The Starter plan is free and you can upgrade at any time."), heading("Can I cancel?", 3), para("Anytime, from your account. We never lock you in.")], { contentWidth: 760, bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Get early access", 2, { textAlign: "center" }), makeNode("form", { fields: [{ id: newId("fld"), type: "email", label: "Email", placeholder: "you@example.com", required: true }], submitLabel: "Join the beta", successMessage: "You are in. Watch your inbox." }, { style: { width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 } })], { align: "center", anchor: "signup", padY: 96 }),
    ]);
    return finish(name, seed, [home], navHeader(name), footerNode(name, false), "A calmer way to plan, track and ship.");
  },
};

const community: TemplateDefinition = {
  id: "community",
  name: "Community group",
  category: "Community",
  description: "A site for a club, charity or neighbourhood group: what you do, how to help, what's on and how to reach you.",
  swatch: ["#f7fee7", "#14532d", "#15803d"],
  build: (name) => {
    const seed: ThemeSeed = { primary: "#15803d", secondary: "#166534", accent: "#bbf7d0", background: "#f7fee7", surface: "#ecfccb", text: "#14532d", muted: "#4d7c52", border: "#d9f99d", heading: "DM Sans", body: "Lora", radius: 20 };
    const contact = page("Contact", "contact", [
      section([heading("Get in touch", 1), para("Questions, ideas or want to help? Write to us and a volunteer will reply within a few days."), makeNode("form", {})], { contentWidth: 720 }),
    ]);
    const home = page("Home", "home", [
      section([makeNode("hero", {}, { children: [heading(`${name} brings neighbours together`, 1, undefined, "display"), para("We run weekly meals, repair cafés and clean-up days for everyone nearby. All are welcome."), stack([button("Get involved", "primary", { kind: "page", pageId: contact.id }), button("What's on", "secondary", { kind: "anchor", anchor: "whats-on" })], { justifyContent: "center" })] })], { padY: 120, bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("How you can help", 2, { textAlign: "center" }), columns(3, [[card("Volunteer", "Give a couple of hours. We will match you to something you enjoy.", "heart")], [card("Donate", "Gifts of any size keep the doors open. Ask us how.", "sparkle")], [card("Spread the word", "Tell a neighbour or share our page with a friend.", "check")]])]),
      section([heading("What's on", 2), columns(2, [[card("Community meal", "Every Thursday, 6 pm. Pay what you can.")], [card("Repair café", "First Saturday of the month, 10 am to 1 pm.")]])], { anchor: "whats-on", bg: { type: "color", color: "var(--b-surface)" } }),
      section([heading("Find us", 2, { textAlign: "center" }), makeNode("contact", { email: "hello@example.com", phone: "+00 000 000 000", address: "The Community Hall, 1 Example Street", hours: "Mon to Fri 9 am to 5 pm" })], { align: "center" }),
    ]);
    return finish(name, seed, [home, contact], navHeader(name, "Get involved", contact.id), footerNode(name), "A friendly local community group.");
  },
};

export const TEMPLATES: TemplateDefinition[] = [blank, portfolio, studio, freelancer, business, landing, linkinbio, event, launch, community];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function createSiteDocument(templateId: string, siteName: string): SiteDocument {
  const t = getTemplate(templateId) ?? blank;
  return t.build(siteName.trim() || "My website");
}
