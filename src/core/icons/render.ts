import type { IconNode } from "./types.js";
import { iconNodeProblem, isClosedNode } from "./safe.js";

export type IconVariant = "outline" | "duotone" | "filled" | "inverted" | "brand";
export const ICON_VARIANTS: readonly IconVariant[] = ["outline", "duotone", "filled", "inverted", "brand"];

export const ICON_SIZE_PRESETS = [12, 16, 20, 24, 32, 48, 64, 96, 128] as const;
export const ICON_MIN_SIZE = 8;
export const ICON_MAX_SIZE = 400;
export const ICON_STROKE_MIN = 0.5;
export const ICON_STROKE_MAX = 4;
export const ICON_STROKE_DEFAULT = 2;
export const DUOTONE_FILL_OPACITY = 0.22;

export interface IconGradient {
  from: string;
  to: string;
  /** Degrees, 0 = left→right, 90 = top→bottom. */
  angle: number;
}

export interface IconRenderOptions {
  variant?: IconVariant;
  /** Square edge in px. */
  size?: number;
  strokeWidth?: number;
  /** A validated colour; defaults to currentColor so the surrounding CSS (theme, brand kit) decides. */
  color?: string;
  gradient?: IconGradient;
  /** Foreground used on the badge background for the inverted variant. */
  inverseColor?: string;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Present → meaningful icon (role=img). Absent → decorative (aria-hidden). */
  label?: string;
  /** Unique within the document; used for the gradient id. Letters, digits and hyphens only. */
  idPrefix?: string;
}

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.\s,%/]+\)|hsla?\([\d.\s,%/deg]+\)|transparent|currentColor|var\(--b-[a-z0-9-]+\))$/;

export function isSafeIconColor(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && COLOR.test(value);
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;

function nodeMarkup(node: IconNode, extra: string): string {
  const [tag, attrs] = node;
  const parts = Object.entries(attrs).map(([k, v]) => `${k}="${attr(String(v))}"`);
  const dot = attrs.fill === "currentColor";
  return `<${tag} ${parts.filter((p) => !p.startsWith("fill=")).join(" ")}${dot ? ' fill="PAINT" stroke="none"' : extra}/>`;
}

/**
 * Builds a standalone SVG for one icon. Pure and synchronous: geometry in, markup out. Unsafe nodes are dropped
 * (defence in depth — registry data is also validated at build/test time). Used by the website renderer,
 * the browser previews and the Design Studio canvas export, so all three show identical output.
 */
export function renderIconSvg(nodes: readonly IconNode[], options: IconRenderOptions = {}): string {
  const variant = options.variant ?? "outline";
  const size = Math.round(clamp(options.size, ICON_MIN_SIZE, ICON_MAX_SIZE, 24));
  const strokeWidth = clamp(options.strokeWidth, ICON_STROKE_MIN, ICON_STROKE_MAX, ICON_STROKE_DEFAULT);
  const safe = nodes.filter((n) => iconNodeProblem(n) === null);
  const color = isSafeIconColor(options.color) ? options.color : "currentColor";
  const gid = `${(options.idPrefix ?? "bi").replace(/[^A-Za-z0-9-]/g, "") || "bi"}-g`;
  const g = options.gradient;
  const gradient = g && isSafeIconColor(g.from) && isSafeIconColor(g.to) ? g : undefined;
  const paint = gradient ? `url(#${gid})` : color;
  const inverse = isSafeIconColor(options.inverseColor) ? options.inverseColor : "#ffffff";

  let defs = "";
  if (gradient) {
    const a = (clamp(gradient.angle, 0, 360, 0) * Math.PI) / 180;
    const x1 = 12 - Math.cos(a) * 12;
    const y1 = 12 - Math.sin(a) * 12;
    const x2 = 12 + Math.cos(a) * 12;
    const y2 = 12 + Math.sin(a) * 12;
    defs = `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}"><stop offset="0" stop-color="${attr(gradient.from)}"/><stop offset="1" stop-color="${attr(gradient.to)}"/></linearGradient></defs>`;
  }

  const inverted = variant === "inverted";
  const strokePaint = inverted ? inverse : paint;
  const body = safe
    .map((node) => {
      let extra = "";
      if (!inverted && (variant === "duotone" || variant === "filled") && isClosedNode(node)) {
        extra = variant === "filled" ? ` fill="${strokePaint}"` : ` fill="${strokePaint}" fill-opacity="${DUOTONE_FILL_OPACITY}"`;
      }
      return nodeMarkup(node, extra).replace(/PAINT/g, strokePaint);
    })
    .join("");

  const rotation = clamp(options.rotation, -360, 360, 0);
  const sx = options.flipX ? -1 : 1;
  const sy = options.flipY ? -1 : 1;
  const transformed = rotation !== 0 || sx !== 1 || sy !== 1;
  const inner = transformed ? `<g transform="translate(12 12) rotate(${num(rotation)}) scale(${sx} ${sy}) translate(-12 -12)">${body}</g>` : body;
  const content = inverted
    ? `<rect width="24" height="24" rx="5.5" fill="${paint}" stroke="none"/><g transform="translate(3.6 3.6) scale(0.7)" stroke="${inverse}">${inner}</g>`
    : inner;

  const a11y = options.label
    ? ` role="img" aria-label="${attr(options.label.slice(0, 200))}"`
    : ` aria-hidden="true" focusable="false"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${paint}" stroke-width="${num(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${a11y}>${defs}${content}</svg>`;
}
