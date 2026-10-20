import type { Background, Node, Shadow, StyleSet, Theme, Length, Sides, TextStyle, Breakpoint } from "../schema/document.js";
import { FONT_STACKS, BREAKPOINT_MAX } from "../schema/document.js";
import { cssUrl } from "./escape.js";

export function len(v: Length | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

function sides(s: Sides | undefined, prop: string, out: string[]) {
  if (!s) return;
  if (s.top !== undefined) out.push(`${prop}-top:${len(s.top)}`);
  if (s.right !== undefined) out.push(`${prop}-right:${len(s.right)}`);
  if (s.bottom !== undefined) out.push(`${prop}-bottom:${len(s.bottom)}`);
  if (s.left !== undefined) out.push(`${prop}-left:${len(s.left)}`);
}

export function shadowValue(sh: Shadow | undefined, theme: Theme): string | undefined {
  if (!sh) return undefined;
  if (typeof sh === "string") return sh === "none" ? "none" : theme.shadows[sh as keyof typeof theme.shadows];
  return `${sh.inset ? "inset " : ""}${sh.x}px ${sh.y}px ${sh.blur}px ${sh.spread}px ${sh.color}`;
}

export function backgroundDecls(bg: Background | undefined, out: string[]) {
  if (!bg || bg.type === "none") return;
  const layers: string[] = [];
  if (bg.overlayColor) {
    const o = bg.overlayOpacity ?? 0.5;
    layers.push(`linear-gradient(${withAlpha(bg.overlayColor, o)}, ${withAlpha(bg.overlayColor, o)})`);
  }
  if (bg.type === "color" && bg.color) out.push(`background-color:${bg.color}`);
  if (bg.type === "gradient" && bg.gradient) layers.push(`linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`);
  if (bg.type === "image" && bg.image?.src) {
    layers.push(`url("${cssUrl(bg.image.src)}")`);
    out.push(`background-size:${bg.image.size}`);
    out.push(`background-position:${bg.image.position}`);
    out.push(`background-repeat:${bg.image.repeat}`);
    if (bg.image.attachment === "fixed") out.push("background-attachment:fixed");
  }
  if (layers.length) out.push(`background-image:${layers.join(",")}`);
}

/** Accepts hex/rgb/var; returns a color with alpha where possible. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3,8})$/i.exec(color);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith("var(")) return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  return color;
}

const LAYOUT_KEYS: (keyof StyleSet)[] = ["display", "flexDirection", "justifyContent", "alignItems", "flexWrap", "gridColumns", "gridRows", "gap", "rowGap", "columnGap"];

export function isLayoutKey(k: string): boolean {
  return (LAYOUT_KEYS as string[]).includes(k);
}

/** Serialize a StyleSet into CSS declarations. `only` restricts to a subset of keys. */
export function styleDecls(s: StyleSet, theme: Theme, filter?: (k: string) => boolean): string[] {
  const out: string[] = [];
  const has = (k: keyof StyleSet) => s[k] !== undefined && (!filter || filter(k));
  if (has("width")) out.push(`width:${len(s.width)}`);
  if (has("height")) out.push(`height:${len(s.height)}`);
  if (has("minWidth")) out.push(`min-width:${len(s.minWidth)}`);
  if (has("maxWidth")) out.push(`max-width:${len(s.maxWidth)}`);
  if (has("minHeight")) out.push(`min-height:${len(s.minHeight)}`);
  if (has("maxHeight")) out.push(`max-height:${len(s.maxHeight)}`);
  if (has("aspectRatio")) out.push(`aspect-ratio:${s.aspectRatio}`);
  if (has("padding")) sides(s.padding, "padding", out);
  if (has("margin")) sides(s.margin, "margin", out);
  if (has("gap")) out.push(`gap:${len(s.gap)}`);
  if (has("rowGap")) out.push(`row-gap:${len(s.rowGap)}`);
  if (has("columnGap")) out.push(`column-gap:${len(s.columnGap)}`);
  if (has("display")) out.push(`display:${s.display}`);
  if (has("flexDirection")) out.push(`flex-direction:${s.flexDirection}`);
  if (has("justifyContent")) out.push(`justify-content:${s.justifyContent}`);
  if (has("alignItems")) out.push(`align-items:${s.alignItems}`);
  if (has("flexWrap")) out.push(`flex-wrap:${s.flexWrap}`);
  if (has("gridColumns")) out.push(`grid-template-columns:repeat(${s.gridColumns},minmax(0,1fr))`);
  if (has("gridRows")) out.push(`grid-template-rows:repeat(${s.gridRows},auto)`);
  if (has("alignSelf")) out.push(`align-self:${s.alignSelf}`);
  if (has("justifySelf")) out.push(`justify-self:${s.justifySelf}`);
  if (has("flexGrow")) out.push(`flex-grow:${s.flexGrow}`);
  if (has("order")) out.push(`order:${s.order}`);
  if (has("overflow")) out.push(`overflow:${s.overflow}`);
  if (has("color")) out.push(`color:${s.color}`);
  if (has("fontFamily")) out.push(`font-family:${fontStack(s.fontFamily!)}`);
  if (has("fontSize")) out.push(`font-size:${len(s.fontSize)}`);
  if (has("fontWeight")) out.push(`font-weight:${s.fontWeight}`);
  if (has("fontStyle")) out.push(`font-style:${s.fontStyle}`);
  if (has("lineHeight")) out.push(`line-height:${typeof s.lineHeight === "number" ? s.lineHeight : len(s.lineHeight)}`);
  if (has("letterSpacing")) out.push(`letter-spacing:${len(s.letterSpacing)}`);
  if (has("textTransform")) out.push(`text-transform:${s.textTransform}`);
  if (has("textAlign")) out.push(`text-align:${s.textAlign}`);
  if (has("verticalAlign")) out.push(`justify-content:${s.verticalAlign === "top" ? "flex-start" : s.verticalAlign === "bottom" ? "flex-end" : "center"}`);
  if (has("textDecoration")) out.push(`text-decoration:${s.textDecoration}`);
  if (has("textShadow")) out.push(`text-shadow:${s.textShadow!.x}px ${s.textShadow!.y}px ${s.textShadow!.blur}px ${s.textShadow!.color}`);
  if (has("highlightColor")) out.push(`background-color:${s.highlightColor};box-decoration-break:clone;-webkit-box-decoration-break:clone`);
  if (has("background")) backgroundDecls(s.background, out);
  if (has("border") && s.border) {
    const b = s.border;
    if (b.style === "none" || b.width === 0) out.push("border:none");
    else if (!b.sides) out.push(`border:${b.width}px ${b.style} ${b.color}`);
    else {
      (["top", "right", "bottom", "left"] as const).forEach((side) => {
        out.push(b.sides![side] ? `border-${side}:${b.width}px ${b.style} ${b.color}` : `border-${side}:none`);
      });
    }
  }
  if (has("radius")) {
    const r = s.radius!;
    if (typeof r === "object") {
      out.push(`border-radius:${len(r.topLeft ?? 0)} ${len(r.topRight ?? 0)} ${len(r.bottomRight ?? 0)} ${len(r.bottomLeft ?? 0)}`);
    } else out.push(`border-radius:${len(r)}`);
  }
  if (has("shadow")) out.push(`box-shadow:${shadowValue(s.shadow, theme)}`);
  if (has("opacity")) out.push(`opacity:${s.opacity}`);
  if (has("filter") && s.filter) {
    const f = s.filter;
    const parts: string[] = [];
    if (f.brightness !== undefined) parts.push(`brightness(${f.brightness})`);
    if (f.contrast !== undefined) parts.push(`contrast(${f.contrast})`);
    if (f.saturate !== undefined) parts.push(`saturate(${f.saturate})`);
    if (f.blur !== undefined) parts.push(`blur(${f.blur}px)`);
    if (f.grayscale !== undefined) parts.push(`grayscale(${f.grayscale})`);
    if (f.sepia !== undefined) parts.push(`sepia(${f.sepia})`);
    if (parts.length) out.push(`filter:${parts.join(" ")}`);
  }
  if (has("backdropBlur")) out.push(`backdrop-filter:blur(${s.backdropBlur}px);-webkit-backdrop-filter:blur(${s.backdropBlur}px)`);
  if (has("zIndex")) out.push(`z-index:${s.zIndex}`);
  if (has("objectFit")) out.push(`object-fit:${s.objectFit}`);
  if (has("objectPosition")) out.push(`object-position:${s.objectPosition}`);
  return out;
}

export function hoverDecls(s: StyleSet, theme: Theme): string[] {
  const h = s.hover;
  if (!h) return [];
  const out: string[] = [];
  backgroundDecls(h.background, out);
  if (h.color) out.push(`color:${h.color}`);
  if (h.borderColor) out.push(`border-color:${h.borderColor}`);
  if (h.opacity !== undefined) out.push(`opacity:${h.opacity}`);
  if (h.shadow) out.push(`box-shadow:${shadowValue(h.shadow, theme)}`);
  if (h.scale !== undefined) out.push(`transform:scale(${h.scale})`);
  return out;
}

export function fontStack(name: string): string {
  return (FONT_STACKS as Record<string, string>)[name] ?? name;
}

export function textStyleDecls(ts: TextStyle, theme: Theme): string[] {
  const family = ts.fontFamily === "heading" ? theme.fonts.heading : theme.fonts.body;
  return [
    `font-family:${fontStack(family)}`,
    `font-size:${ts.fontSize}px`,
    `font-weight:${ts.fontWeight}`,
    `line-height:${ts.lineHeight}`,
    `letter-spacing:${ts.letterSpacing}em`,
    `text-transform:${ts.textTransform}`,
  ];
}

export function mediaQuery(bp: Exclude<Breakpoint, "desktop">): string {
  return `@media (max-width:${BREAKPOINT_MAX[bp]}px)`;
}

export const DESKTOP_ONLY_QUERY = `@media (min-width:${BREAKPOINT_MAX.tablet + 1}px)`;

/** Effective style for a breakpoint (desktop → tablet → mobile cascade). */
export function effectiveStyle(node: Node, bp: Breakpoint): StyleSet {
  if (bp === "desktop") return node.style;
  const t = { ...node.style, ...(node.responsive?.tablet ?? {}) };
  if (bp === "tablet") return t;
  return { ...t, ...(node.responsive?.mobile ?? {}) };
}
