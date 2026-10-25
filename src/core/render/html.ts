import type { Breakpoint, Node, Page, Placement, SiteDocument, StyleSet, NavItem, RichText, Theme } from "../schema/document.js";
import { BREAKPOINT_MAX, FONT_STACKS } from "../schema/document.js";
import { esc, escMultiline, cls } from "./escape.js";
import { linkAttrs, resolveLink, sanitizeMediaSrc, sanitizeUrl, type LinkContext } from "./links.js";
import { DESKTOP_ONLY_QUERY, effectiveStyle, hoverDecls, isLayoutKey, mediaQuery, styleDecls, textStyleDecls, fontStack, withAlpha } from "./css.js";
import { ICON_PATHS, SOCIAL_PATHS, iconSvg } from "./icons.js";
import { getDefinition } from "../registry/components.js";
import { getIcon, hasIcon, renderIconSvg, type IconNode, type IconVariant } from "../icons/index.js";

export type RenderMode = "publish" | "preview" | "editor";

export interface RenderOptions {
  mode: RenderMode;
  /** Base href of the site with trailing slash, e.g. "/s/my-site/". */
  baseHref: string;
  /** URL of the tiny published-site runtime (scroll animations, mobile nav). */
  runtimeHref?: string;
  /** Publication id embedded as a meta tag so verification can confirm what is live. */
  publicationId?: string;
  /** Resolve a file asset id to a public URL (file links). */
  assetUrl?: (assetId: string) => string | undefined;
  /** Form submission endpoint for a form node id. */
  formAction?: (formNodeId: string) => string;
  /** Marker for the success anchor after a form submission. */
  sentFormId?: string;
  /**
   * Geometry for a library icon id. The server passes the synchronous all-categories resolver; the editor passes
   * the lazily loaded cache. Unresolved icons render an empty, correctly sized placeholder (never a guess).
   */
  iconShape?: (iconId: string) => readonly IconNode[] | undefined;
}

interface Ctx {
  doc: SiteDocument;
  page: Page;
  opts: RenderOptions;
  link: LinkContext;
  css: string[];
  needsRuntime: boolean;
  editor: boolean;
  /** Set when the page inlines library icon artwork (adds the licence notice comment when publishing). */
  usesLibraryIcons: boolean;
}

export const RESERVED_CLASS_PREFIX = "b-";

/* ------------------------------------------------------------------------ */
/* Public API                                                                */
/* ------------------------------------------------------------------------ */

export interface RenderedPage {
  pageId: string;
  slug: string;
  path: string;
  html: string;
}

export function pagePath(baseHref: string, page: Page): string {
  return page.isHome ? baseHref : `${baseHref}${page.slug}/`;
}

export function renderPage(doc: SiteDocument, pageId: string, opts: RenderOptions): string {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`Page ${pageId} not found`);
  const ctx: Ctx = {
    doc,
    page,
    opts,
    link: { doc, baseHref: opts.baseHref, assetUrl: opts.assetUrl },
    css: [],
    needsRuntime: false,
    usesLibraryIcons: false,
    editor: opts.mode === "editor",
  };
  const header = doc.header ? renderNode(ctx, doc.header, null) : "";
  const sections = page.sections.map((s) => renderNode(ctx, s, null)).join("\n");
  const footer = doc.footer ? renderNode(ctx, doc.footer, null) : "";
  const body = `${header}\n<main id="b-main" class="b-main" tabindex="-1">\n${sections}\n</main>\n${footer}`;
  const css = baseCss(doc.theme) + themeCss(doc.theme) + ctx.css.join("\n");
  return documentShell(ctx, body, css);
}

export function renderAllPages(doc: SiteDocument, opts: RenderOptions): RenderedPage[] {
  return doc.pages.map((p) => ({ pageId: p.id, slug: p.slug, path: pagePath(opts.baseHref, p), html: renderPage(doc, p.id, opts) }));
}

/* ------------------------------------------------------------------------ */
/* Document shell                                                            */
/* ------------------------------------------------------------------------ */

function fontsLink(theme: Theme): string {
  const families = Array.from(new Set([theme.fonts.heading, theme.fonts.body])).filter((f) => !f.startsWith("System") && f !== "Georgia" && f !== "Monospace");
  if (!families.length) return "";
  const q = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap">`;
}

function documentShell(ctx: Ctx, body: string, css: string): string {
  const { doc, page, opts } = ctx;
  const title = page.seo.title || (page.isHome ? doc.name : `${page.name} — ${doc.name}`);
  const description = page.seo.description || doc.settings.defaultSeoDescription || "";
  const social = sanitizeMediaSrc(page.seo.socialImage || doc.settings.socialImage || "");
  const canonical = sanitizeUrl(page.seo.canonicalUrl ?? "", { allowRelative: false });
  const favicon = sanitizeMediaSrc(doc.settings.faviconAssetUrl ?? "");
  const head: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
  ];
  if (description) head.push(`<meta name="description" content="${esc(description)}">`);
  if (page.seo.noIndex || opts.mode !== "publish") head.push(`<meta name="robots" content="noindex, nofollow">`);
  if (canonical) head.push(`<link rel="canonical" href="${esc(canonical)}">`);
  head.push(`<meta property="og:title" content="${esc(title)}">`);
  if (description) head.push(`<meta property="og:description" content="${esc(description)}">`);
  if (social) head.push(`<meta property="og:image" content="${esc(social)}">`, `<meta name="twitter:card" content="summary_large_image">`);
  head.push(`<meta property="og:type" content="website">`);
  if (favicon) head.push(`<link rel="icon" href="${esc(favicon)}">`);
  head.push(`<meta name="generator" content="BINHI">`);
  if (opts.publicationId) head.push(`<meta name="binhi-publication" content="${esc(opts.publicationId)}">`);
  head.push(`<style>${css}</style>`);
  const iconNotice = ctx.usesLibraryIcons && opts.mode === "publish" ? `<!-- Icon artwork: Lucide (ISC) © Lucide Icons and Contributors; some glyphs from Feather (MIT) © Cole Bemis. Notices: /third-party-notices.txt -->\n` : "";
  const runtime = ctx.needsRuntime && opts.runtimeHref && !ctx.editor ? `<script src="${esc(opts.runtimeHref)}" defer></script>` : "";
  const skip = `<a class="b-skip" href="#b-main">Skip to content</a>`;
  // Web fonts load at the end of the body so a slow font CDN never blanks the
  // page (or the editor canvas); text paints with the fallback first.
  const fonts = fontsLink(doc.theme);
  return `<!doctype html>\n<html lang="${esc(doc.settings.language)}"${ctx.editor ? ' data-binhi-editor="1"' : ""}>\n<head>\n${head.join("\n")}\n</head>\n<body class="b-body">\n${iconNotice}${skip}\n${body}\n${fonts}\n${runtime}\n</body>\n</html>`;
}

/* ------------------------------------------------------------------------ */
/* Theme + base CSS                                                          */
/* ------------------------------------------------------------------------ */

function themeCss(theme: Theme): string {
  const vars = Object.entries(theme.colors).map(([k, v]) => `--b-${k}:${v}`);
  vars.push(`--b-font-heading:${fontStack(theme.fonts.heading)}`, `--b-font-body:${fontStack(theme.fonts.body)}`);
  vars.push(`--b-content-width:${theme.spacing.contentWidth}px`, `--b-radius-sm:${theme.radii.sm}px`, `--b-radius-md:${theme.radii.md}px`, `--b-radius-lg:${theme.radii.lg}px`);
  const out: string[] = [`:root{${vars.join(";")}}`];
  // Text styles
  for (const [key, ts] of Object.entries(theme.textStyles)) {
    out.push(`.b-ts-${key}{${textStyleDecls(ts, theme).join(";")}}`);
    if (ts.mobileFontSize) out.push(`${mediaQuery("mobile")}{.b-ts-${key}{font-size:${ts.mobileFontSize}px}}`);
  }
  // Buttons
  for (const [variant, b] of Object.entries(theme.buttons)) {
    const sh = b.shadow === "none" ? "none" : theme.shadows[b.shadow];
    out.push(`.b-btn-${variant}{background:${b.background};color:${b.color};border:${b.borderWidth}px solid ${b.borderColor ?? "transparent"};border-radius:${b.radius}px;padding:${b.paddingY}px ${b.paddingX}px;box-shadow:${sh}}`);
    out.push(`.b-btn-${variant}:hover{background:${b.hoverBackground ?? b.background};color:${b.hoverColor ?? b.color}}`);
  }
  out.push(`.b-rich a,.b-text a{color:${theme.links.color};text-decoration:${theme.links.underline ? "underline" : "none"}}.b-rich a:hover,.b-text a:hover{color:${theme.links.hoverColor}}`);
  return out.join("\n") + "\n";
}

function baseCss(theme: Theme): string {
  return [
    `*,*::before,*::after{box-sizing:border-box}`,
    `html{-webkit-text-size-adjust:100%}`,
    `body.b-body{margin:0;background:var(--b-background);color:var(--b-text);font-family:var(--b-font-body);line-height:1.5;overflow-x:hidden}`,
    `img,video,svg{max-width:100%;display:block}`,
    `h1,h2,h3,h4,p{margin:0;overflow-wrap:anywhere}`,
    `a{color:inherit}`,
    `button,input,select,textarea{font:inherit}`,
    `:focus-visible{outline:3px solid var(--b-primary);outline-offset:2px}`,
    `.b-skip{position:absolute;left:-9999px;top:8px;background:var(--b-primary);color:#fff;padding:8px 12px;border-radius:6px;z-index:10000}.b-skip:focus{left:8px}`,
    `.b-section{position:relative;width:100%}`,
    `.b-inner{width:100%;max-width:var(--b-content-width);margin-left:auto;margin-right:auto;min-width:0}`,
    `.b-full>.b-inner{max-width:none}`,
    `.b-free{position:relative;width:100%;container-type:inline-size}`,
    `.b-free>*{position:absolute;margin:0}`,
    `.b-free>.b-text,.b-free>.b-heading{display:flex;flex-direction:column;justify-content:flex-start}`,
    `.b-stack-mobile{}`,
    `${mediaQuery("mobile")}{.b-free.b-stack-mobile{aspect-ratio:auto!important;display:flex;flex-direction:column;gap:16px;height:auto!important}.b-free.b-stack-mobile>*{position:static!important;width:100%!important;height:auto!important;transform:none!important}}`,
    `.b-heading,.b-text{min-width:0}`,
    `.b-text{white-space:normal}`,
    `.b-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;cursor:pointer;transition:background .15s,color .15s,transform .15s,box-shadow .15s;border:0;line-height:1.2}`,
    `.b-btn-full{width:100%}`,
    `.b-btn[aria-disabled="true"]{opacity:.55;pointer-events:none}`,
    `.b-img{display:block;width:100%;height:100%;object-fit:cover}`,
    `.b-imgwrap{position:relative;overflow:hidden;width:100%;line-height:0}`,
    `.b-imgwrap.b-crop{aspect-ratio:var(--b-crop-ar)}`,
    `.b-imgwrap.b-crop>img{position:absolute;max-width:none;object-fit:fill}`,
    `.b-img-caption{font-size:.875em;color:var(--b-muted);margin-top:8px;line-height:1.4}`,
    `.b-divider{border:0;margin:0;width:100%}`,
    `.b-gallery{display:grid;width:100%}.b-gallery img{width:100%;height:100%;object-fit:cover}.b-gallery-item{overflow:hidden;line-height:0}`,
    `.b-video{position:relative;width:100%}.b-video iframe,.b-video video{position:absolute;inset:0;width:100%;height:100%;border:0}`,
    `.b-map iframe{width:100%;height:100%;border:0;display:block}`,
    `.b-form{display:flex;flex-direction:column;gap:16px;width:100%}.b-field{display:flex;flex-direction:column;gap:6px}.b-field label{font-weight:600;font-size:.9375em}.b-field input,.b-field select,.b-field textarea{padding:12px 14px;border:1px solid var(--b-border);border-radius:${theme.radii.md}px;background:var(--b-surface);color:var(--b-text);width:100%}.b-field textarea{min-height:120px;resize:vertical}.b-field-check{flex-direction:row;align-items:center;gap:10px}.b-field-check input{width:auto}.b-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}`,
    `.b-form-success{display:none;padding:12px 16px;border-radius:${theme.radii.md}px;background:${withAlpha(theme.colors.primary ?? "#2f855a", 0.12)};color:var(--b-text)}.b-form-success:target{display:block}`,
    `.b-social{display:flex;align-items:center;flex-wrap:wrap}.b-social a{display:inline-flex;align-items:center;justify-content:center;color:inherit;transition:opacity .15s}.b-social a:hover{opacity:.7}.b-social-circle a,.b-social-square a{padding:8px;border:1px solid currentColor}.b-social-circle a{border-radius:999px}.b-social-square a{border-radius:6px}`,
    `.b-nav{display:flex;align-items:center;gap:24px;width:100%;flex-wrap:wrap}.b-nav-logo{display:inline-flex;align-items:center;gap:10px;font-weight:700;text-decoration:none;color:inherit;font-size:1.25em}.b-nav-logo img{height:40px;width:auto}.b-nav-links{display:flex;align-items:center;gap:24px;list-style:none;margin:0;padding:0;flex-wrap:wrap}.b-nav-links a{text-decoration:none;color:inherit;opacity:.85}.b-nav-links a:hover,.b-nav-links a[aria-current="page"]{opacity:1;text-decoration:underline;text-underline-offset:4px}.b-nav-toggle{display:none}.b-nav-burger{display:none;margin-left:auto;background:none;border:0;color:inherit;cursor:pointer;padding:8px}.b-nav-sub{list-style:none;margin:6px 0 0 14px;padding:0;display:flex;flex-direction:column;gap:8px}.b-nav-group{position:relative}`,
    `${mediaQuery("mobile")}{.b-nav.b-nav-hamburger .b-nav-burger{display:inline-flex}.b-nav.b-nav-hamburger .b-nav-links{display:none;flex-direction:column;align-items:flex-start;width:100%;padding-top:12px}.b-nav.b-nav-hamburger .b-nav-toggle:checked~.b-nav-links{display:flex}.b-nav.b-nav-hamburger .b-nav-cta{width:100%}}`,
    `.b-sticky{position:sticky;top:0;z-index:50}`,
    `.b-footer-nav{display:flex;gap:16px;flex-wrap:wrap;list-style:none;margin:0;padding:0}.b-footer-nav a{color:inherit}`,
    `.b-contact{display:flex;flex-direction:column;gap:8px}.b-contact a{color:inherit}.b-contact-row{display:flex;gap:10px;align-items:flex-start}`,
    `.b-shape{display:block}.b-shape-circle{border-radius:50%}.b-shape-triangle{clip-path:polygon(50% 0,100% 100%,0 100%)}.b-shape-blob{border-radius:42% 58% 63% 37%/55% 42% 58% 45%}.b-shape-line{height:2px!important}`,
    `.b-rich ul,.b-rich ol{margin:0 0 0 1.25em;padding:0}.b-rich>*+*{margin-top:.75em}.b-rich blockquote{margin:0;padding-left:1em;border-left:3px solid var(--b-primary)}.b-rich code{font-family:ui-monospace,monospace;background:${withAlpha(theme.colors.text ?? "#000", 0.08)};padding:.1em .3em;border-radius:4px}`,
    `.b-anim{opacity:0}.b-anim.b-in,html[data-binhi-editor] .b-anim,.b-anim.b-anim-load{opacity:1;animation:var(--b-anim-name) var(--b-dur,400ms) var(--b-ease,ease-out) var(--b-delay,0ms) both}`,
    `@keyframes b-fade{from{opacity:0}to{opacity:1}}@keyframes b-slide-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes b-slide-left{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}@keyframes b-zoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}`,
    `.b-hov-lift{transition:transform .2s,box-shadow .2s}.b-hov-lift:hover{transform:translateY(-4px)}.b-hov-grow{transition:transform .2s}.b-hov-grow:hover{transform:scale(1.03)}.b-hov-shrink{transition:transform .2s}.b-hov-shrink:hover{transform:scale(.97)}.b-hov-fade{transition:opacity .2s}.b-hov-fade:hover{opacity:.8}`,
    `@media (prefers-reduced-motion:reduce){.b-anim{opacity:1!important;animation:none!important}.b-hov-lift:hover,.b-hov-grow:hover,.b-hov-shrink:hover{transform:none}*{scroll-behavior:auto!important}}`,
    `html{scroll-behavior:smooth}`,
    `.b-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`,
    `html[data-binhi-editor] .b-form,html[data-binhi-editor] .b-nav-burger{pointer-events:none}`,
    `html[data-binhi-editor] [data-b-hidden="1"]{display:none!important}`,
    `html[data-binhi-editor] .b-empty{min-height:80px;outline:1px dashed rgba(120,120,120,.5);outline-offset:-1px}`,
    `html[data-binhi-editor] [contenteditable="true"]{outline:none;cursor:text}`,
  ].join("\n") + "\n";
}

/* ------------------------------------------------------------------------ */
/* Node rendering                                                            */
/* ------------------------------------------------------------------------ */

function nodeCss(ctx: Ctx, node: Node, parent: Node | null) {
  const theme = ctx.doc.theme;
  const sel = `.${cls(node.id)}`;
  const isSection = node.type === "section";
  const own = (s: StyleSet) => styleDecls(s, theme, isSection ? (k) => !isLayoutKey(k) : undefined);
  const inner = (s: StyleSet) => (isSection ? styleDecls(s, theme, (k) => isLayoutKey(k)) : []);
  const push = (selector: string, decls: string[], query?: string) => {
    if (!decls.length) return;
    const rule = `${selector}{${decls.join(";")}}`;
    ctx.css.push(query ? `${query}{${rule}}` : rule);
  };

  const desktop = own(node.style);
  const free = parent?.layout?.mode === "free" && node.placement;
  if (free) desktop.push(...placementDecls(node.placement!.desktop, parent!.layout!));
  if (node.interactions && node.interactions.entrance !== "none") {
    desktop.push(`--b-anim-name:b-${node.interactions.entrance}`, `--b-dur:${node.interactions.durationMs}ms`, `--b-delay:${node.interactions.delayMs}ms`, `--b-ease:${node.interactions.easing}`);
  }
  if (node.type === "section" && node.props.minHeight) desktop.push(`min-height:${Number(node.props.minHeight)}px`);
  if (node.type === "spacer") desktop.push(`height:${Number(node.props.size ?? 40)}px`, "width:100%");
  if (node.type === "icon") desktop.push(`width:${Number(node.props.size)}px`, `height:${Number(node.props.size)}px`, "display:inline-flex");
  if (node.type === "divider") desktop.push(`border-top:${Number(node.props.thickness ?? 1)}px ${String(node.props.lineStyle ?? "solid")} currentColor`);
  if (node.type === "columns") desktop.push(`grid-template-columns:repeat(${Number(node.props.count ?? 2)},minmax(0,1fr))`);
  if (node.layout?.mode === "free" && node.children) {
    const l = node.layout;
    const target = isSection ? `${sel}>.b-inner` : sel;
    push(target, [`aspect-ratio:${l.designWidth} / ${l.designHeight}`, "position:relative", "min-height:0"]);
  }
  push(sel, desktop);
  push(`${sel}>.b-inner`, inner(node.style));
  if (node.layout?.contentWidth && isSection) push(`${sel}>.b-inner`, [`max-width:${node.layout.contentWidth}px`]);

  const hover = hoverDecls(node.style, theme);
  push(`${sel}:hover`, hover);

  for (const bp of ["tablet", "mobile"] as const) {
    const r = node.responsive?.[bp];
    const decls: string[] = r ? own(r) : [];
    const innerDecls: string[] = r ? inner(r) : [];
    if (free) {
      const p = node.placement![bp];
      if (p) decls.push(...placementDecls(p, parent!.layout!));
    }
    if (r?.hover) push(`${sel}:hover`, hoverDecls(r, theme), mediaQuery(bp));
    push(sel, decls, mediaQuery(bp));
    push(`${sel}>.b-inner`, innerDecls, mediaQuery(bp));
  }
  if (node.type === "columns") {
    const stackBelow = String(node.props.stackBelow ?? "mobile");
    if (stackBelow === "tablet") push(sel, ["grid-template-columns:minmax(0,1fr)"], mediaQuery("tablet"));
    else if (stackBelow === "mobile") push(sel, ["grid-template-columns:minmax(0,1fr)"], mediaQuery("mobile"));
  }
  if (!node.visibility.desktop) push(sel, ["display:none!important"], DESKTOP_ONLY_QUERY);
  if (!node.visibility.tablet) push(sel, ["display:none!important"], `@media (min-width:${BREAKPOINT_MAX.mobile + 1}px) and (max-width:${BREAKPOINT_MAX.tablet}px)`);
  if (!node.visibility.mobile) push(sel, ["display:none!important"], mediaQuery("mobile"));
  if (!ctx.editor && node.hidden) push(sel, ["display:none!important"]);
}

function placementDecls(p: Placement, layout: NonNullable<Node["layout"]>): string[] {
  const W = layout.designWidth, H = layout.designHeight;
  const pct = (v: number, base: number) => `${((v / base) * 100).toFixed(4)}%`;
  const out = [`left:${pct(p.x, W)}`, `top:${pct(p.y, H)}`, `width:${pct(p.width, W)}`, `height:${pct(p.height, H)}`, `z-index:${p.z}`];
  if (p.rotation) out.push(`transform:rotate(${p.rotation}deg)`, "transform-origin:center");
  return out;
}

function commonAttrs(ctx: Ctx, node: Node, extraClasses: string[] = []): string {
  const classes = [cls(node.id), ...extraClasses];
  const d = getDefinition(node.type);
  if (node.textStyle && d.inlineText) classes.push(`b-ts-${node.textStyle}`);
  if (node.interactions && node.interactions.entrance !== "none") {
    classes.push("b-anim");
    if (node.interactions.trigger === "load") classes.push("b-anim-load");
    else ctx.needsRuntime = true;
  }
  if (node.interactions && node.interactions.hover !== "none") classes.push(`b-hov-${node.interactions.hover}`);
  let s = ` class="${classes.join(" ")}"`;
  if (node.anchorId) s += ` id="${esc(node.anchorId)}"`;
  if (node.a11y?.label && !["image", "button", "icon"].includes(node.type)) s += ` aria-label="${esc(node.a11y.label)}"`;
  if (node.a11y?.role) s += ` role="${node.a11y.role}"`;
  if (ctx.editor) {
    s += ` data-b-id="${esc(node.id)}" data-b-type="${node.type}"`;
    if (d.container) s += ` data-b-container="${node.layout?.mode ?? "flow"}"`;
    if (node.locked) s += ` data-b-locked="1"`;
    if (node.hidden) s += ` data-b-hidden="1"`;
    if (d.inlineText) s += ` data-b-text="${d.inlineText}"`;
  }
  return s;
}

function children(ctx: Ctx, node: Node): string {
  if (!node.children) return "";
  let kids = node.children;
  if (node.layout?.mode === "free") kids = [...kids].sort((a, b) => (a.placement?.desktop.y ?? 0) - (b.placement?.desktop.y ?? 0));
  return kids.map((c) => renderNode(ctx, c, node)).join("\n");
}

export function renderNode(ctx: Ctx, node: Node, parent: Node | null): string {
  if (!ctx.editor && node.hidden) return "";
  nodeCss(ctx, node, parent);
  const freeClass = node.layout?.mode === "free" ? ["b-free", ...(node.layout.stackOnMobile ? ["b-stack-mobile"] : [])] : [];
  const emptyClass = ctx.editor && node.children && node.children.length === 0 ? ["b-empty"] : [];
  switch (node.type) {
    case "section": {
      const full = node.props.fullBleed ? ["b-full"] : [];
      const tag = node.a11y?.role === "banner" ? "header" : node.a11y?.role === "contentinfo" ? "footer" : "section";
      return `<${tag}${commonAttrs(ctx, node, ["b-section", ...full])}><div class="b-inner ${freeClass.join(" ")} ${emptyClass.join(" ")}">${children(ctx, node)}</div></${tag}>`;
    }
    case "container":
    case "stack":
    case "card":
    case "hero":
    case "columns":
    case "group":
      return `<div${commonAttrs(ctx, node, [`b-${node.type}`, ...freeClass, ...emptyClass])}>${children(ctx, node)}</div>`;
    case "heading": {
      const level = Math.min(4, Math.max(1, Number(node.props.level ?? 2)));
      return `<h${level}${commonAttrs(ctx, node, ["b-heading"])}>${escMultiline(node.props.text)}</h${level}>`;
    }
    case "paragraph":
      return `<p${commonAttrs(ctx, node, ["b-text"])}>${escMultiline(node.props.text)}</p>`;
    case "richText":
      return `<div${commonAttrs(ctx, node, ["b-rich", "b-text"])}>${renderRich(ctx, (node.props.blocks as RichText) ?? [])}</div>`;
    case "image":
      return renderImage(ctx, node);
    case "button":
      return renderButton(ctx, node);
    case "icon":
      return renderIcon(ctx, node);
    case "shape":
      return `<div${commonAttrs(ctx, node, ["b-shape", `b-shape-${String(node.props.kind)}`])} aria-hidden="true"></div>`;
    case "divider":
      return `<hr${commonAttrs(ctx, node, ["b-divider"])}>`;
    case "spacer":
      return `<div${commonAttrs(ctx, node, ["b-spacer"])} aria-hidden="true"></div>`;
    case "gallery":
      return renderGallery(ctx, node);
    case "video":
      return renderVideo(ctx, node);
    case "map":
      return renderMap(ctx, node);
    case "form":
      return renderForm(ctx, node);
    case "socialLinks":
      return renderSocial(ctx, node);
    case "navigation":
      return renderNavigation(ctx, node);
    case "footer":
      return renderFooter(ctx, node);
    case "contact":
      return renderContact(ctx, node);
  }
}

/* ---- text ---- */

function renderRich(ctx: Ctx, blocks: RichText): string {
  const out: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (const b of blocks) {
    const inner = b.runs.map((r) => renderRun(ctx, r)).join("");
    if (b.type === "bullet" || b.type === "numbered") {
      const tag = b.type === "bullet" ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flush();
        list = { tag, items: [] };
      }
      list.items.push(inner);
      continue;
    }
    flush();
    const tag = b.type === "paragraph" ? "p" : b.type === "quote" ? "blockquote" : b.type;
    out.push(`<${tag}>${inner || "<br>"}</${tag}>`);
  }
  flush();
  return out.join("");
}

function renderRun(ctx: Ctx, r: RichText[number]["runs"][number]): string {
  let s = escMultiline(r.text);
  if (r.code) s = `<code>${s}</code>`;
  if (r.bold) s = `<strong>${s}</strong>`;
  if (r.italic) s = `<em>${s}</em>`;
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `<s>${s}</s>`;
  if (r.color) s = `<span style="color:${esc(r.color)}">${s}</span>`;
  const link = resolveLink(ctx.link, r.link);
  if (link) s = `<a${linkAttrs(link)}>${s}</a>`;
  return s;
}

/* ---- image ---- */

function imageTag(ctx: Ctx, p: Record<string, unknown>, extraClass = "b-img", lazyDefault = true): string {
  const src = sanitizeMediaSrc(String(p.src ?? ""));
  const decorative = Boolean(p.decorative);
  const alt = decorative ? "" : esc(p.alt ?? "");
  const style: string[] = [];
  const focalX = Number(p.focalX ?? 50), focalY = Number(p.focalY ?? 50);
  if (focalX !== 50 || focalY !== 50) style.push(`object-position:${focalX}% ${focalY}%`);
  const flips: string[] = [];
  if (p.flipX) flips.push("scaleX(-1)");
  if (p.flipY) flips.push("scaleY(-1)");
  const crop = p.crop as { x: number; y: number; w: number; h: number } | undefined;
  if (crop) {
    style.push(`left:${(-crop.x / crop.w) * 100}%`, `top:${(-crop.y / crop.h) * 100}%`, `width:${(100 / crop.w) * 100}%`, `height:${(100 / crop.h) * 100}%`);
  }
  if (flips.length) style.push(`transform:${flips.join(" ")}`);
  if (!src) {
    return `<div class="${extraClass} b-img-placeholder" role="img" aria-label="${alt || "Image placeholder"}" style="display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#e8e8e8 0 10px,#f4f4f4 10px 20px);color:#777;font-size:14px;min-height:120px;width:100%;height:100%">Choose an image</div>`;
  }
  const lazy = (p.lazy ?? lazyDefault) ? ` loading="lazy" decoding="async"` : "";
  const dims = p.naturalWidth && p.naturalHeight ? ` width="${Number(p.naturalWidth)}" height="${Number(p.naturalHeight)}"` : "";
  return `<img class="${extraClass}" src="${esc(src)}" alt="${alt}"${decorative ? ' role="presentation"' : ""}${lazy}${dims}${style.length ? ` style="${style.join(";")}"` : ""}>`;
}

function renderImage(ctx: Ctx, node: Node): string {
  const p = node.props;
  const crop = p.crop as { w: number; h: number } | undefined;
  const nw = Number(p.naturalWidth ?? 4), nh = Number(p.naturalHeight ?? 3);
  const wrapStyle = crop ? ` style="--b-crop-ar:${((nw * crop.w) / 100).toFixed(2)} / ${((nh * crop.h) / 100).toFixed(2)}"` : "";
  const img = imageTag(ctx, p);
  const caption = p.caption ? `<figcaption class="b-img-caption">${esc(p.caption)}</figcaption>` : "";
  const link = resolveLink(ctx.link, p.link as never);
  const body = link ? `<a${linkAttrs(link)} style="display:block;line-height:0">${img}</a>` : img;
  const wrap = `<div class="b-imgwrap${crop ? " b-crop" : ""}"${wrapStyle}>${body}</div>`;
  return caption
    ? `<figure${commonAttrs(ctx, node, ["b-figure"])} style="margin:0">${wrap}${caption}</figure>`
    : `<div${commonAttrs(ctx, node, ["b-figure"])}>${wrap}</div>`;
}

/* ---- button ---- */

const BUTTON_ICONS: Record<string, string> = {
  "arrow-right": ICON_PATHS["arrow-right"]!,
  "arrow-down": ICON_PATHS["arrow-down"]!,
  mail: ICON_PATHS.mail!,
  phone: ICON_PATHS.phone!,
  download: ICON_PATHS.download!,
  external: ICON_PATHS.external!,
};

function renderIcon(ctx: Ctx, node: Node): string {
  const p = node.props;
  const link = resolveLink(ctx.link, p.link as never);
  const size = Number(p.size ?? 32);
  const iconId = typeof p.icon === "string" && hasIcon(p.icon) ? p.icon : undefined;
  let svg: string;
  if (iconId) {
    const def = getIcon(iconId)!;
    if (def.source.kind === "lucide") ctx.usesLibraryIcons = true;
    const shape = ctx.opts.iconShape?.(iconId);
    if (!shape && ctx.opts.mode === "publish") throw new Error(`Icon ${iconId} could not be resolved for publishing`);
    // A linked icon must have an accessible name; an explicitly decorative, unlinked icon never does.
    const decorative = node.a11y?.decorative === true && !link;
    const label = decorative ? undefined : node.a11y?.label || (link ? def.name : undefined);
    svg = shape
      ? renderIconSvg(shape, {
          variant: (p.variant as IconVariant | undefined) ?? "outline",
          size,
          strokeWidth: typeof p.strokeWidth === "number" ? p.strokeWidth : undefined,
          rotation: typeof p.rotation === "number" ? p.rotation : undefined,
          flipX: p.flipX === true,
          flipY: p.flipY === true,
          gradient: p.gradient as never,
          label,
          idPrefix: `i-${node.id}`,
        })
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" data-icon-pending="${esc(iconId)}"></svg>`;
  } else {
    const path = ICON_PATHS[String(p.name)] ?? ICON_PATHS.star!;
    svg = iconSvg(path, size, node.a11y?.label);
  }
  const attrs = commonAttrs(ctx, node, ["b-icon"]);
  const asset = iconId ? ` data-icon="${esc(iconId)}"` : "";
  if (link) return `<a${attrs}${asset}${linkAttrs(link)}>${svg}</a>`;
  return `<span${attrs}${asset}>${svg}</span>`;
}

function renderButton(ctx: Ctx, node: Node): string {
  const p = node.props;
  const variant = String(p.variant ?? "primary");
  const classes = ["b-btn", variant === "custom" ? "b-btn-custom" : `b-btn-${variant}`, ...(p.fullWidth ? ["b-btn-full"] : [])];
  const icon = BUTTON_ICONS[String(p.icon)] ? iconSvg(BUTTON_ICONS[String(p.icon)]!, 18) : "";
  const label = `<span class="b-btn-label">${escMultiline(p.label)}</span>`;
  const inner = p.iconPosition === "left" ? `${icon}${label}` : `${label}${icon}`;
  const link = resolveLink(ctx.link, p.link as never);
  const aria = p.ariaLabel ? ` aria-label="${esc(p.ariaLabel)}"` : node.a11y?.label ? ` aria-label="${esc(node.a11y.label)}"` : "";
  const disabled = p.disabled ? ` aria-disabled="true" tabindex="-1"` : "";
  if (link && !p.disabled) return `<a${commonAttrs(ctx, node, classes)}${linkAttrs(link)}${aria}>${inner}</a>`;
  return `<a${commonAttrs(ctx, node, classes)} role="button"${aria}${disabled || ' aria-disabled="true"'} href="#" onclick="return false">${inner}</a>`.replace(' onclick="return false"', "");
}

/* ---- gallery / video / map ---- */

function renderGallery(ctx: Ctx, node: Node): string {
  const p = node.props as { images: Record<string, unknown>[]; columns: number; gap: number; aspect: string };
  const ar = p.aspect === "square" ? "1 / 1" : p.aspect === "landscape" ? "4 / 3" : p.aspect === "portrait" ? "3 / 4" : "auto";
  const style = `grid-template-columns:repeat(${p.columns},minmax(0,1fr));gap:${p.gap}px`;
  ctx.css.push(`${mediaQuery("tablet")}{.${cls(node.id)}{grid-template-columns:repeat(${Math.min(p.columns, 2)},minmax(0,1fr))!important}}`);
  ctx.css.push(`${mediaQuery("mobile")}{.${cls(node.id)}{grid-template-columns:repeat(${Math.min(p.columns, 2)},minmax(0,1fr))!important}}`);
  const items = (p.images ?? []).map((img) => `<div class="b-gallery-item" style="aspect-ratio:${ar}">${imageTag(ctx, img)}</div>`).join("");
  const empty = !p.images?.length && ctx.editor ? `<div class="b-gallery-item" style="aspect-ratio:${ar}">${imageTag(ctx, {})}</div>`.repeat(Math.min(3, p.columns)) : "";
  return `<div${commonAttrs(ctx, node, ["b-gallery"])} style="${style}">${items}${empty}</div>`;
}

function renderVideo(ctx: Ctx, node: Node): string {
  const p = node.props as { provider: string; videoId: string; src: string; title: string; autoplay: boolean; loop: boolean; muted: boolean; controls: boolean };
  const title = esc(p.title || "Video");
  let inner = "";
  const qs = (base: Record<string, string>) =>
    Object.entries(base)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  if (p.provider === "youtube" && /^[A-Za-z0-9_-]{6,20}$/.test(p.videoId)) {
    const q = qs({ rel: "0", autoplay: p.autoplay ? "1" : "0", mute: p.muted || p.autoplay ? "1" : "0", loop: p.loop ? "1" : "0", controls: p.controls ? "1" : "0", playlist: p.loop ? p.videoId : "" });
    inner = `<iframe src="https://www.youtube-nocookie.com/embed/${p.videoId}?${q}" title="${title}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>`;
  } else if (p.provider === "vimeo" && /^\d{4,15}$/.test(p.videoId)) {
    const q = qs({ autoplay: p.autoplay ? "1" : "0", muted: p.muted || p.autoplay ? "1" : "0", loop: p.loop ? "1" : "0", dnt: "1" });
    inner = `<iframe src="https://player.vimeo.com/video/${p.videoId}?${q}" title="${title}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>`;
  } else if (p.provider === "file") {
    const src = sanitizeMediaSrc(p.src);
    if (src) inner = `<video src="${esc(src)}" title="${title}"${p.controls ? " controls" : ""}${p.autoplay ? " autoplay" : ""}${p.loop ? " loop" : ""}${p.muted || p.autoplay ? " muted" : ""} playsinline preload="metadata"></video>`;
  }
  if (!inner) inner = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#111;color:#ccc;font-size:14px">${ctx.editor ? "Add a video link in the panel" : ""}</div>`;
  return `<div${commonAttrs(ctx, node, ["b-video"])}>${inner}</div>`;
}

function renderMap(ctx: Ctx, node: Node): string {
  const p = node.props as { address: string; zoom: number; title: string };
  const addr = p.address.trim();
  const inner = addr
    ? `<iframe src="https://www.google.com/maps?q=${encodeURIComponent(addr)}&z=${Number(p.zoom)}&output=embed" title="${esc(p.title || "Map")}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#e9eef2;color:#556;font-size:14px">${ctx.editor ? "Enter an address in the panel" : ""}</div>`;
  return `<div${commonAttrs(ctx, node, ["b-map"])}>${inner}</div>`;
}

/* ---- form ---- */

function renderForm(ctx: Ctx, node: Node): string {
  const p = node.props as { title: string; fields: { id: string; type: string; label: string; placeholder?: string; required: boolean; options?: string[] }[]; submitLabel: string; successMessage: string; buttonVariant: string };
  const action = ctx.opts.formAction?.(node.id) ?? "";
  const fields = p.fields
    .map((f) => {
      const fid = `f-${esc(f.id)}`;
      const name = esc(f.id);
      const req = f.required ? " required" : "";
      const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
      const label = `<label for="${fid}">${esc(f.label)}${f.required ? ' <span aria-hidden="true">*</span>' : ""}</label>`;
      switch (f.type) {
        case "textarea":
          return `<div class="b-field">${label}<textarea id="${fid}" name="${name}"${ph}${req} maxlength="5000"></textarea></div>`;
        case "select":
          return `<div class="b-field">${label}<select id="${fid}" name="${name}"${req}><option value="">Choose…</option>${(f.options ?? []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></div>`;
        case "checkbox":
          return `<div class="b-field b-field-check"><input type="checkbox" id="${fid}" name="${name}" value="yes"${req}><label for="${fid}">${esc(f.label)}</label></div>`;
        default: {
          const type = f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text";
          return `<div class="b-field">${label}<input type="${type}" id="${fid}" name="${name}"${ph}${req} maxlength="500"></div>`;
        }
      }
    })
    .join("");
  const title = p.title ? `<h3 class="b-ts-heading3">${esc(p.title)}</h3>` : "";
  const success = `<p id="${esc(node.id)}-sent" class="b-form-success" role="status">${esc(p.successMessage)}</p>`;
  const variant = p.buttonVariant === "custom" ? "b-btn-primary" : `b-btn-${p.buttonVariant}`;
  const formAttrs = ctx.editor ? ` data-b-noop="1"` : ` method="post" action="${esc(action)}"`;
  return `<form${commonAttrs(ctx, node, ["b-form"])}${formAttrs} novalidate="">${title}${success}${fields}<div class="b-hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div><button type="submit" class="b-btn ${variant}">${esc(p.submitLabel)}</button></form>`;
}

/* ---- social / contact / footer / nav ---- */

function renderSocial(ctx: Ctx, node: Node): string {
  const p = node.props as { links: { network: string; url: string }[]; size: number; style: string };
  const items = p.links
    .map((l) => {
      const href = l.network === "email" ? sanitizeUrl(l.url.startsWith("mailto:") ? l.url : `mailto:${l.url}`) : sanitizeUrl(l.url);
      if (!href) return "";
      const path = SOCIAL_PATHS[l.network] ?? SOCIAL_PATHS.website!;
      const name = l.network === "x" ? "X" : l.network.charAt(0).toUpperCase() + l.network.slice(1);
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)}">${iconSvg(path, p.size)}</a>`;
    })
    .join("");
  return `<div${commonAttrs(ctx, node, ["b-social", `b-social-${p.style}`])}>${items}</div>`;
}

function renderContact(ctx: Ctx, node: Node): string {
  const p = node.props as { email: string; phone: string; address: string; hours: string };
  const rows: string[] = [];
  const row = (icon: string, body: string) => rows.push(`<div class="b-contact-row">${iconSvg(icon, 20)}<div>${body}</div></div>`);
  if (p.email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(p.email)) row(ICON_PATHS.mail!, `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`);
  if (p.phone) row(ICON_PATHS.phone!, `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>`);
  if (p.address) row(ICON_PATHS.pin!, escMultiline(p.address));
  if (p.hours) row(ICON_PATHS.clock!, escMultiline(p.hours));
  return `<address${commonAttrs(ctx, node, ["b-contact"])} style="font-style:normal">${rows.join("")}</address>`;
}

function navItems(ctx: Ctx): NavItem[] {
  const nav = ctx.doc.navigation;
  if (!nav.auto && nav.items.length) return nav.items;
  return ctx.doc.pages.filter((p) => !p.hiddenFromNav).map((p) => ({ id: p.id, label: p.name, target: { kind: "page" as const, pageId: p.id } }));
}

function navList(ctx: Ctx, items: NavItem[], depth = 0): string {
  const li = items
    .map((item) => {
      const link = resolveLink(ctx.link, item.target);
      const current = item.target.kind === "page" && item.target.pageId === ctx.page.id ? ' aria-current="page"' : "";
      const a = link ? `<a${linkAttrs(link)}${current}>${esc(item.label)}</a>` : `<span>${esc(item.label)}</span>`;
      const sub = item.children?.length && depth < 2 ? `<ul class="b-nav-sub">${navList(ctx, item.children, depth + 1)}</ul>` : "";
      return `<li class="${sub ? "b-nav-group" : ""}">${a}${sub}</li>`;
    })
    .join("");
  return li;
}

function renderNavigation(ctx: Ctx, node: Node): string {
  const p = node.props as { logoText: string; logoImage: string; logoLink: boolean; alignment: string; mobileMenu: string; cta?: { label: string; link: unknown; variant: string } };
  const home = ctx.doc.pages.find((pg) => pg.isHome);
  const homeHref = home ? resolveLink(ctx.link, { kind: "page", pageId: home.id }) : null;
  const logoSrc = sanitizeMediaSrc(p.logoImage);
  const logoInner = `${logoSrc ? `<img src="${esc(logoSrc)}" alt="${esc(p.logoText || ctx.doc.name)}">` : ""}${p.logoText && !logoSrc ? esc(p.logoText) : logoSrc ? "" : esc(ctx.doc.name)}`;
  const logo = p.logoLink && homeHref ? `<a class="b-nav-logo"${linkAttrs(homeHref)}>${logoInner}</a>` : `<span class="b-nav-logo">${logoInner}</span>`;
  const toggleId = `nav-${node.id}`;
  const burger = `<input type="checkbox" id="${toggleId}" class="b-nav-toggle" aria-hidden="true" tabindex="-1"><label for="${toggleId}" class="b-nav-burger" role="button" tabindex="0" aria-label="Open menu" aria-controls="${toggleId}-links">${iconSvg(ICON_PATHS.menu!, 26)}</label>`;
  const cta = p.cta ? (() => {
    const l = resolveLink(ctx.link, p.cta!.link as never);
    const v = p.cta!.variant === "custom" ? "primary" : p.cta!.variant;
    return l ? `<a class="b-btn b-btn-${v} b-nav-cta"${linkAttrs(l)}>${esc(p.cta!.label)}</a>` : "";
  })() : "";
  const justify = p.alignment === "space-between" ? "space-between" : p.alignment === "center" ? "center" : p.alignment === "right" ? "flex-end" : "flex-start";
  ctx.css.push(`.${cls(node.id)}{justify-content:${justify}}`);
  const links = `<ul id="${toggleId}-links" class="b-nav-links">${navList(ctx, navItems(ctx))}${cta ? `<li>${cta}</li>` : ""}</ul>`;
  const role = `role="navigation" aria-label="${esc(node.a11y?.label ?? "Main")}"`;
  return `<nav${commonAttrs(ctx, node, ["b-nav", p.mobileMenu === "hamburger" ? "b-nav-hamburger" : "b-nav-inline"])} ${role}>${logo}${p.mobileMenu === "hamburger" ? burger : ""}${links}</nav>`;
}

function renderFooter(ctx: Ctx, node: Node): string {
  const p = node.props as { text: string; showNavigation: boolean };
  const nav = p.showNavigation ? `<ul class="b-footer-nav" aria-label="Footer">${navList(ctx, navItems(ctx))}</ul>` : "";
  const text = p.text ? `<p class="b-footer-text">${escMultiline(p.text)}</p>` : "";
  return `<footer${commonAttrs(ctx, node, ["b-footer"])}><div class="b-inner" style="display:flex;flex-direction:column;gap:16px">${children(ctx, node)}${nav}${text}</div></footer>`;
}
