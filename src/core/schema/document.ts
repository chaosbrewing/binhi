import { z } from "zod";
import { ID_PATTERN } from "../ids.js";

/**
 * BINHI canonical website model — schema version 1.
 *
 * The document is the single source of truth. Rendered HTML, CSS and
 * published artifacts are derived from it and never edited by hand.
 * Every editor action becomes a validated operation (see ../ops) against a
 * known revision of this document.
 */
export const SCHEMA_VERSION = 1 as const;

export const BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Viewport widths used by the editor preview; the renderer's CSS media
 *  queries use the max-widths so preview and publication agree. */
export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1280,
  tablet: 820,
  mobile: 390,
};
export const BREAKPOINT_MAX: Record<Exclude<Breakpoint, "desktop">, number> = {
  tablet: 1023,
  mobile: 639,
};

const id = z.string().regex(ID_PATTERN, "invalid identifier");
const shortText = z.string().max(200);
const mediumText = z.string().max(2000);
const longText = z.string().max(20000);

/** A CSS length the model accepts: a number of pixels, or a string with an
 *  explicit, whitelisted unit. Arbitrary CSS is never stored. */
export const Length = z.union([
  z.number().finite(),
  z.string().regex(/^-?\d+(\.\d+)?(px|%|rem|em|vw|vh|cqw)$/),
  z.enum(["auto", "fit-content", "max-content", "min-content"]),
]);
export type Length = z.infer<typeof Length>;

export const Color = z
  .string()
  .max(64)
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.\s,%/]+\)|hsla?\([\d.\s,%/deg]+\)|transparent|currentColor|var\(--b-[a-z0-9-]+\))$/,
    "invalid color",
  );
export type Color = z.infer<typeof Color>;

export const Sides = z.object({
  top: Length.optional(),
  right: Length.optional(),
  bottom: Length.optional(),
  left: Length.optional(),
});
export type Sides = z.infer<typeof Sides>;

export const Corners = z.object({
  topLeft: Length.optional(),
  topRight: Length.optional(),
  bottomRight: Length.optional(),
  bottomLeft: Length.optional(),
});

export const Gradient = z.object({
  angle: z.number().min(0).max(360).default(180),
  from: Color,
  to: Color,
});

export const ImageFill = z.object({
  src: z.string().max(2048),
  size: z.enum(["cover", "contain", "auto"]).default("cover"),
  position: z.string().max(40).regex(/^[a-z0-9% .-]+$/).default("center"),
  repeat: z.enum(["no-repeat", "repeat", "repeat-x", "repeat-y"]).default("no-repeat"),
  attachment: z.enum(["scroll", "fixed"]).default("scroll"),
});

export const Background = z.object({
  type: z.enum(["none", "color", "gradient", "image"]).default("none"),
  color: Color.optional(),
  gradient: Gradient.optional(),
  image: ImageFill.optional(),
  overlayColor: Color.optional(),
  overlayOpacity: z.number().min(0).max(1).optional(),
});
export type Background = z.infer<typeof Background>;

export const Border = z.object({
  width: z.number().min(0).max(64).default(1),
  style: z.enum(["solid", "dashed", "dotted", "none"]).default("solid"),
  color: Color.default("#000000"),
  sides: z
    .object({ top: z.boolean(), right: z.boolean(), bottom: z.boolean(), left: z.boolean() })
    .optional(),
});

export const Shadow = z.union([
  z.enum(["none", "sm", "md", "lg", "xl"]),
  z.object({
    x: z.number().min(-200).max(200),
    y: z.number().min(-200).max(200),
    blur: z.number().min(0).max(200),
    spread: z.number().min(-100).max(100).default(0),
    color: Color,
    inset: z.boolean().default(false),
  }),
]);
export type Shadow = z.infer<typeof Shadow>;

export const Filter = z.object({
  brightness: z.number().min(0).max(3).optional(),
  contrast: z.number().min(0).max(3).optional(),
  saturate: z.number().min(0).max(3).optional(),
  blur: z.number().min(0).max(50).optional(),
  grayscale: z.number().min(0).max(1).optional(),
  sepia: z.number().min(0).max(1).optional(),
});

export const TextShadow = z.object({
  x: z.number().min(-50).max(50),
  y: z.number().min(-50).max(50),
  blur: z.number().min(0).max(50),
  color: Color,
});

/**
 * A validated set of visual properties. Every field is optional; the
 * renderer only emits what is present. Breakpoint overrides use the same
 * shape (Partial) and cascade desktop → tablet → mobile.
 */
export const StyleSet = z
  .object({
    // Size
    width: Length.optional(),
    height: Length.optional(),
    minWidth: Length.optional(),
    maxWidth: Length.optional(),
    minHeight: Length.optional(),
    maxHeight: Length.optional(),
    aspectRatio: z.string().max(16).regex(/^\d+(\.\d+)?(\s*\/\s*\d+(\.\d+)?)?$/).optional(),
    // Spacing
    padding: Sides.optional(),
    margin: Sides.optional(),
    gap: Length.optional(),
    rowGap: Length.optional(),
    columnGap: Length.optional(),
    // Layout (containers)
    display: z.enum(["flex", "grid", "block"]).optional(),
    flexDirection: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
    justifyContent: z
      .enum(["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"])
      .optional(),
    alignItems: z.enum(["flex-start", "center", "flex-end", "stretch", "baseline"]).optional(),
    flexWrap: z.enum(["nowrap", "wrap"]).optional(),
    gridColumns: z.number().int().min(1).max(12).optional(),
    gridRows: z.number().int().min(1).max(12).optional(),
    alignSelf: z.enum(["auto", "flex-start", "center", "flex-end", "stretch"]).optional(),
    justifySelf: z.enum(["auto", "start", "center", "end", "stretch"]).optional(),
    flexGrow: z.number().min(0).max(10).optional(),
    order: z.number().int().min(-50).max(50).optional(),
    overflow: z.enum(["visible", "hidden", "auto", "scroll"]).optional(),
    // Typography
    color: Color.optional(),
    fontFamily: z.string().max(80).regex(/^[A-Za-z0-9 ,'"-]+$/).optional(),
    fontSize: Length.optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    lineHeight: z.union([z.number().min(0.5).max(4), Length]).optional(),
    letterSpacing: Length.optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
    textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
    textShadow: TextShadow.optional(),
    highlightColor: Color.optional(),
    // Fills and effects
    background: Background.optional(),
    border: Border.optional(),
    radius: z.union([Length, Corners]).optional(),
    shadow: Shadow.optional(),
    opacity: z.number().min(0).max(1).optional(),
    filter: Filter.optional(),
    backdropBlur: z.number().min(0).max(50).optional(),
    zIndex: z.number().int().min(-10).max(1000).optional(),
    // Media
    objectFit: z.enum(["cover", "contain", "fill", "none"]).optional(),
    objectPosition: z.string().max(40).regex(/^[a-z0-9% .-]+$/).optional(),
    // Interactive states (buttons, links)
    hover: z
      .object({
        background: Background.optional(),
        color: Color.optional(),
        borderColor: Color.optional(),
        opacity: z.number().min(0).max(1).optional(),
        shadow: Shadow.optional(),
        scale: z.number().min(0.5).max(1.5).optional(),
      })
      .optional(),
    focusRingColor: Color.optional(),
  })
  .strict();
export type StyleSet = z.infer<typeof StyleSet>;

export const ResponsiveStyles = z.object({
  tablet: StyleSet.optional(),
  mobile: StyleSet.optional(),
});

/** Controlled freeform placement inside a parent that uses the "free"
 *  layout mode. Coordinates are in design pixels relative to the parent's
 *  content box; the renderer converts them to percentages so the layout
 *  scales with the viewport. */
export const Placement = z.object({
  x: z.number().min(-5000).max(10000),
  y: z.number().min(-5000).max(20000),
  width: z.number().min(1).max(10000),
  height: z.number().min(1).max(20000),
  rotation: z.number().min(-360).max(360).default(0),
  z: z.number().int().min(0).max(1000).default(0),
});
export type Placement = z.infer<typeof Placement>;

export const ResponsivePlacement = z.object({
  desktop: Placement,
  tablet: Placement.optional(),
  mobile: Placement.optional(),
});

export const LayoutMode = z.enum(["flow", "free"]);
export type LayoutMode = z.infer<typeof LayoutMode>;

export const Layout = z.object({
  mode: LayoutMode.default("flow"),
  /** Design width of the free canvas (px). Children positions are relative to it. */
  designWidth: z.number().min(200).max(4000).default(1200),
  /** Design height of the free canvas (px). */
  designHeight: z.number().min(40).max(20000).default(600),
  /** On mobile, lay free children out as a vertical flow instead of scaling. */
  stackOnMobile: z.boolean().default(false),
  /** Content width constraint for structured sections (px); null = full width. */
  contentWidth: z.number().min(320).max(2400).nullable().default(null),
});
export type Layout = z.infer<typeof Layout>;

export const Visibility = z.object({
  desktop: z.boolean().default(true),
  tablet: z.boolean().default(true),
  mobile: z.boolean().default(true),
});

export const Interactions = z.object({
  entrance: z.enum(["none", "fade", "slide-up", "slide-left", "zoom"]).default("none"),
  hover: z.enum(["none", "lift", "grow", "shrink", "fade"]).default("none"),
  durationMs: z.number().int().min(0).max(3000).default(400),
  delayMs: z.number().int().min(0).max(3000).default(0),
  easing: z.enum(["ease", "ease-in", "ease-out", "ease-in-out", "linear"]).default("ease-out"),
  trigger: z.enum(["load", "scroll"]).default("scroll"),
});

export const LinkTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("page"), pageId: id, anchor: z.string().max(80).optional() }),
  z.object({ kind: z.literal("url"), href: z.string().max(2048), newTab: z.boolean().default(false) }),
  z.object({ kind: z.literal("email"), address: z.string().max(254), subject: z.string().max(200).optional() }),
  z.object({ kind: z.literal("phone"), number: z.string().max(40) }),
  z.object({ kind: z.literal("anchor"), anchor: z.string().max(80) }),
  z.object({ kind: z.literal("file"), assetId: id, download: z.boolean().default(true) }),
]);
export type LinkTarget = z.infer<typeof LinkTarget>;

/** Rich text is structured runs, never raw HTML. */
export const TextRun = z.object({
  text: z.string().max(20000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  color: Color.optional(),
  link: LinkTarget.optional(),
});
export const RichBlock = z.object({
  type: z.enum(["paragraph", "h1", "h2", "h3", "h4", "quote", "bullet", "numbered"]).default("paragraph"),
  runs: z.array(TextRun).max(500),
});
export const RichText = z.array(RichBlock).max(500);
export type RichText = z.infer<typeof RichText>;

export const Accessibility = z.object({
  label: shortText.optional(),
  decorative: z.boolean().optional(),
  role: z.enum(["region", "navigation", "banner", "contentinfo", "complementary", "main"]).optional(),
});

export const COMPONENT_TYPES = [
  "section",
  "container",
  "columns",
  "stack",
  "group",
  "heading",
  "paragraph",
  "richText",
  "image",
  "button",
  "icon",
  "shape",
  "divider",
  "spacer",
  "gallery",
  "video",
  "map",
  "form",
  "socialLinks",
  "navigation",
  "card",
  "hero",
  "footer",
  "contact",
] as const;
export const ComponentType = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentType>;

export type Node = {
  id: string;
  type: ComponentType;
  name?: string;
  props: Record<string, unknown>;
  style: StyleSet;
  responsive?: z.infer<typeof ResponsiveStyles>;
  layout?: Layout;
  placement?: z.infer<typeof ResponsivePlacement>;
  visibility: z.infer<typeof Visibility>;
  locked: boolean;
  hidden: boolean;
  textStyle?: string;
  interactions?: z.infer<typeof Interactions>;
  a11y?: z.infer<typeof Accessibility>;
  anchorId?: string;
  reusableId?: string;
  children?: Node[];
};

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z
    .object({
      id,
      type: ComponentType,
      name: shortText.optional(),
      props: z.record(z.unknown()).default({}),
      style: StyleSet.default({}),
      responsive: ResponsiveStyles.optional(),
      layout: Layout.optional(),
      placement: ResponsivePlacement.optional(),
      visibility: Visibility.default({ desktop: true, tablet: true, mobile: true }),
      locked: z.boolean().default(false),
      hidden: z.boolean().default(false),
      textStyle: z.string().max(40).optional(),
      interactions: Interactions.optional(),
      a11y: Accessibility.optional(),
      anchorId: z.string().max(80).regex(/^[A-Za-z][A-Za-z0-9_-]*$/).optional(),
      reusableId: id.optional(),
      children: z.array(NodeSchema).max(500).optional(),
    })
    .strict(),
) as z.ZodType<Node>;

export const PageSeo = z.object({
  title: shortText.optional(),
  description: z.string().max(320).optional(),
  socialImage: z.string().max(2048).optional(),
  canonicalUrl: z.string().max(2048).optional(),
  noIndex: z.boolean().default(false),
});

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;

export const Page = z
  .object({
    id,
    name: shortText.min(1),
    slug: z.string().regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes"),
    isHome: z.boolean().default(false),
    hiddenFromNav: z.boolean().default(false),
    seo: PageSeo.default({}),
    sections: z.array(NodeSchema).max(200).default([]),
  })
  .strict();
export type Page = z.infer<typeof Page>;

export type NavItem = {
  id: string;
  label: string;
  target: LinkTarget;
  children?: NavItem[];
};
export const NavItemSchema: z.ZodType<NavItem, z.ZodTypeDef, unknown> = z.lazy(() =>
  z
    .object({
      id,
      label: shortText.min(1),
      target: LinkTarget,
      children: z.array(NavItemSchema).max(30).optional(),
    })
    .strict(),
);

export const Navigation = z.object({
  /** When true the menu is derived from the pages list (non-hidden pages in order). */
  auto: z.boolean().default(true),
  items: z.array(NavItemSchema).max(30).default([]),
});

export const TEXT_STYLE_KEYS = [
  "display",
  "heading1",
  "heading2",
  "heading3",
  "body",
  "small",
  "caption",
  "button",
  "navigation",
] as const;
export const TextStyleKey = z.enum(TEXT_STYLE_KEYS);
export type TextStyleKey = z.infer<typeof TextStyleKey>;

export const TextStyle = z.object({
  fontFamily: z.enum(["heading", "body"]).default("body"),
  fontSize: z.number().min(8).max(200),
  fontWeight: z.number().int().min(100).max(900).default(400),
  lineHeight: z.number().min(0.8).max(3).default(1.5),
  letterSpacing: z.number().min(-0.2).max(1).default(0),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
  /** Mobile font size override (px). */
  mobileFontSize: z.number().min(8).max(200).optional(),
});
export type TextStyle = z.infer<typeof TextStyle>;

export const THEME_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "muted",
  "border",
] as const;
export const ThemeColorKey = z.enum(THEME_COLOR_KEYS);
export type ThemeColorKey = z.infer<typeof ThemeColorKey>;

export const FONT_STACKS = {
  Inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "Playfair Display": "'Playfair Display', Georgia, 'Times New Roman', serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  "DM Sans": "'DM Sans', system-ui, sans-serif",
  "Space Grotesk": "'Space Grotesk', system-ui, sans-serif",
  Lora: "'Lora', Georgia, serif",
  "System Sans": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  "System Serif": "Georgia, Cambria, 'Times New Roman', Times, serif",
  Monospace: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;
export const FontName = z.enum(Object.keys(FONT_STACKS) as [keyof typeof FONT_STACKS, ...(keyof typeof FONT_STACKS)[]]);
export type FontName = z.infer<typeof FontName>;

export const ButtonStyle = z.object({
  background: Color,
  color: Color,
  borderColor: Color.optional(),
  borderWidth: z.number().min(0).max(8).default(0),
  radius: z.number().min(0).max(999).default(8),
  paddingX: z.number().min(0).max(80).default(20),
  paddingY: z.number().min(0).max(40).default(12),
  hoverBackground: Color.optional(),
  hoverColor: Color.optional(),
  shadow: z.enum(["none", "sm", "md", "lg"]).default("none"),
});

export const Theme = z
  .object({
    colors: z.record(ThemeColorKey, Color),
    /** User-saved brand colours beyond the semantic tokens. */
    palette: z.array(Color).max(24).default([]),
    fonts: z.object({ heading: FontName, body: FontName }),
    textStyles: z.record(TextStyleKey, TextStyle),
    buttons: z.object({ primary: ButtonStyle, secondary: ButtonStyle, ghost: ButtonStyle }),
    links: z.object({ color: Color, hoverColor: Color, underline: z.boolean().default(true) }),
    radii: z.object({
      sm: z.number().min(0).max(64).default(4),
      md: z.number().min(0).max(64).default(8),
      lg: z.number().min(0).max(128).default(16),
      pill: z.number().min(0).max(999).default(999),
    }),
    shadows: z.object({
      sm: z.string().max(200).default("0 1px 2px rgba(0,0,0,0.08)"),
      md: z.string().max(200).default("0 4px 12px rgba(0,0,0,0.10)"),
      lg: z.string().max(200).default("0 12px 32px rgba(0,0,0,0.14)"),
      xl: z.string().max(200).default("0 24px 64px rgba(0,0,0,0.18)"),
    }),
    spacing: z.object({
      contentWidth: z.number().min(600).max(2400).default(1200),
      sectionPaddingY: z.number().min(0).max(400).default(80),
      gap: z.number().min(0).max(120).default(24),
    }),
  })
  .strict();
export type Theme = z.infer<typeof Theme>;

export const ReusableSection = z.object({
  id,
  name: shortText.min(1),
  node: NodeSchema,
  updatedAt: z.string().datetime().optional(),
});

export const SiteSettings = z.object({
  language: z.string().max(12).regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/).default("en"),
  faviconAssetUrl: z.string().max(2048).optional(),
  socialImage: z.string().max(2048).optional(),
  defaultSeoTitle: shortText.optional(),
  defaultSeoDescription: z.string().max(320).optional(),
  headerSticky: z.boolean().default(false),
});

export const SiteDocument = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: shortText.min(1),
    theme: Theme,
    settings: SiteSettings.default({}),
    pages: z.array(Page).min(1).max(100),
    navigation: Navigation.default({ auto: true, items: [] }),
    header: NodeSchema.nullable().default(null),
    footer: NodeSchema.nullable().default(null),
    reusableSections: z.array(ReusableSection).max(100).default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const homes = doc.pages.filter((p) => p.isHome);
    if (homes.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "exactly one page must be the homepage", path: ["pages"] });
    }
    const slugs = new Set<string>();
    doc.pages.forEach((p, i) => {
      if (slugs.has(p.slug)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate page URL "${p.slug}"`, path: ["pages", i, "slug"] });
      }
      slugs.add(p.slug);
    });
    const ids = new Set<string>();
    const walk = (n: Node, path: (string | number)[]) => {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate node id ${n.id}`, path });
      }
      ids.add(n.id);
      n.children?.forEach((c, i) => walk(c, [...path, "children", i]));
    };
    doc.pages.forEach((p, pi) => p.sections.forEach((s, si) => walk(s, ["pages", pi, "sections", si])));
    if (doc.header) walk(doc.header, ["header"]);
    if (doc.footer) walk(doc.footer, ["footer"]);
  });
export type SiteDocument = z.infer<typeof SiteDocument>;

export const MediumText = mediumText;
export const LongText = longText;
export const ShortText = shortText;
export const Identifier = id;
