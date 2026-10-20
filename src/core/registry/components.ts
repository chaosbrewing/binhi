import { z } from "zod";
import {
  ComponentType,
  LinkTarget,
  RichText,
  type LayoutMode,
  type Node,
  type StyleSet,
  Identifier,
  ShortText,
  MediumText,
} from "../schema/document.js";
import { newId } from "../ids.js";

/**
 * The canonical component registry. Only components defined here can be
 * inserted. Each entry declares its validated props, the layout modes its
 * children may use, which children it accepts, and the property groups the
 * editor shows.
 */
export type PropertyGroup =
  | "content"
  | "link"
  | "layout"
  | "position"
  | "spacing"
  | "typography"
  | "fill"
  | "border"
  | "effects"
  | "media"
  | "responsive"
  | "interactions"
  | "accessibility"
  | "advanced";

export type ComponentCategory =
  | "Structure"
  | "Text"
  | "Media"
  | "Buttons & links"
  | "Shapes"
  | "Content blocks"
  | "Site";

export interface ComponentDefinition<P = Record<string, unknown>> {
  type: ComponentType;
  label: string;
  category: ComponentCategory;
  description: string;
  keywords: string[];
  props: z.ZodType<P>;
  defaultProps: () => P;
  defaultStyle: () => StyleSet;
  /** Can this component have children? */
  container: boolean;
  /** Layout modes a container supports for its children. */
  layoutModes: LayoutMode[];
  /** Component types allowed as children; "*" = any non-section leaf/container. */
  acceptsChildren: ComponentType[] | "*";
  /** Can the component itself be placed freely inside a free-layout parent? */
  freeformCapable: boolean;
  /** Only sections (and header/footer) are allowed at page root. */
  rootOnly: boolean;
  /** Whether the element has directly editable text in the canvas. */
  inlineText?: "heading" | "paragraph" | "button" | "rich";
  groups: PropertyGroup[];
  /** Default text style when inserted. */
  textStyle?: string;
  /** Default freeform size in design pixels. */
  defaultSize: { width: number; height: number };
  /** Build default children when inserted (e.g. a card with a title + text). */
  defaultChildren?: () => Node[];
}

const image = z.object({
  src: z.string().max(2048).default(""),
  alt: ShortText.default(""),
  decorative: z.boolean().default(false),
  caption: ShortText.optional(),
  link: LinkTarget.optional(),
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  crop: z
    .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), w: z.number().min(1).max(100), h: z.number().min(1).max(100) })
    .optional(),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  lazy: z.boolean().default(true),
  naturalWidth: z.number().int().positive().optional(),
  naturalHeight: z.number().int().positive().optional(),
});

const commonGroups: PropertyGroup[] = ["position", "spacing", "responsive", "accessibility", "advanced"];

function def<P>(d: ComponentDefinition<P>): ComponentDefinition<P> {
  return d;
}

export const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "custom"] as const;

const EMPTY = {} as Record<string, never>;

export const REGISTRY = {
  section: def({
    type: "section",
    label: "Section",
    category: "Structure",
    description: "A full-width band of the page. Pages are built from sections.",
    keywords: ["band", "row", "block"],
    props: z.object({ fullBleed: z.boolean().default(false), minHeight: z.number().min(0).max(4000).default(0) }),
    defaultProps: () => ({ fullBleed: false, minHeight: 0 }),
    defaultStyle: () => ({ padding: { top: 80, bottom: 80, left: 24, right: 24 }, display: "flex", flexDirection: "column", gap: 24, alignItems: "stretch" }),
    container: true,
    layoutModes: ["flow", "free"],
    acceptsChildren: "*",
    freeformCapable: false,
    rootOnly: true,
    groups: ["layout", "spacing", "fill", "border", "effects", "responsive", "interactions", "accessibility", "advanced"],
    defaultSize: { width: 1200, height: 400 },
  }),
  container: def({
    type: "container",
    label: "Container",
    category: "Structure",
    description: "A box that holds other elements. Choose a flowing or freeform layout.",
    keywords: ["box", "wrapper", "div", "frame"],
    props: z.object({}),
    defaultProps: () => ({}),
    defaultStyle: () => ({ display: "flex", flexDirection: "column", gap: 16, padding: { top: 24, right: 24, bottom: 24, left: 24 }, width: "100%" }),
    container: true,
    layoutModes: ["flow", "free"],
    acceptsChildren: "*",
    freeformCapable: true,
    rootOnly: false,
    groups: ["layout", ...commonGroups, "fill", "border", "effects", "interactions"],
    defaultSize: { width: 400, height: 240 },
  }),
  columns: def({
    type: "columns",
    label: "Columns",
    category: "Structure",
    description: "Side-by-side columns that stack on smaller screens.",
    keywords: ["grid", "row", "split", "two columns", "three columns"],
    props: z.object({ count: z.number().int().min(1).max(6).default(2), stackBelow: z.enum(["tablet", "mobile", "never"]).default("mobile") }),
    defaultProps: () => ({ count: 2, stackBelow: "mobile" as const }),
    defaultStyle: () => ({ display: "grid", gridColumns: 2, gap: 32, width: "100%" }),
    container: true,
    layoutModes: ["flow"],
    acceptsChildren: ["container", "stack", "card"],
    freeformCapable: false,
    rootOnly: false,
    groups: ["layout", ...commonGroups, "fill", "border", "effects"],
    defaultSize: { width: 1200, height: 300 },
    defaultChildren: () => [makeNode("container"), makeNode("container")],
  }),
  stack: def({
    type: "stack",
    label: "Stack",
    category: "Structure",
    description: "Lays its children out in a row or column with even spacing.",
    keywords: ["flex", "row", "column", "list"],
    props: z.object({}),
    defaultProps: () => ({}),
    defaultStyle: () => ({ display: "flex", flexDirection: "row", gap: 16, alignItems: "center", flexWrap: "wrap" }),
    container: true,
    layoutModes: ["flow"],
    acceptsChildren: "*",
    freeformCapable: true,
    rootOnly: false,
    groups: ["layout", ...commonGroups, "fill", "border", "effects"],
    defaultSize: { width: 400, height: 80 },
  }),
  group: def({
    type: "group",
    label: "Group",
    category: "Structure",
    description: "Elements grouped so they move and resize together.",
    keywords: ["grouped"],
    props: z.object({}),
    defaultProps: () => ({}),
    defaultStyle: () => ({}),
    container: true,
    layoutModes: ["free"],
    acceptsChildren: "*",
    freeformCapable: true,
    rootOnly: false,
    groups: ["position", "effects", "responsive", "advanced"],
    defaultSize: { width: 300, height: 200 },
  }),
  heading: def({
    type: "heading",
    label: "Heading",
    category: "Text",
    description: "A page or section title.",
    keywords: ["title", "h1", "h2", "h3"],
    props: z.object({ text: MediumText.default("Heading"), level: z.number().int().min(1).max(4).default(2) }),
    defaultProps: () => ({ text: "Add a heading", level: 2 }),
    defaultStyle: () => ({}),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    inlineText: "heading",
    groups: ["content", "typography", ...commonGroups, "effects", "interactions"],
    textStyle: "heading2",
    defaultSize: { width: 480, height: 56 },
  }),
  paragraph: def({
    type: "paragraph",
    label: "Text",
    category: "Text",
    description: "A block of body text.",
    keywords: ["paragraph", "body", "copy"],
    props: z.object({ text: z.string().max(20000).default("") }),
    defaultProps: () => ({ text: "Add your text here. Click to edit." }),
    defaultStyle: () => ({}),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    inlineText: "paragraph",
    groups: ["content", "typography", ...commonGroups, "effects", "interactions"],
    textStyle: "body",
    defaultSize: { width: 480, height: 96 },
  }),
  richText: def({
    type: "richText",
    label: "Rich text",
    category: "Text",
    description: "Formatted text with headings, lists and links.",
    keywords: ["formatted", "article", "list", "bold"],
    props: z.object({ blocks: RichText.default([]) }),
    defaultProps: () => ({ blocks: [{ type: "paragraph" as const, runs: [{ text: "Write something meaningful." }] }] }),
    defaultStyle: () => ({}),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    inlineText: "rich",
    groups: ["content", "typography", ...commonGroups, "effects"],
    textStyle: "body",
    defaultSize: { width: 560, height: 160 },
  }),
  image: def({
    type: "image",
    label: "Image",
    category: "Media",
    description: "A photo or graphic from your media library.",
    keywords: ["photo", "picture", "logo"],
    props: image,
    defaultProps: () => image.parse({}),
    defaultStyle: () => ({ width: "100%", objectFit: "cover", radius: 0 }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["media", "link", ...commonGroups, "border", "effects", "interactions"],
    defaultSize: { width: 400, height: 300 },
  }),
  button: def({
    type: "button",
    label: "Button",
    category: "Buttons & links",
    description: "A call to action that links to a page, URL, email or phone.",
    keywords: ["cta", "link", "action"],
    props: z.object({
      label: ShortText.default("Button"),
      link: LinkTarget.default({ kind: "none" }),
      variant: z.enum(BUTTON_VARIANTS).default("primary"),
      icon: z.enum(["none", "arrow-right", "arrow-down", "mail", "phone", "download", "external"]).default("none"),
      iconPosition: z.enum(["left", "right"]).default("right"),
      fullWidth: z.boolean().default(false),
      disabled: z.boolean().default(false),
      ariaLabel: ShortText.optional(),
    }),
    defaultProps: () => ({ label: "Get started", link: { kind: "none" as const }, variant: "primary" as const, icon: "none" as const, iconPosition: "right" as const, fullWidth: false, disabled: false }),
    defaultStyle: () => ({}),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    inlineText: "button",
    groups: ["content", "link", "typography", "fill", "border", ...commonGroups, "effects", "interactions"],
    textStyle: "button",
    defaultSize: { width: 180, height: 48 },
  }),
  icon: def({
    type: "icon",
    label: "Icon",
    category: "Shapes",
    description: "A simple symbol from the built-in icon set.",
    keywords: ["symbol", "glyph"],
    props: z.object({
      name: z.enum(["star", "heart", "check", "arrow-right", "mail", "phone", "pin", "camera", "leaf", "sun", "moon", "sparkle", "quote", "play", "menu", "globe", "clock", "calendar", "user", "tag"]).default("star"),
      size: z.number().min(8).max(400).default(32),
      link: LinkTarget.optional(),
    }),
    defaultProps: () => ({ name: "star" as const, size: 32 }),
    defaultStyle: () => ({ color: "var(--b-primary)" }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", "link", "fill", ...commonGroups, "effects", "interactions"],
    defaultSize: { width: 48, height: 48 },
  }),
  shape: def({
    type: "shape",
    label: "Shape",
    category: "Shapes",
    description: "A rectangle, circle, line or blob for decoration.",
    keywords: ["rectangle", "circle", "ellipse", "triangle", "line", "blob"],
    props: z.object({ kind: z.enum(["rectangle", "circle", "triangle", "line", "blob"]).default("rectangle") }),
    defaultProps: () => ({ kind: "rectangle" as const }),
    defaultStyle: () => ({ background: { type: "color", color: "var(--b-accent)" }, width: 160, height: 160 }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", "fill", "border", ...commonGroups, "effects", "interactions"],
    defaultSize: { width: 160, height: 160 },
  }),
  divider: def({
    type: "divider",
    label: "Divider",
    category: "Shapes",
    description: "A horizontal rule between content.",
    keywords: ["line", "separator", "hr"],
    props: z.object({ thickness: z.number().min(1).max(20).default(1), lineStyle: z.enum(["solid", "dashed", "dotted"]).default("solid") }),
    defaultProps: () => ({ thickness: 1, lineStyle: "solid" as const }),
    defaultStyle: () => ({ color: "var(--b-border)", width: "100%" }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", ...commonGroups],
    defaultSize: { width: 400, height: 1 },
  }),
  spacer: def({
    type: "spacer",
    label: "Spacer",
    category: "Structure",
    description: "Empty vertical space.",
    keywords: ["gap", "space", "padding"],
    props: z.object({ size: z.number().min(0).max(600).default(40) }),
    defaultProps: () => ({ size: 40 }),
    defaultStyle: () => ({}),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: false,
    rootOnly: false,
    groups: ["content", "responsive", "advanced"],
    defaultSize: { width: 100, height: 40 },
  }),
  gallery: def({
    type: "gallery",
    label: "Gallery",
    category: "Media",
    description: "A responsive grid of images.",
    keywords: ["photos", "grid", "portfolio", "masonry"],
    props: z.object({
      images: z.array(image).max(60).default([]),
      columns: z.number().int().min(1).max(6).default(3),
      gap: z.number().min(0).max(80).default(16),
      aspect: z.enum(["square", "landscape", "portrait", "natural"]).default("square"),
      lightbox: z.boolean().default(false),
    }),
    defaultProps: () => ({ images: [], columns: 3, gap: 16, aspect: "square" as const, lightbox: false }),
    defaultStyle: () => ({ width: "100%" }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: false,
    rootOnly: false,
    groups: ["media", "layout", ...commonGroups, "border", "effects"],
    defaultSize: { width: 1200, height: 400 },
  }),
  video: def({
    type: "video",
    label: "Video",
    category: "Media",
    description: "An embedded YouTube or Vimeo video, or an uploaded file.",
    keywords: ["youtube", "vimeo", "embed", "movie"],
    props: z.object({
      provider: z.enum(["youtube", "vimeo", "file"]).default("youtube"),
      videoId: z.string().max(64).regex(/^[A-Za-z0-9_-]*$/).default(""),
      src: z.string().max(2048).default(""),
      title: ShortText.default("Video"),
      autoplay: z.boolean().default(false),
      loop: z.boolean().default(false),
      muted: z.boolean().default(false),
      controls: z.boolean().default(true),
    }),
    defaultProps: () => ({ provider: "youtube" as const, videoId: "", src: "", title: "Video", autoplay: false, loop: false, muted: false, controls: true }),
    defaultStyle: () => ({ width: "100%", aspectRatio: "16 / 9" }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["media", ...commonGroups, "border", "effects"],
    defaultSize: { width: 640, height: 360 },
  }),
  map: def({
    type: "map",
    label: "Map",
    category: "Content blocks",
    description: "A map centred on an address.",
    keywords: ["location", "address", "directions"],
    props: z.object({ address: ShortText.default(""), zoom: z.number().int().min(1).max(20).default(14), title: ShortText.default("Map") }),
    defaultProps: () => ({ address: "", zoom: 14, title: "Map" }),
    defaultStyle: () => ({ width: "100%", height: 360 }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", ...commonGroups, "border", "effects"],
    defaultSize: { width: 600, height: 360 },
  }),
  form: def({
    type: "form",
    label: "Form",
    category: "Content blocks",
    description: "A contact or sign-up form. Submissions are stored in your site.",
    keywords: ["contact", "signup", "newsletter", "input"],
    props: z.object({
      title: ShortText.default(""),
      fields: z
        .array(
          z.object({
            id: Identifier,
            type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
            label: ShortText,
            placeholder: ShortText.optional(),
            required: z.boolean().default(false),
            options: z.array(ShortText).max(30).optional(),
          }),
        )
        .max(20)
        .default([]),
      submitLabel: ShortText.default("Send"),
      successMessage: ShortText.default("Thanks! Your message has been sent."),
      buttonVariant: z.enum(BUTTON_VARIANTS).default("primary"),
    }),
    defaultProps: () => ({
      title: "",
      fields: [
        { id: newId("fld"), type: "text" as const, label: "Name", required: true },
        { id: newId("fld"), type: "email" as const, label: "Email", required: true },
        { id: newId("fld"), type: "textarea" as const, label: "Message", required: false },
      ],
      submitLabel: "Send",
      successMessage: "Thanks! Your message has been sent.",
      buttonVariant: "primary" as const,
    }),
    defaultStyle: () => ({ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", "typography", ...commonGroups, "fill", "border", "effects"],
    defaultSize: { width: 480, height: 360 },
  }),
  socialLinks: def({
    type: "socialLinks",
    label: "Social links",
    category: "Content blocks",
    description: "Icons linking to your social profiles.",
    keywords: ["instagram", "facebook", "twitter", "x", "linkedin", "youtube", "tiktok"],
    props: z.object({
      links: z
        .array(z.object({ network: z.enum(["instagram", "facebook", "x", "linkedin", "youtube", "tiktok", "github", "pinterest", "email", "website"]), url: z.string().max(2048) }))
        .max(12)
        .default([]),
      size: z.number().min(16).max(64).default(24),
      style: z.enum(["plain", "circle", "square"]).default("plain"),
    }),
    defaultProps: () => ({ links: [{ network: "instagram" as const, url: "https://instagram.com/" }, { network: "facebook" as const, url: "https://facebook.com/" }], size: 24, style: "plain" as const }),
    defaultStyle: () => ({ display: "flex", gap: 16, color: "var(--b-text)" }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", "fill", ...commonGroups, "effects"],
    defaultSize: { width: 200, height: 32 },
  }),
  navigation: def({
    type: "navigation",
    label: "Navigation",
    category: "Site",
    description: "The site menu. Uses your pages automatically unless customised.",
    keywords: ["menu", "header", "links", "nav"],
    props: z.object({
      logoText: ShortText.default(""),
      logoImage: z.string().max(2048).default(""),
      logoLink: z.boolean().default(true),
      alignment: z.enum(["left", "center", "right", "space-between"]).default("space-between"),
      mobileMenu: z.enum(["hamburger", "inline"]).default("hamburger"),
      cta: z.object({ label: ShortText, link: LinkTarget, variant: z.enum(BUTTON_VARIANTS) }).optional(),
    }),
    defaultProps: () => ({ logoText: "My site", logoImage: "", logoLink: true, alignment: "space-between" as const, mobileMenu: "hamburger" as const }),
    defaultStyle: () => ({ padding: { top: 16, bottom: 16, left: 24, right: 24 } }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: false,
    rootOnly: false,
    groups: ["content", "typography", "fill", "spacing", "border", "responsive", "accessibility", "advanced"],
    textStyle: "navigation",
    defaultSize: { width: 1200, height: 64 },
  }),
  card: def({
    type: "card",
    label: "Card",
    category: "Content blocks",
    description: "A framed block with an image, title and text.",
    keywords: ["feature", "tile", "service", "pricing"],
    props: z.object({}),
    defaultProps: () => ({}),
    defaultStyle: () => ({ display: "flex", flexDirection: "column", gap: 12, padding: { top: 24, right: 24, bottom: 24, left: 24 }, background: { type: "color", color: "var(--b-surface)" }, radius: 16, shadow: "sm", border: { width: 1, style: "solid", color: "var(--b-border)" } }),
    container: true,
    layoutModes: ["flow"],
    acceptsChildren: "*",
    freeformCapable: true,
    rootOnly: false,
    groups: ["layout", ...commonGroups, "fill", "border", "effects", "interactions"],
    defaultSize: { width: 360, height: 320 },
    defaultChildren: () => [
      makeNode("heading", { text: "Feature title", level: 3 }, { textStyle: "heading3" }),
      makeNode("paragraph", { text: "Describe what makes this valuable in one or two sentences." }),
    ],
  }),
  hero: def({
    type: "hero",
    label: "Hero",
    category: "Content blocks",
    description: "A large opening block with a headline, supporting text and a button.",
    keywords: ["banner", "intro", "header", "cover"],
    props: z.object({ align: z.enum(["left", "center"]).default("center") }),
    defaultProps: () => ({ align: "center" as const }),
    defaultStyle: () => ({ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", textAlign: "center", padding: { top: 40, bottom: 40, left: 0, right: 0 }, maxWidth: 820, margin: { left: "auto", right: "auto" } }),
    container: true,
    layoutModes: ["flow"],
    acceptsChildren: "*",
    freeformCapable: false,
    rootOnly: false,
    groups: ["layout", ...commonGroups, "fill", "effects"],
    defaultSize: { width: 1200, height: 420 },
    defaultChildren: () => [
      makeNode("heading", { text: "A clear headline that says what you do", level: 1 }, { textStyle: "heading1" }),
      makeNode("paragraph", { text: "One or two sentences that explain who this is for and why it matters." }),
      makeNode("button", { label: "Get in touch", variant: "primary", link: { kind: "none" } }),
    ],
  }),
  footer: def({
    type: "footer",
    label: "Footer",
    category: "Site",
    description: "The bottom of every page: copyright, links and socials.",
    keywords: ["bottom", "copyright"],
    props: z.object({ text: MediumText.default(""), showNavigation: z.boolean().default(true) }),
    defaultProps: () => ({ text: `© ${new Date().getFullYear()} My site`, showNavigation: true }),
    defaultStyle: () => ({ padding: { top: 32, bottom: 32, left: 24, right: 24 }, background: { type: "color", color: "var(--b-surface)" }, color: "var(--b-muted)", fontSize: 14 }),
    container: true,
    layoutModes: ["flow"],
    acceptsChildren: "*",
    freeformCapable: false,
    rootOnly: false,
    groups: ["content", "layout", "spacing", "typography", "fill", "border", "responsive", "accessibility", "advanced"],
    textStyle: "small",
    defaultSize: { width: 1200, height: 120 },
  }),
  contact: def({
    type: "contact",
    label: "Contact details",
    category: "Content blocks",
    description: "Email, phone, address and opening hours.",
    keywords: ["email", "phone", "address", "hours"],
    props: z.object({
      email: z.string().max(254).default(""),
      phone: z.string().max(40).default(""),
      address: MediumText.default(""),
      hours: MediumText.default(""),
    }),
    defaultProps: () => ({ email: "hello@example.com", phone: "", address: "", hours: "" }),
    defaultStyle: () => ({ display: "flex", flexDirection: "column", gap: 8 }),
    container: false,
    layoutModes: [],
    acceptsChildren: [],
    freeformCapable: true,
    rootOnly: false,
    groups: ["content", "typography", ...commonGroups, "fill"],
    textStyle: "body",
    defaultSize: { width: 360, height: 160 },
  }),
} satisfies Record<ComponentType, ComponentDefinition<any>>;

export type Registry = typeof REGISTRY;

export function getDefinition(type: ComponentType): ComponentDefinition {
  return REGISTRY[type] as unknown as ComponentDefinition;
}

export function isComponentType(t: string): t is ComponentType {
  return Object.prototype.hasOwnProperty.call(REGISTRY, t);
}

export function listComponents(): ComponentDefinition[] {
  return Object.values(REGISTRY) as unknown as ComponentDefinition[];
}

/** Components that can be inserted from the Elements panel. */
export function insertableComponents(): ComponentDefinition[] {
  return listComponents().filter((d) => !d.rootOnly && d.type !== "group");
}

/** Create a fresh, valid node of the given type with registry defaults. */
export function makeNode(
  type: ComponentType,
  props: Record<string, unknown> = {},
  extra: Partial<Pick<Node, "name" | "style" | "textStyle" | "layout" | "children">> = {},
): Node {
  const d = getDefinition(type);
  const parsedProps = d.props.parse({ ...d.defaultProps(), ...props }) as Record<string, unknown>;
  const node: Node = {
    id: newId(type.slice(0, 4)),
    type,
    props: parsedProps,
    style: { ...d.defaultStyle(), ...(extra.style ?? {}) },
    visibility: { desktop: true, tablet: true, mobile: true },
    locked: false,
    hidden: false,
  };
  if (extra.name) node.name = extra.name;
  const ts = extra.textStyle ?? d.textStyle;
  if (ts) node.textStyle = ts;
  if (d.container) {
    node.layout = { mode: "flow", designWidth: 1200, designHeight: 600, stackOnMobile: false, contentWidth: null, ...(extra.layout ?? {}) };
    if (type === "group") node.layout.mode = "free";
    node.children = extra.children ?? d.defaultChildren?.() ?? [];
  }
  return node;
}

/** Validate a node's props against its registry definition. Returns parsed props or throws ZodError. */
export function validateProps(type: ComponentType, props: unknown): Record<string, unknown> {
  return getDefinition(type).props.parse(props) as Record<string, unknown>;
}

export function canContain(parentType: ComponentType, childType: ComponentType): boolean {
  const p = getDefinition(parentType);
  if (!p.container) return false;
  const c = getDefinition(childType);
  if (c.rootOnly) return false;
  if (p.acceptsChildren === "*") return true;
  return p.acceptsChildren.includes(childType);
}
