import { useMemo, useState, type ReactNode } from "react";
import { useStore, useSel } from "../context.js";
import { effectiveStyle, getDefinition, type Breakpoint, type Node, type Operation, type StyleSet, type Background, type Shadow, TEXT_STYLE_KEYS, type RichText, type LinkTarget, newId, BREAKPOINT_WIDTHS } from "../../../core/index.js";
import { ColorInput, Field, Group, LengthInput, NumberInput, SelectInput, SidesInput, Toggle, parseLength } from "./fields.js";
import { LinkEditor } from "./LinkEditor.js";
import { IconContentEditor } from "./IconProperties.js";
import { PageSettings } from "../panels/PagesPanel.js";
import { MediaPanel } from "../panels/MediaPanel.js";
import { Modal } from "../../components/Modal.js";
import { I } from "../../components/Icons.js";
import type { AssetRecord } from "../../api.js";
import { nodeLabel } from "../actions.js";

const GROUP_KEYWORDS: Record<string, string> = {
  General: "name visibility lock hide type",
  Content: "text label heading level image video map form fields social",
  Link: "link url page email phone anchor",
  Layout: "layout flex grid direction align justify wrap gap columns freeform content width height stack",
  "Position & size": "x y width height rotation layer z order min max aspect ratio fit",
  Spacing: "padding margin",
  Typography: "font size weight style line height letter spacing transform align color decoration shadow highlight text style",
  Fill: "background color gradient image overlay",
  Border: "border width style color radius corner",
  Effects: "opacity shadow blur brightness contrast saturate grayscale backdrop hover",
  Media: "image alt caption focal crop flip fit position lazy",
  Responsive: "desktop tablet mobile hide breakpoint override",
  Interactions: "animation entrance hover duration delay easing scroll",
  Accessibility: "label decorative role aria",
  Advanced: "id anchor",
};

export function PropertiesPanel() {
  const store = useStore();
  const selection = useSel((s) => s.selection);
  const doc = useSel((s) => s.document);
  const breakpoint = useSel((s) => s.breakpoint);
  const pageId = useSel((s) => s.pageId);
  const [q, setQ] = useState("");
  const found = selection.map((id) => store.node(id)).filter((f): f is NonNullable<typeof f> => !!f);
  const show = (title: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return title.toLowerCase().includes(needle) || (GROUP_KEYWORDS[title] ?? "").includes(needle);
  };
  void doc;

  if (found.length === 0) {
    const page = store.page;
    return (
      <>
        <header className="panel-head"><h2>Page</h2></header>
        <div className="panel-body">
          <p className="help" style={{ marginBottom: 10 }}>Select an element on the canvas to edit it. These are settings for “{page.name}”.</p>
          <PageSettings pageId={pageId} />
        </div>
      </>
    );
  }

  const multi = found.length > 1;
  const f = found[0]!;
  const node = f.node;
  const def = getDefinition(node.type);
  const style = effectiveStyle(node, breakpoint);
  const overridden = breakpoint !== "desktop" ? (node.responsive?.[breakpoint] ?? {}) : {};
  const bpBadge = breakpoint !== "desktop" ? <span className="bp-badge" title={`Editing ${breakpoint} overrides`}>{breakpoint}</span> : null;

  const forEachSelected = (make: (n: Node) => Operation | null) => {
    const ops = found.map((x) => make(x.node)).filter((o): o is Operation => !!o);
    if (ops.length) store.dispatch(ops);
  };
  const setStyle = (patch: StyleSet, unset?: string[]) => forEachSelected((n) => ({ type: "updateStyle", nodeId: n.id, breakpoint, style: patch, unset }));
  const setProps = (props: Record<string, unknown>) => store.dispatch([{ type: "updateProps", nodeId: node.id, props }]);
  const clearOverride = (keys: string[]) => breakpoint !== "desktop" && setStyle({}, keys);
  const groups = def.groups;
  const has = (g: string) => groups.includes(g as never);
  const isFree = f.parent?.layout?.mode === "free" && !!node.placement;
  const placement = isFree ? (breakpoint === "desktop" ? node.placement!.desktop : (node.placement![breakpoint] ?? (breakpoint === "mobile" ? node.placement!.tablet : undefined) ?? node.placement!.desktop)) : null;
  const setPlacement = (p: Record<string, number>) => store.dispatch([{ type: "updatePlacement", nodeId: node.id, breakpoint, placement: p }]);

  return (
    <>
      <header className="panel-head">
        <h2>{multi ? `${found.length} elements` : def.label}</h2>
        {bpBadge}
      </header>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="panel-search" style={{ margin: 10 }}><I.search /><input type="search" placeholder="Search properties" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search properties" /></div>
        {breakpoint !== "desktop" && <p className="help" style={{ margin: "0 12px 8px" }}>You're editing the {breakpoint} view ({BREAKPOINT_WIDTHS[breakpoint]}px). Style changes here only apply at this size and below.</p>}
        {multi && <p className="help" style={{ margin: "0 12px 8px" }}>Style and spacing changes apply to every selected element. Content is edited one at a time.</p>}

        {show("General") && (
          <Group title="General">
            {!multi && <Field label="Name" htmlFor="p-name"><input id="p-name" key={node.id + (node.name ?? "")} defaultValue={node.name ?? ""} placeholder={def.label} onBlur={(e) => e.target.value.trim() !== (node.name ?? "") && store.dispatch([{ type: "renameNode", nodeId: node.id, name: e.target.value.trim() || def.label }])} /></Field>}
            {!multi && <Field label="Type"><span className="muted small">{def.label}{node.reusableId ? " · saved section copy" : ""}</span></Field>}
            <div className="row gap" style={{ flexWrap: "wrap" }}>
              <Toggle checked={found.every((x) => x.node.locked)} onChange={(b) => forEachSelected((n) => ({ type: "setLocked", nodeId: n.id, locked: b }))} label="Locked" />
              <Toggle checked={found.every((x) => x.node.hidden)} onChange={(b) => forEachSelected((n) => ({ type: "setHidden", nodeId: n.id, hidden: b }))} label="Hidden" />
            </div>
            {!multi && f.parent && <button className="btn btn-sm" onClick={() => store.select([f.parent!.id])}>Select parent ({nodeLabel(f.parent)})</button>}
          </Group>
        )}

        {!multi && has("content") && show("Content") && (
          <Group title="Content"><ContentEditor node={node} setProps={setProps} style={style} setStyle={setStyle} /></Group>
        )}
        {!multi && has("link") && show("Link") && (
          <Group title="Link" defaultOpen={node.type === "button"}>
            <LinkEditor value={node.props.link as LinkTarget | undefined} onChange={(link) => setProps({ link })} />
          </Group>
        )}
        {!multi && has("layout") && def.container && show("Layout") && (
          <Group title="Layout" badge={overrideBadge(overridden, ["display", "flexDirection", "justifyContent", "alignItems", "flexWrap", "gap", "gridColumns"])}>
            <LayoutEditor node={node} style={style} setStyle={setStyle} breakpoint={breakpoint} />
          </Group>
        )}
        {has("position") && show("Position & size") && (
          <Group title="Position & size" badge={overrideBadge(overridden, ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "aspectRatio", "alignSelf", "flexGrow", "order"])}>
            {isFree && placement && !multi ? (
              <>
                <div className="row gap">
                  <Field label="X"><NumberInput value={Math.round(placement.x)} onChange={(x) => setPlacement({ x })} unit="px" /></Field>
                  <Field label="Y"><NumberInput value={Math.round(placement.y)} onChange={(y) => setPlacement({ y })} unit="px" /></Field>
                </div>
                <div className="row gap">
                  <Field label="Width"><NumberInput value={Math.round(placement.width)} min={1} onChange={(width) => setPlacement({ width })} unit="px" /></Field>
                  <Field label="Height"><NumberInput value={Math.round(placement.height)} min={1} onChange={(height) => setPlacement({ height })} unit="px" /></Field>
                </div>
                <div className="row gap">
                  <Field label="Rotation"><NumberInput value={placement.rotation} min={-360} max={360} onChange={(rotation) => setPlacement({ rotation })} unit="°" /></Field>
                  <Field label="Layer"><NumberInput value={placement.z} min={0} onChange={(z) => setPlacement({ z })} /></Field>
                </div>
                <p className="help">Positions are in design pixels of the parent canvas ({f.parent!.layout!.designWidth}×{f.parent!.layout!.designHeight}) and scale with the screen.</p>
                {breakpoint !== "desktop" && node.placement?.[breakpoint] && <button className="btn btn-sm" onClick={() => store.dispatch([{ type: "clearPlacementOverride", nodeId: node.id, breakpoint }])}>Reset {breakpoint} position to desktop</button>}
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={() => setPlacement({ width: f.parent!.layout!.designWidth, x: 0 })}>Fit width</button>
                  <button className="btn btn-sm" onClick={() => store.dispatch([{ type: "alignNodes", nodeIds: [node.id], alignment: "centerX", breakpoint }, { type: "alignNodes", nodeIds: [node.id], alignment: "centerY", breakpoint }])}>Centre in parent</button>
                </div>
              </>
            ) : (
              <>
                <Field label="Width"><LengthInput value={style.width} onChange={(width) => setStyle({ width })} onClear={() => setStyle({}, ["width"])} /></Field>
                <Field label="Height"><LengthInput value={style.height} onChange={(height) => setStyle({ height })} onClear={() => setStyle({}, ["height"])} /></Field>
                <Field label="Min width"><LengthInput value={style.minWidth} onChange={(minWidth) => setStyle({ minWidth })} onClear={() => setStyle({}, ["minWidth"])} allowAuto={false} /></Field>
                <Field label="Max width"><LengthInput value={style.maxWidth} onChange={(maxWidth) => setStyle({ maxWidth })} onClear={() => setStyle({}, ["maxWidth"])} allowAuto={false} /></Field>
                <Field label="Min height"><LengthInput value={style.minHeight} onChange={(minHeight) => setStyle({ minHeight })} onClear={() => setStyle({}, ["minHeight"])} allowAuto={false} /></Field>
                <Field label="Max height"><LengthInput value={style.maxHeight} onChange={(maxHeight) => setStyle({ maxHeight })} onClear={() => setStyle({}, ["maxHeight"])} allowAuto={false} /></Field>
                <Field label="Aspect ratio"><SelectInput value={style.aspectRatio ?? ""} options={[{ value: "", label: "Natural" }, { value: "1 / 1", label: "Square 1:1" }, { value: "4 / 3", label: "4:3" }, { value: "3 / 2", label: "3:2" }, { value: "16 / 9", label: "16:9" }, { value: "3 / 4", label: "Portrait 3:4" }, { value: "9 / 16", label: "Portrait 9:16" }]} onChange={(v) => (v ? setStyle({ aspectRatio: v }) : setStyle({}, ["aspectRatio"]))} /></Field>
                {f.parent && f.parent.style.display !== "grid" && (
                  <>
                    <Field label="Self align"><SelectInput value={style.alignSelf ?? "auto"} options={["auto", "flex-start", "center", "flex-end", "stretch"].map((v) => ({ value: v, label: v.replace("flex-", "") }))} onChange={(alignSelf) => setStyle({ alignSelf: alignSelf as StyleSet["alignSelf"] })} /></Field>
                    <Field label="Grow to fill"><Toggle checked={(style.flexGrow ?? 0) > 0} onChange={(b) => setStyle({ flexGrow: b ? 1 : 0 })} label="" /></Field>
                  </>
                )}
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={() => setStyle({ width: "100%" })}>Fill width</button>
                  <button className="btn btn-sm" onClick={() => setStyle({ width: "fit-content" })}>Fit content</button>
                  <button className="btn btn-sm" onClick={() => setStyle({}, ["width", "height"])}>Auto</button>
                </div>
              </>
            )}
          </Group>
        )}
        {has("spacing") && show("Spacing") && (
          <Group title="Spacing" defaultOpen={false} badge={overrideBadge(overridden, ["padding", "margin"])}>
            <SidesInput label="Padding" value={style.padding} onChange={(padding) => setStyle({ padding })} />
            {node.type !== "section" && <SidesInput label="Margin" value={style.margin} onChange={(margin) => setStyle({ margin })} />}
            {breakpoint !== "desktop" && <button className="btn btn-sm" onClick={() => clearOverride(["padding", "margin"])}>Use desktop spacing</button>}
          </Group>
        )}
        {has("typography") && show("Typography") && (
          <Group title="Typography" defaultOpen={!!def.inlineText} badge={overrideBadge(overridden, ["fontSize", "fontWeight", "color", "textAlign", "lineHeight"])}>
            <TypographyEditor node={node} style={style} setStyle={setStyle} multi={multi} />
          </Group>
        )}
        {has("fill") && show("Fill") && (
          <Group title="Fill" defaultOpen={node.type === "section" || node.type === "shape"} badge={overrideBadge(overridden, ["background"])}>
            <BackgroundEditor value={style.background} onChange={(background) => setStyle({ background })} onClear={() => setStyle({}, ["background"])} />
          </Group>
        )}
        {has("border") && show("Border") && (
          <Group title="Border" defaultOpen={false} badge={overrideBadge(overridden, ["border", "radius"])}>
            <BorderEditor style={style} setStyle={setStyle} />
          </Group>
        )}
        {has("effects") && show("Effects") && (
          <Group title="Effects" defaultOpen={false} badge={overrideBadge(overridden, ["opacity", "shadow", "filter", "hover"])}>
            <EffectsEditor style={style} setStyle={setStyle} />
          </Group>
        )}
        {!multi && has("media") && show("Media") && (
          <Group title="Media"><MediaEditor node={node} setProps={setProps} style={style} setStyle={setStyle} /></Group>
        )}
        {has("responsive") && show("Responsive") && (
          <Group title="Responsive" defaultOpen={false}>
            <p className="help">Show this element on:</p>
            <div className="row gap" style={{ flexWrap: "wrap" }}>
              {(["desktop", "tablet", "mobile"] as Breakpoint[]).map((bp) => (
                <Toggle key={bp} checked={found.every((x) => x.node.visibility[bp])} onChange={(b) => forEachSelected((n) => ({ type: "setVisibility", nodeId: n.id, visibility: { [bp]: b } }))} label={bp} />
              ))}
            </div>
            {!multi && (
              <>
                <p className="help" style={{ marginTop: 6 }}>Overrides: tablet {Object.keys(node.responsive?.tablet ?? {}).length}, mobile {Object.keys(node.responsive?.mobile ?? {}).length}{node.placement?.tablet || node.placement?.mobile ? ", plus position" : ""}.</p>
                {breakpoint !== "desktop" && Object.keys(overridden).length > 0 && <button className="btn btn-sm" onClick={() => setStyle({}, Object.keys(overridden))}>Clear all {breakpoint} style overrides</button>}
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  {(["tablet", "mobile"] as Breakpoint[]).filter((bp) => bp !== breakpoint).map((bp) => <button key={bp} className="btn btn-sm" onClick={() => store.setBreakpoint(bp)}>Edit {bp} view</button>)}
                </div>
              </>
            )}
          </Group>
        )}
        {!multi && has("interactions") && show("Interactions") && (
          <Group title="Interactions" defaultOpen={false}><InteractionsEditor node={node} /></Group>
        )}
        {!multi && has("accessibility") && show("Accessibility") && (
          <Group title="Accessibility" defaultOpen={false}>
            <Field label="Label" htmlFor="p-a11y" stack><input id="p-a11y" key={node.id} defaultValue={node.a11y?.label ?? ""} placeholder="Describes the element for screen readers" onBlur={(e) => e.target.value !== (node.a11y?.label ?? "") && store.dispatch([{ type: "updateA11y", nodeId: node.id, a11y: { label: e.target.value || undefined } }])} /></Field>
            {node.type === "icon" && (
              <>
                <Toggle checked={node.a11y?.decorative === true} onChange={(decorative) => store.dispatch([{ type: "updateA11y", nodeId: node.id, a11y: { decorative } }])} label="Decorative (hidden from screen readers)" />
                <p className="help">Leave the label empty for decoration. A linked icon always gets a name, so it stays usable by keyboard and screen reader.</p>
              </>
            )}
            {node.type === "section" && <Field label="Landmark"><SelectInput value={node.a11y?.role ?? ""} options={[{ value: "", label: "Section" }, { value: "banner", label: "Header (banner)" }, { value: "contentinfo", label: "Footer" }, { value: "complementary", label: "Aside" }, { value: "navigation", label: "Navigation" }]} onChange={(v) => store.dispatch([{ type: "updateA11y", nodeId: node.id, a11y: { role: (v || undefined) as never } }])} /></Field>}
            <p className="help">Headings and images have their own checks in the Publish dialog.</p>
          </Group>
        )}
        {!multi && has("advanced") && show("Advanced") && (
          <Group title="Advanced" defaultOpen={false}>
            <Field label="Anchor name" htmlFor="p-anchor"><input id="p-anchor" key={node.id} defaultValue={node.anchorId ?? ""} placeholder="e.g. pricing" onBlur={(e) => { const v = e.target.value.trim().replace(/[^A-Za-z0-9_-]/g, "-").replace(/^[^A-Za-z]+/, ""); if (v !== (node.anchorId ?? "")) store.dispatch([{ type: "setAnchor", nodeId: node.id, anchorId: v || null }]); }} /></Field>
            <p className="help">Use the anchor name to link to this element from buttons and menus.</p>
            <Field label="Element id"><code className="small">{node.id}</code></Field>
            {node.textStyle && <Field label="Text style"><span className="small">{node.textStyle}</span></Field>}
          </Group>
        )}
      </div>
    </>
  );
}

function overrideBadge(overridden: StyleSet, keys: string[]): ReactNode {
  const n = keys.filter((k) => k in overridden).length;
  return n ? <span className="bp-badge" title={`${n} override${n === 1 ? "" : "s"} on this breakpoint`}>{n}</span> : null;
}

/* ------------------------------------------------------------- layout */

function LayoutEditor({ node, style, setStyle, breakpoint }: { node: Node; style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void; breakpoint: Breakpoint }) {
  const store = useStore();
  const def = getDefinition(node.type);
  const layout = node.layout!;
  const setLayout = (patch: Partial<typeof layout>) => store.dispatch([{ type: "setLayout", nodeId: node.id, layout: patch }]);
  return (
    <>
      {def.layoutModes.length > 1 && (
        <Field label="Mode">
          <div className="seg" role="group" aria-label="Layout mode">
            <button aria-pressed={layout.mode === "flow"} onClick={() => setLayout({ mode: "flow" })}>Flowing</button>
            <button aria-pressed={layout.mode === "free"} onClick={() => setLayout({ mode: "free", stackOnMobile: true })}>Freeform</button>
          </div>
        </Field>
      )}
      {layout.mode === "free" ? (
        <>
          <p className="help">Children are placed freely on a {layout.designWidth}×{layout.designHeight} canvas that scales with the screen.</p>
          <div className="row gap">
            <Field label="Canvas W"><NumberInput value={layout.designWidth} min={200} max={4000} onChange={(designWidth) => setLayout({ designWidth })} unit="px" /></Field>
            <Field label="Canvas H"><NumberInput value={layout.designHeight} min={40} max={20000} onChange={(designHeight) => setLayout({ designHeight })} unit="px" /></Field>
          </div>
          <Toggle checked={layout.stackOnMobile} onChange={(stackOnMobile) => setLayout({ stackOnMobile })} label="Stack children vertically on mobile" />
        </>
      ) : (
        <>
          <Field label="Arrange"><SelectInput value={style.display ?? "flex"} options={[{ value: "flex", label: "Stack / row" }, { value: "grid", label: "Grid" }, { value: "block", label: "Simple flow" }]} onChange={(display) => setStyle({ display: display as StyleSet["display"] })} /></Field>
          {(style.display ?? "flex") === "flex" && (
            <>
              <Field label="Direction"><SelectInput value={style.flexDirection ?? "column"} options={[{ value: "column", label: "Vertical" }, { value: "row", label: "Horizontal" }, { value: "column-reverse", label: "Vertical (reversed)" }, { value: "row-reverse", label: "Horizontal (reversed)" }]} onChange={(flexDirection) => setStyle({ flexDirection: flexDirection as StyleSet["flexDirection"] })} /></Field>
              <Field label="Main align"><SelectInput value={style.justifyContent ?? "flex-start"} options={[{ value: "flex-start", label: "Start" }, { value: "center", label: "Centre" }, { value: "flex-end", label: "End" }, { value: "space-between", label: "Space between" }, { value: "space-around", label: "Space around" }, { value: "space-evenly", label: "Space evenly" }]} onChange={(justifyContent) => setStyle({ justifyContent: justifyContent as StyleSet["justifyContent"] })} /></Field>
              <Field label="Cross align"><SelectInput value={style.alignItems ?? "stretch"} options={[{ value: "stretch", label: "Stretch" }, { value: "flex-start", label: "Start" }, { value: "center", label: "Centre" }, { value: "flex-end", label: "End" }, { value: "baseline", label: "Baseline" }]} onChange={(alignItems) => setStyle({ alignItems: alignItems as StyleSet["alignItems"] })} /></Field>
              <Field label="Wrap"><Toggle checked={style.flexWrap === "wrap"} onChange={(b) => setStyle({ flexWrap: b ? "wrap" : "nowrap" })} label="" /></Field>
            </>
          )}
          {style.display === "grid" && (
            <>
              <Field label="Columns"><NumberInput value={style.gridColumns ?? (node.type === "columns" ? Number(node.props.count) : 2)} min={1} max={12} onChange={(gridColumns) => (node.type === "columns" ? store.dispatch([{ type: "updateProps", nodeId: node.id, props: { count: gridColumns } }, { type: "updateStyle", nodeId: node.id, breakpoint: "desktop", style: { gridColumns } }]) : setStyle({ gridColumns }))} /></Field>
              <Field label="Justify items"><SelectInput value={style.justifyContent ?? "flex-start"} options={[{ value: "flex-start", label: "Start" }, { value: "center", label: "Centre" }, { value: "flex-end", label: "End" }]} onChange={(justifyContent) => setStyle({ justifyContent: justifyContent as StyleSet["justifyContent"] })} /></Field>
            </>
          )}
          <Field label="Gap"><LengthInput value={style.gap} onChange={(gap) => setStyle({ gap })} onClear={() => setStyle({}, ["gap"])} allowAuto={false} /></Field>
          {node.type === "columns" && (
            <>
              <Field label="Columns"><NumberInput value={Number(node.props.count)} min={1} max={6} onChange={(count) => store.dispatch([{ type: "updateProps", nodeId: node.id, props: { count } }, { type: "updateStyle", nodeId: node.id, breakpoint: "desktop", style: { gridColumns: count } }])} /></Field>
              <Field label="Stack below"><SelectInput value={String(node.props.stackBelow)} options={[{ value: "mobile", label: "Mobile" }, { value: "tablet", label: "Tablet" }, { value: "never", label: "Never" }]} onChange={(stackBelow) => store.dispatch([{ type: "updateProps", nodeId: node.id, props: { stackBelow } }])} /></Field>
              <ColumnChildren node={node} />
            </>
          )}
        </>
      )}
      {node.type === "section" && (
        <>
          <Field label="Content width">
            <div className="field-inline">
              <NumberInput value={layout.contentWidth ?? undefined} placeholder="theme" min={320} max={2400} onChange={(contentWidth) => setLayout({ contentWidth })} unit="px" />
              {layout.contentWidth !== null && <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setLayout({ contentWidth: null })} aria-label="Use theme width"><I.x /></button>}
            </div>
          </Field>
          <Toggle checked={!!node.props.fullBleed} onChange={(fullBleed) => store.dispatch([{ type: "updateProps", nodeId: node.id, props: { fullBleed } }])} label="Full width (ignore content width)" />
          <Field label="Min height"><NumberInput value={Number(node.props.minHeight ?? 0)} min={0} max={4000} onChange={(minHeight) => store.dispatch([{ type: "updateProps", nodeId: node.id, props: { minHeight } }])} unit="px" /></Field>
        </>
      )}
      {breakpoint !== "desktop" && <p className="help">Direction, alignment and gap changes apply to the {breakpoint} view only.</p>}
      <Field label="Overflow"><SelectInput value={style.overflow ?? "visible"} options={["visible", "hidden", "auto"].map((v) => ({ value: v, label: v }))} onChange={(overflow) => setStyle({ overflow: overflow as StyleSet["overflow"] })} /></Field>
    </>
  );
}

function ColumnChildren({ node }: { node: Node }) {
  const store = useStore();
  const kids = node.children ?? [];
  const count = Number(node.props.count ?? 2);
  if (kids.length >= count) return null;
  return <button className="btn btn-sm" onClick={() => store.dispatch(Array.from({ length: count - kids.length }, () => ({ type: "insertComponent" as const, target: { parentId: node.id }, componentType: "container" as const })))}>Add {count - kids.length} missing column{count - kids.length === 1 ? "" : "s"}</button>;
}

/* --------------------------------------------------------- typography */

function TypographyEditor({ node, style, setStyle, multi }: { node: Node; style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void; multi: boolean }) {
  const store = useStore();
  const theme = useSel((s) => s.document.theme);
  const def = getDefinition(node.type);
  const ts = node.textStyle ? theme.textStyles[node.textStyle as keyof typeof theme.textStyles] : undefined;
  const detached = ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "fontFamily", "textTransform"].some((k) => k in node.style);
  return (
    <>
      {!multi && def.inlineText && (
        <Field label="Text style">
          <div className="field-inline">
            <SelectInput value={node.textStyle ?? ""} options={[{ value: "", label: "None" }, ...TEXT_STYLE_KEYS.map((k) => ({ value: k, label: k.replace(/(\d)/, " $1").replace(/^\w/, (c) => c.toUpperCase()) }))]} onChange={(v) => store.dispatch([{ type: "setTextStyle", nodeId: node.id, textStyle: (v || null) as never }])} />
          </div>
        </Field>
      )}
      {ts && detached && <p className="help">This element overrides its text style. <button className="btn btn-sm" onClick={() => setStyle({}, ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "fontFamily", "textTransform", "fontStyle"])}>Reattach</button></p>}
      <Field label="Font"><SelectInput value={style.fontFamily ?? ""} options={[{ value: "", label: ts ? `Style (${ts.fontFamily})` : "Theme body" }, { value: "var(--b-font-heading)", label: "Heading font" }, { value: "var(--b-font-body)", label: "Body font" }, ...["Inter", "Playfair Display", "DM Sans", "Space Grotesk", "Lora", "Georgia", "System Sans", "System Serif", "Monospace"].map((f) => ({ value: f, label: f }))]} onChange={(v) => (v ? setStyle({ fontFamily: v.startsWith("var(") ? (v === "var(--b-font-heading)" ? theme.fonts.heading : theme.fonts.body) : v }) : setStyle({}, ["fontFamily"]))} /></Field>
      <div className="row gap">
        <Field label="Size"><NumberInput value={parseLength(style.fontSize).n ?? ts?.fontSize} min={6} max={300} onChange={(fontSize) => setStyle({ fontSize })} unit="px" /></Field>
        <Field label="Weight"><SelectInput value={String(style.fontWeight ?? ts?.fontWeight ?? 400)} options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))} onChange={(v) => setStyle({ fontWeight: Number(v) })} /></Field>
      </div>
      <div className="row gap">
        <Field label="Line height"><NumberInput value={typeof style.lineHeight === "number" ? style.lineHeight : ts?.lineHeight} min={0.5} max={4} step={0.05} onChange={(lineHeight) => setStyle({ lineHeight })} /></Field>
        <Field label="Spacing"><NumberInput value={parseLength(style.letterSpacing).n ?? (ts ? Math.round(ts.letterSpacing * 100) / 100 : 0)} min={-2} max={20} step={0.1} onChange={(n) => setStyle({ letterSpacing: `${n}px` })} unit="px" /></Field>
      </div>
      <Field label="Align">
        <div className="seg" role="group" aria-label="Text alignment">
          {(["left", "center", "right", "justify"] as const).map((a) => <button key={a} aria-pressed={(style.textAlign ?? "left") === a} onClick={() => setStyle({ textAlign: a })} title={a}>{a[0]!.toUpperCase()}</button>)}
        </div>
      </Field>
      <Field label="Style">
        <div className="row gap" style={{ flexWrap: "wrap" }}>
          <button className={`chip ${style.fontStyle === "italic" ? "active" : ""}`} onClick={() => setStyle({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}><em>Italic</em></button>
          <button className={`chip ${style.textDecoration === "underline" ? "active" : ""}`} onClick={() => setStyle({ textDecoration: style.textDecoration === "underline" ? "none" : "underline" })}><u>Underline</u></button>
          <button className={`chip ${style.textDecoration === "line-through" ? "active" : ""}`} onClick={() => setStyle({ textDecoration: style.textDecoration === "line-through" ? "none" : "line-through" })}><s>Strike</s></button>
        </div>
      </Field>
      <Field label="Case"><SelectInput value={style.textTransform ?? ts?.textTransform ?? "none"} options={["none", "uppercase", "lowercase", "capitalize"].map((v) => ({ value: v, label: v }))} onChange={(v) => setStyle({ textTransform: v as StyleSet["textTransform"] })} /></Field>
      <Field label="Colour" stack><ColorInput value={style.color} onChange={(color) => setStyle({ color })} onClear={() => setStyle({}, ["color"])} /></Field>
      <Field label="Highlight" stack><ColorInput value={style.highlightColor} onChange={(highlightColor) => setStyle({ highlightColor })} onClear={() => setStyle({}, ["highlightColor"])} /></Field>
      <Field label="Text shadow">
        <Toggle checked={!!style.textShadow} onChange={(b) => (b ? setStyle({ textShadow: { x: 0, y: 2, blur: 6, color: "rgba(0,0,0,0.35)" } }) : setStyle({}, ["textShadow"]))} label="" />
      </Field>
      {style.textShadow && (
        <div className="row gap">
          <Field label="X"><NumberInput value={style.textShadow.x} min={-50} max={50} onChange={(x) => setStyle({ textShadow: { ...style.textShadow!, x } })} /></Field>
          <Field label="Y"><NumberInput value={style.textShadow.y} min={-50} max={50} onChange={(y) => setStyle({ textShadow: { ...style.textShadow!, y } })} /></Field>
          <Field label="Blur"><NumberInput value={style.textShadow.blur} min={0} max={50} onChange={(blur) => setStyle({ textShadow: { ...style.textShadow!, blur } })} /></Field>
        </div>
      )}
      {node.type === "heading" && <Field label="Heading level"><SelectInput value={String(node.props.level ?? 2)} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: `H${l}` }))} onChange={(v) => store.dispatch([{ type: "updateProps", nodeId: node.id, props: { level: Number(v) } }])} /></Field>}
      {def.inlineText && <Field label="Vertical"><SelectInput value={style.verticalAlign ?? "top"} options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }]} onChange={(v) => setStyle({ verticalAlign: v as StyleSet["verticalAlign"] })} /></Field>}
    </>
  );
}

/* --------------------------------------------------------- background */

function BackgroundEditor({ value, onChange, onClear }: { value: Background | undefined; onChange: (b: Background) => void; onClear: () => void }) {
  const [picking, setPicking] = useState(false);
  const bg: Background = value ?? { type: "none" };
  const set = (patch: Partial<Background>) => onChange({ ...bg, ...patch });
  return (
    <>
      <Field label="Type">
        <div className="seg" role="group" aria-label="Background type">
          {(["none", "color", "gradient", "image"] as const).map((t) => <button key={t} aria-pressed={bg.type === t} onClick={() => (t === "none" ? onClear() : set({ type: t, ...(t === "gradient" && !bg.gradient ? { gradient: { angle: 180, from: "var(--b-primary)", to: "var(--b-accent)" } } : {}), ...(t === "image" && !bg.image ? { image: { src: "", size: "cover", position: "center", repeat: "no-repeat", attachment: "scroll" } } : {}), ...(t === "color" && !bg.color ? { color: "var(--b-surface)" } : {}) }))}>{t === "none" ? "None" : t[0]!.toUpperCase() + t.slice(1)}</button>)}
        </div>
      </Field>
      {bg.type === "color" && <Field label="Colour" stack><ColorInput value={bg.color} onChange={(color) => set({ color })} /></Field>}
      {bg.type === "gradient" && bg.gradient && (
        <>
          <Field label="From" stack><ColorInput value={bg.gradient.from} onChange={(from) => set({ gradient: { ...bg.gradient!, from } })} /></Field>
          <Field label="To" stack><ColorInput value={bg.gradient.to} onChange={(to) => set({ gradient: { ...bg.gradient!, to } })} /></Field>
          <Field label="Angle"><NumberInput value={bg.gradient.angle} min={0} max={360} onChange={(angle) => set({ gradient: { ...bg.gradient!, angle } })} unit="°" /></Field>
        </>
      )}
      {bg.type === "image" && bg.image && (
        <>
          <Field label="Image">
            <div className="row gap">
              {bg.image.src ? <img src={bg.image.src} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <span className="muted small">None</span>}
              <button className="btn btn-sm" onClick={() => setPicking(true)}>Choose…</button>
            </div>
          </Field>
          <Field label="Fit"><SelectInput value={bg.image.size} options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "auto", label: "Natural" }]} onChange={(size) => set({ image: { ...bg.image!, size: size as "cover" } })} /></Field>
          <Field label="Position"><SelectInput value={bg.image.position} options={["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"].map((p) => ({ value: p, label: p }))} onChange={(position) => set({ image: { ...bg.image!, position } })} /></Field>
          <Field label="Repeat"><SelectInput value={bg.image.repeat} options={["no-repeat", "repeat", "repeat-x", "repeat-y"].map((r) => ({ value: r, label: r }))} onChange={(repeat) => set({ image: { ...bg.image!, repeat: repeat as "repeat" } })} /></Field>
          <Toggle checked={bg.image.attachment === "fixed"} onChange={(b) => set({ image: { ...bg.image!, attachment: b ? "fixed" : "scroll" } })} label="Fixed while scrolling (parallax)" />
          {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(a) => { set({ image: { ...bg.image!, src: a.url } }); setPicking(false); }} />}
        </>
      )}
      {bg.type !== "none" && (
        <>
          <Field label="Overlay" stack><ColorInput value={bg.overlayColor} onChange={(overlayColor) => set({ overlayColor, overlayOpacity: bg.overlayOpacity ?? 0.4 })} onClear={() => onChange({ ...bg, overlayColor: undefined, overlayOpacity: undefined })} /></Field>
          {bg.overlayColor && <Field label="Overlay opacity"><NumberInput value={bg.overlayOpacity ?? 0.4} min={0} max={1} step={0.05} onChange={(overlayOpacity) => set({ overlayOpacity })} /></Field>}
        </>
      )}
    </>
  );
}

export function MediaPicker({ onClose, onPick }: { onClose: () => void; onPick: (a: AssetRecord) => void }) {
  return (
    <Modal title="Choose an image" onClose={onClose}>
      <div style={{ margin: -18 }}><MediaPanel onPick={onPick} /></div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- border */

function BorderEditor({ style, setStyle }: { style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void }) {
  const b = style.border;
  const [perCorner, setPerCorner] = useState(typeof style.radius === "object");
  const r = style.radius;
  const corners = typeof r === "object" ? r : { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r };
  const num = (v: unknown) => (typeof v === "number" ? v : v === undefined ? undefined : parseLength(v as never).n);
  return (
    <>
      <Field label="Border"><Toggle checked={!!b && b.style !== "none" && b.width > 0} onChange={(on) => (on ? setStyle({ border: { width: 1, style: "solid", color: "var(--b-border)" } }) : setStyle({}, ["border"]))} label="" /></Field>
      {b && b.style !== "none" && (
        <>
          <Field label="Width"><NumberInput value={b.width} min={0} max={64} onChange={(width) => setStyle({ border: { ...b, width } })} unit="px" /></Field>
          <Field label="Style"><SelectInput value={b.style} options={["solid", "dashed", "dotted"].map((s) => ({ value: s, label: s }))} onChange={(s) => setStyle({ border: { ...b, style: s as "solid" } })} /></Field>
          <Field label="Colour" stack><ColorInput value={b.color} onChange={(color) => setStyle({ border: { ...b, color } })} /></Field>
          <Field label="Sides">
            <div className="row gap" style={{ flexWrap: "wrap" }}>
              {(["top", "right", "bottom", "left"] as const).map((side) => <Toggle key={side} checked={b.sides ? b.sides[side] : true} onChange={(on) => setStyle({ border: { ...b, sides: { top: true, right: true, bottom: true, left: true, ...(b.sides ?? {}), [side]: on } } })} label={side[0]!.toUpperCase()} />)}
            </div>
          </Field>
        </>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="field-label">Corner radius</span>
        <button className={`icon-btn ${perCorner ? "active" : ""}`} style={{ width: 24, height: 24 }} aria-pressed={perCorner} onClick={() => setPerCorner(!perCorner)} title="Edit corners separately" aria-label="Per-corner radius"><I.elements /></button>
      </div>
      {perCorner ? (
        <div className="sides-grid">
          {(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).map((c) => (
            <div key={c}><input type="number" min={0} value={num(corners[c]) ?? ""} placeholder="0" aria-label={`Radius ${c}`} onChange={(e) => setStyle({ radius: { ...corners, [c]: Number(e.target.value) } })} /><div className="lbl">{c.replace(/[a-z]/g, "")}</div></div>
          ))}
        </div>
      ) : (
        <NumberInput value={num(typeof r === "object" ? r.topLeft : r)} min={0} max={999} onChange={(radius) => setStyle({ radius })} unit="px" ariaLabel="Corner radius" />
      )}
      <div className="chip-row">{[0, 4, 8, 16, 24, 999].map((v) => <button key={v} className="chip" onClick={() => setStyle({ radius: v })}>{v === 999 ? "Pill" : v}</button>)}</div>
    </>
  );
}

/* --------------------------------------------------------------- effects */

function EffectsEditor({ style, setStyle }: { style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void }) {
  const sh = style.shadow;
  const preset = typeof sh === "string" ? sh : sh ? "custom" : "none";
  const f = style.filter ?? {};
  const setF = (patch: Partial<NonNullable<StyleSet["filter"]>>) => setStyle({ filter: { ...f, ...patch } });
  const hover = style.hover ?? {};
  const setHover = (patch: Partial<NonNullable<StyleSet["hover"]>>) => setStyle({ hover: { ...hover, ...patch } });
  return (
    <>
      <Field label="Opacity"><NumberInput value={style.opacity ?? 1} min={0} max={1} step={0.05} onChange={(opacity) => setStyle({ opacity })} /></Field>
      <Field label="Shadow"><SelectInput value={preset} options={[{ value: "none", label: "None" }, { value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }, { value: "xl", label: "Extra large" }, { value: "custom", label: "Custom" }]} onChange={(v) => (v === "none" ? setStyle({}, ["shadow"]) : v === "custom" ? setStyle({ shadow: { x: 0, y: 8, blur: 24, spread: 0, color: "rgba(0,0,0,0.18)", inset: false } }) : setStyle({ shadow: v as Shadow }))} /></Field>
      {typeof sh === "object" && (
        <>
          <div className="row gap">
            <Field label="X"><NumberInput value={sh.x} min={-200} max={200} onChange={(x) => setStyle({ shadow: { ...sh, x } })} /></Field>
            <Field label="Y"><NumberInput value={sh.y} min={-200} max={200} onChange={(y) => setStyle({ shadow: { ...sh, y } })} /></Field>
          </div>
          <div className="row gap">
            <Field label="Blur"><NumberInput value={sh.blur} min={0} max={200} onChange={(blur) => setStyle({ shadow: { ...sh, blur } })} /></Field>
            <Field label="Spread"><NumberInput value={sh.spread} min={-100} max={100} onChange={(spread) => setStyle({ shadow: { ...sh, spread } })} /></Field>
          </div>
          <Field label="Colour" stack><ColorInput value={sh.color} onChange={(color) => setStyle({ shadow: { ...sh, color } })} /></Field>
          <Toggle checked={sh.inset} onChange={(inset) => setStyle({ shadow: { ...sh, inset } })} label="Inner shadow" />
        </>
      )}
      <h3 style={{ marginTop: 6 }}>Image adjustments</h3>
      <Field label="Brightness"><NumberInput value={f.brightness ?? 1} min={0} max={3} step={0.05} onChange={(brightness) => setF({ brightness })} /></Field>
      <Field label="Contrast"><NumberInput value={f.contrast ?? 1} min={0} max={3} step={0.05} onChange={(contrast) => setF({ contrast })} /></Field>
      <Field label="Saturation"><NumberInput value={f.saturate ?? 1} min={0} max={3} step={0.05} onChange={(saturate) => setF({ saturate })} /></Field>
      <Field label="Blur"><NumberInput value={f.blur ?? 0} min={0} max={50} onChange={(blur) => setF({ blur })} unit="px" /></Field>
      <Field label="Grayscale"><NumberInput value={f.grayscale ?? 0} min={0} max={1} step={0.1} onChange={(grayscale) => setF({ grayscale })} /></Field>
      <Field label="Sepia (tint)"><NumberInput value={f.sepia ?? 0} min={0} max={1} step={0.1} onChange={(sepia) => setF({ sepia })} /></Field>
      {style.filter && <button className="btn btn-sm" onClick={() => setStyle({}, ["filter"])}>Reset adjustments</button>}
      <Field label="Backdrop blur"><NumberInput value={style.backdropBlur ?? 0} min={0} max={50} onChange={(backdropBlur) => setStyle({ backdropBlur })} unit="px" /></Field>
      <h3 style={{ marginTop: 6 }}>On hover</h3>
      <Field label="Background" stack><ColorInput value={hover.background?.color} onChange={(c) => setHover({ background: { type: "color", color: c } })} onClear={() => setHover({ background: undefined })} /></Field>
      <Field label="Text colour" stack><ColorInput value={hover.color} onChange={(color) => setHover({ color })} onClear={() => setHover({ color: undefined })} /></Field>
      <div className="row gap">
        <Field label="Scale"><NumberInput value={hover.scale ?? 1} min={0.5} max={1.5} step={0.01} onChange={(scale) => setHover({ scale })} /></Field>
        <Field label="Opacity"><NumberInput value={hover.opacity ?? 1} min={0} max={1} step={0.05} onChange={(opacity) => setHover({ opacity })} /></Field>
      </div>
      <Field label="Shadow"><SelectInput value={typeof hover.shadow === "string" ? hover.shadow : "none"} options={["none", "sm", "md", "lg", "xl"].map((v) => ({ value: v, label: v }))} onChange={(v) => setHover({ shadow: v as Shadow })} /></Field>
      {style.hover && <button className="btn btn-sm" onClick={() => setStyle({}, ["hover"])}>Reset hover</button>}
    </>
  );
}

/* ---------------------------------------------------------------- media */

function MediaEditor({ node, setProps, style, setStyle }: { node: Node; setProps: (p: Record<string, unknown>) => void; style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void }) {
  const [picking, setPicking] = useState(false);
  if (node.type === "gallery") return <GalleryEditor node={node} setProps={setProps} />;
  if (node.type === "video") return <VideoEditor node={node} setProps={setProps} />;
  const p = node.props as { src: string; alt: string; decorative: boolean; caption?: string; focalX: number; focalY: number; flipX: boolean; flipY: boolean; lazy: boolean; crop?: { x: number; y: number; w: number; h: number } };
  return (
    <>
      <div className="row gap" style={{ alignItems: "flex-start" }}>
        {p.src ? <img src={p.src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--panel-border)" }} /> : <div style={{ width: 72, height: 72, borderRadius: 8, background: "var(--bg-sunken)" }} />}
        <div className="row gap" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <button className="btn btn-sm btn-primary" onClick={() => setPicking(true)}>{p.src ? "Replace image" : "Choose image"}</button>
          {p.src && <button className="btn btn-sm" onClick={() => setProps({ src: "" })}>Remove</button>}
        </div>
      </div>
      <Field label="Alt text" htmlFor="img-alt" stack><input id="img-alt" key={node.id + p.alt} defaultValue={p.alt} placeholder="Describe the image" disabled={p.decorative} onBlur={(e) => e.target.value !== p.alt && setProps({ alt: e.target.value })} /></Field>
      <Toggle checked={p.decorative} onChange={(decorative) => setProps({ decorative })} label="Decorative (no description needed)" />
      <Field label="Caption" htmlFor="img-cap" stack><input id="img-cap" key={node.id + (p.caption ?? "")} defaultValue={p.caption ?? ""} onBlur={(e) => e.target.value !== (p.caption ?? "") && setProps({ caption: e.target.value || undefined })} /></Field>
      <Field label="Fit"><SelectInput value={style.objectFit ?? "cover"} options={[{ value: "cover", label: "Cover (crop to fill)" }, { value: "contain", label: "Contain (show all)" }, { value: "fill", label: "Stretch" }]} onChange={(objectFit) => setStyle({ objectFit: objectFit as StyleSet["objectFit"] })} /></Field>
      <div className="row gap">
        <Field label="Focus X"><NumberInput value={p.focalX} min={0} max={100} onChange={(focalX) => setProps({ focalX })} unit="%" /></Field>
        <Field label="Focus Y"><NumberInput value={p.focalY} min={0} max={100} onChange={(focalY) => setProps({ focalY })} unit="%" /></Field>
      </div>
      <Field label="Flip">
        <div className="row gap"><Toggle checked={p.flipX} onChange={(flipX) => setProps({ flipX })} label="Horizontal" /><Toggle checked={p.flipY} onChange={(flipY) => setProps({ flipY })} label="Vertical" /></div>
      </Field>
      <Field label="Rotate"><div className="row gap"><button className="btn btn-sm" onClick={() => setProps({ flipX: !p.flipX, flipY: !p.flipY })}>180°</button></div></Field>
      <h3 style={{ marginTop: 6 }}>Crop</h3>
      {p.crop ? (
        <>
          <div className="row gap">
            <Field label="Left"><NumberInput value={p.crop.x} min={0} max={99} onChange={(x) => setProps({ crop: { ...p.crop!, x, w: Math.min(p.crop!.w, 100 - x) } })} unit="%" /></Field>
            <Field label="Top"><NumberInput value={p.crop.y} min={0} max={99} onChange={(y) => setProps({ crop: { ...p.crop!, y, h: Math.min(p.crop!.h, 100 - y) } })} unit="%" /></Field>
          </div>
          <div className="row gap">
            <Field label="Width"><NumberInput value={p.crop.w} min={1} max={100 - p.crop.x} onChange={(w) => setProps({ crop: { ...p.crop!, w } })} unit="%" /></Field>
            <Field label="Height"><NumberInput value={p.crop.h} min={1} max={100 - p.crop.y} onChange={(h) => setProps({ crop: { ...p.crop!, h } })} unit="%" /></Field>
          </div>
          <button className="btn btn-sm" onClick={() => setProps({ crop: undefined })}>Remove crop</button>
        </>
      ) : (
        <button className="btn btn-sm" onClick={() => setProps({ crop: { x: 10, y: 10, w: 80, h: 80 } })}>Crop image…</button>
      )}
      <Toggle checked={p.lazy} onChange={(lazy) => setProps({ lazy })} label="Load lazily (recommended below the fold)" />
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(a) => { setProps({ src: a.url, alt: p.alt || a.alt, naturalWidth: a.width ?? undefined, naturalHeight: a.height ?? undefined }); setPicking(false); }} />}
    </>
  );
}

function GalleryEditor({ node, setProps }: { node: Node; setProps: (p: Record<string, unknown>) => void }) {
  const [picking, setPicking] = useState(false);
  const p = node.props as { images: { src: string; alt: string; decorative?: boolean }[]; columns: number; gap: number; aspect: string };
  const images = p.images ?? [];
  const update = (i: number, patch: Partial<(typeof images)[number]>) => setProps({ images: images.map((img, j) => (j === i ? { ...img, ...patch } : img)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    const [it] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, it!);
    setProps({ images: next });
  };
  return (
    <>
      <div className="row gap">
        <Field label="Columns"><NumberInput value={p.columns} min={1} max={6} onChange={(columns) => setProps({ columns })} /></Field>
        <Field label="Gap"><NumberInput value={p.gap} min={0} max={80} onChange={(gap) => setProps({ gap })} unit="px" /></Field>
      </div>
      <Field label="Shape"><SelectInput value={p.aspect} options={[{ value: "square", label: "Square" }, { value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }, { value: "natural", label: "Natural" }]} onChange={(aspect) => setProps({ aspect })} /></Field>
      <button className="btn btn-sm btn-primary" onClick={() => setPicking(true)}><I.plus /> Add image</button>
      <ul className="list">
        {images.map((img, i) => (
          <li key={i} className="list-item" style={{ alignItems: "flex-start" }}>
            <img src={img.src} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
            <div className="grow" style={{ whiteSpace: "normal" }}>
              <input key={`${i}${img.alt}`} defaultValue={img.alt} placeholder="Alt text" aria-label={`Alt text for image ${i + 1}`} onBlur={(e) => e.target.value !== img.alt && update(i, { alt: e.target.value })} />
            </div>
            <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Move earlier"><I.up /></button>
            <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Move later"><I.down /></button>
            <button className="icon-btn" onClick={() => setProps({ images: images.filter((_, j) => j !== i) })} aria-label="Remove image"><I.trash /></button>
          </li>
        ))}
      </ul>
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(a) => { setProps({ images: [...images, { src: a.url, alt: a.alt, decorative: false, focalX: 50, focalY: 50, flipX: false, flipY: false, lazy: true, naturalWidth: a.width ?? undefined, naturalHeight: a.height ?? undefined }] }); setPicking(false); }} />}
    </>
  );
}

function VideoEditor({ node, setProps }: { node: Node; setProps: (p: Record<string, unknown>) => void }) {
  const p = node.props as { provider: string; videoId: string; src: string; title: string; autoplay: boolean; loop: boolean; muted: boolean; controls: boolean };
  const parse = (raw: string) => {
    const v = raw.trim();
    const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(v);
    if (yt) return setProps({ provider: "youtube", videoId: yt[1] });
    const vm = /vimeo\.com\/(?:video\/)?(\d{4,15})/.exec(v);
    if (vm) return setProps({ provider: "vimeo", videoId: vm[1] });
    if (/^https:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(v) || v.startsWith("/media/")) return setProps({ provider: "file", src: v });
    if (/^[A-Za-z0-9_-]{6,20}$/.test(v)) return setProps({ videoId: v, provider: p.provider === "file" ? "youtube" : p.provider });
  };
  return (
    <>
      <Field label="Video link" htmlFor="vid-url" stack><input id="vid-url" key={node.id + p.videoId + p.src} defaultValue={p.provider === "file" ? p.src : p.videoId ? (p.provider === "youtube" ? `https://youtu.be/${p.videoId}` : `https://vimeo.com/${p.videoId}`) : ""} placeholder="Paste a YouTube or Vimeo link" onBlur={(e) => parse(e.target.value)} /></Field>
      <p className="help">YouTube and Vimeo embeds load in privacy mode. Direct video files must be https.</p>
      <Field label="Title" htmlFor="vid-title"><input id="vid-title" key={node.id + p.title} defaultValue={p.title} onBlur={(e) => e.target.value !== p.title && setProps({ title: e.target.value })} /></Field>
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        <Toggle checked={p.controls} onChange={(controls) => setProps({ controls })} label="Controls" />
        <Toggle checked={p.autoplay} onChange={(autoplay) => setProps({ autoplay, muted: autoplay ? true : p.muted })} label="Autoplay (muted)" />
        <Toggle checked={p.loop} onChange={(loop) => setProps({ loop })} label="Loop" />
        <Toggle checked={p.muted} onChange={(muted) => setProps({ muted })} label="Muted" />
      </div>
    </>
  );
}

/* --------------------------------------------------------- interactions */

function InteractionsEditor({ node }: { node: Node }) {
  const store = useStore();
  const it = node.interactions ?? { entrance: "none" as const, hover: "none" as const, durationMs: 400, delayMs: 0, easing: "ease-out" as const, trigger: "scroll" as const };
  const set = (patch: Partial<typeof it>) => store.dispatch([{ type: "updateInteractions", nodeId: node.id, interactions: patch }]);
  return (
    <>
      <Field label="Entrance"><SelectInput value={it.entrance} options={[{ value: "none", label: "None" }, { value: "fade", label: "Fade in" }, { value: "slide-up", label: "Slide up" }, { value: "slide-left", label: "Slide from right" }, { value: "zoom", label: "Zoom in" }]} onChange={(entrance) => set({ entrance: entrance as typeof it.entrance })} /></Field>
      {it.entrance !== "none" && (
        <>
          <Field label="Trigger"><SelectInput value={it.trigger} options={[{ value: "scroll", label: "When scrolled into view" }, { value: "load", label: "On page load" }]} onChange={(trigger) => set({ trigger: trigger as typeof it.trigger })} /></Field>
          <div className="row gap">
            <Field label="Duration"><NumberInput value={it.durationMs} min={0} max={3000} step={50} onChange={(durationMs) => set({ durationMs })} unit="ms" /></Field>
            <Field label="Delay"><NumberInput value={it.delayMs} min={0} max={3000} step={50} onChange={(delayMs) => set({ delayMs })} unit="ms" /></Field>
          </div>
          <Field label="Easing"><SelectInput value={it.easing} options={["ease", "ease-in", "ease-out", "ease-in-out", "linear"].map((e) => ({ value: e, label: e }))} onChange={(easing) => set({ easing: easing as typeof it.easing })} /></Field>
        </>
      )}
      <Field label="On hover"><SelectInput value={it.hover} options={[{ value: "none", label: "None" }, { value: "lift", label: "Lift" }, { value: "grow", label: "Grow" }, { value: "shrink", label: "Shrink" }, { value: "fade", label: "Fade" }]} onChange={(hover) => set({ hover: hover as typeof it.hover })} /></Field>
      <p className="help">Animations are skipped for visitors who prefer reduced motion.</p>
    </>
  );
}

/* --------------------------------------------------------------- content */

function ContentEditor({ node, setProps, style, setStyle }: { node: Node; setProps: (p: Record<string, unknown>) => void; style: StyleSet; setStyle: (s: StyleSet, unset?: string[]) => void }) {
  const p = node.props as Record<string, any>;
  switch (node.type) {
    case "heading":
      return (
        <>
          <Field label="Text" htmlFor="c-text" stack><textarea id="c-text" key={node.id} defaultValue={p.text} rows={2} maxLength={2000} onBlur={(e) => e.target.value !== p.text && setProps({ text: e.target.value })} /></Field>
          <Field label="Level"><SelectInput value={String(p.level)} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: `Heading ${l}` }))} onChange={(v) => setProps({ level: Number(v) })} /></Field>
        </>
      );
    case "paragraph":
      return <Field label="Text" htmlFor="c-text" stack><textarea id="c-text" key={node.id} defaultValue={p.text} rows={5} maxLength={20000} onBlur={(e) => e.target.value !== p.text && setProps({ text: e.target.value })} /></Field>;
    case "richText":
      return <RichTextEditor blocks={p.blocks as RichText} onChange={(blocks) => setProps({ blocks })} />;
    case "button":
      return (
        <>
          <Field label="Label" htmlFor="c-label"><input id="c-label" key={node.id + p.label} defaultValue={p.label} maxLength={200} onBlur={(e) => e.target.value !== p.label && setProps({ label: e.target.value })} /></Field>
          <Field label="Style"><SelectInput value={p.variant} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "ghost", label: "Ghost" }, { value: "custom", label: "Custom (use Fill & Border)" }]} onChange={(variant) => setProps({ variant })} /></Field>
          <Field label="Icon"><SelectInput value={p.icon} options={["none", "arrow-right", "arrow-down", "mail", "phone", "download", "external"].map((i) => ({ value: i, label: i }))} onChange={(icon) => setProps({ icon })} /></Field>
          {p.icon !== "none" && <Field label="Icon side"><SelectInput value={p.iconPosition} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={(iconPosition) => setProps({ iconPosition })} /></Field>}
          <Toggle checked={!!p.fullWidth} onChange={(fullWidth) => setProps({ fullWidth })} label="Full width" />
          <Toggle checked={!!p.disabled} onChange={(disabled) => setProps({ disabled })} label="Disabled" />
          <Field label="Aria label" htmlFor="c-aria"><input id="c-aria" key={node.id + (p.ariaLabel ?? "")} defaultValue={p.ariaLabel ?? ""} placeholder="Only if the label isn't descriptive" onBlur={(e) => e.target.value !== (p.ariaLabel ?? "") && setProps({ ariaLabel: e.target.value || undefined })} /></Field>
        </>
      );
    case "icon":
      return <IconContentEditor node={node} setProps={setProps} style={style} setStyle={setStyle} />;
    case "shape":
      return <Field label="Shape"><SelectInput value={p.kind} options={["rectangle", "circle", "triangle", "line", "blob"].map((k) => ({ value: k, label: k }))} onChange={(kind) => setProps({ kind })} /></Field>;
    case "divider":
      return (
        <>
          <Field label="Thickness"><NumberInput value={p.thickness} min={1} max={20} onChange={(thickness) => setProps({ thickness })} unit="px" /></Field>
          <Field label="Style"><SelectInput value={p.lineStyle} options={["solid", "dashed", "dotted"].map((s) => ({ value: s, label: s }))} onChange={(lineStyle) => setProps({ lineStyle })} /></Field>
        </>
      );
    case "spacer":
      return <Field label="Height"><NumberInput value={p.size} min={0} max={600} onChange={(size) => setProps({ size })} unit="px" /></Field>;
    case "map":
      return (
        <>
          <Field label="Address" htmlFor="c-addr" stack><input id="c-addr" key={node.id + p.address} defaultValue={p.address} placeholder="Street, city, country" onBlur={(e) => e.target.value !== p.address && setProps({ address: e.target.value })} /></Field>
          <Field label="Zoom"><NumberInput value={p.zoom} min={1} max={20} onChange={(zoom) => setProps({ zoom })} /></Field>
          <Field label="Title" htmlFor="c-mtitle"><input id="c-mtitle" key={node.id + p.title} defaultValue={p.title} onBlur={(e) => e.target.value !== p.title && setProps({ title: e.target.value })} /></Field>
        </>
      );
    case "contact":
      return (
        <>
          {(["email", "phone", "address", "hours"] as const).map((k) => (
            <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)} htmlFor={`c-${k}`} stack>
              {k === "address" || k === "hours" ? <textarea id={`c-${k}`} key={node.id + p[k]} defaultValue={p[k]} rows={2} onBlur={(e) => e.target.value !== p[k] && setProps({ [k]: e.target.value })} /> : <input id={`c-${k}`} key={node.id + p[k]} defaultValue={p[k]} onBlur={(e) => e.target.value !== p[k] && setProps({ [k]: e.target.value })} />}
            </Field>
          ))}
        </>
      );
    case "footer":
      return (
        <>
          <Field label="Text" htmlFor="c-ftext" stack><textarea id="c-ftext" key={node.id + p.text} defaultValue={p.text} rows={2} onBlur={(e) => e.target.value !== p.text && setProps({ text: e.target.value })} /></Field>
          <Toggle checked={!!p.showNavigation} onChange={(showNavigation) => setProps({ showNavigation })} label="Show page links" />
        </>
      );
    case "hero":
      return <Field label="Align"><SelectInput value={p.align} options={[{ value: "center", label: "Centre" }, { value: "left", label: "Left" }]} onChange={(align) => setProps({ align })} /></Field>;
    case "navigation":
      return <NavigationContent p={p} setProps={setProps} nodeId={node.id} />;
    case "socialLinks":
      return <SocialContent p={p} setProps={setProps} />;
    case "form":
      return <FormContent p={p} setProps={setProps} />;
    case "section":
    case "container":
    case "stack":
    case "card":
    case "columns":
    case "group":
    case "gallery":
    case "video":
    case "image":
      return <p className="help">Use the other groups to edit this element.</p>;
  }
}

function NavigationContent({ p, setProps, nodeId }: { p: Record<string, any>; setProps: (x: Record<string, unknown>) => void; nodeId: string }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Field label="Logo text" htmlFor="c-logo"><input id="c-logo" key={nodeId + p.logoText} defaultValue={p.logoText} onBlur={(e) => e.target.value !== p.logoText && setProps({ logoText: e.target.value })} /></Field>
      <Field label="Logo image">
        <div className="row gap">
          {p.logoImage ? <img src={p.logoImage} alt="" style={{ height: 28 }} /> : <span className="muted small">None</span>}
          <button className="btn btn-sm" onClick={() => setPicking(true)}>Choose…</button>
          {p.logoImage && <button className="btn btn-sm" onClick={() => setProps({ logoImage: "" })}>Remove</button>}
        </div>
      </Field>
      <Toggle checked={!!p.logoLink} onChange={(logoLink) => setProps({ logoLink })} label="Logo links to homepage" />
      <Field label="Alignment"><SelectInput value={p.alignment} options={[{ value: "space-between", label: "Logo left, links right" }, { value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} onChange={(alignment) => setProps({ alignment })} /></Field>
      <Field label="On mobile"><SelectInput value={p.mobileMenu} options={[{ value: "hamburger", label: "Menu button" }, { value: "inline", label: "Show all links" }]} onChange={(mobileMenu) => setProps({ mobileMenu })} /></Field>
      <Toggle checked={!!p.cta} onChange={(on) => setProps({ cta: on ? { label: "Contact", link: { kind: "none" }, variant: "primary" } : undefined })} label="Call-to-action button" />
      {p.cta && (
        <>
          <Field label="Button label" htmlFor="c-cta"><input id="c-cta" key={nodeId + p.cta.label} defaultValue={p.cta.label} onBlur={(e) => e.target.value !== p.cta.label && setProps({ cta: { ...p.cta, label: e.target.value } })} /></Field>
          <Field label="Button style"><SelectInput value={p.cta.variant} options={["primary", "secondary", "ghost"].map((v) => ({ value: v, label: v }))} onChange={(variant) => setProps({ cta: { ...p.cta, variant } })} /></Field>
          <LinkEditor value={p.cta.link} onChange={(link) => setProps({ cta: { ...p.cta, link } })} />
        </>
      )}
      <p className="help">Menu items come from the Menu panel on the left.</p>
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(a) => { setProps({ logoImage: a.url }); setPicking(false); }} />}
    </>
  );
}

function SocialContent({ p, setProps }: { p: Record<string, any>; setProps: (x: Record<string, unknown>) => void }) {
  const links = (p.links as { network: string; url: string }[]) ?? [];
  const networks = ["instagram", "facebook", "x", "linkedin", "youtube", "tiktok", "github", "pinterest", "email", "website"];
  return (
    <>
      {links.map((l, i) => (
        <div key={i} className="row gap">
          <SelectInput value={l.network} options={networks.map((n) => ({ value: n, label: n }))} onChange={(network) => setProps({ links: links.map((x, j) => (j === i ? { ...x, network } : x)) })} ariaLabel="Network" />
          <input key={`${i}${l.url}`} defaultValue={l.url} placeholder="https://…" aria-label="Profile URL" onBlur={(e) => e.target.value !== l.url && setProps({ links: links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
          <button className="icon-btn" aria-label="Remove" onClick={() => setProps({ links: links.filter((_, j) => j !== i) })}><I.trash /></button>
        </div>
      ))}
      {links.length < 12 && <button className="btn btn-sm" onClick={() => setProps({ links: [...links, { network: "instagram", url: "https://" }] })}><I.plus /> Add link</button>}
      <Field label="Icon size"><NumberInput value={p.size} min={16} max={64} onChange={(size) => setProps({ size })} unit="px" /></Field>
      <Field label="Style"><SelectInput value={p.style} options={["plain", "circle", "square"].map((s) => ({ value: s, label: s }))} onChange={(style) => setProps({ style })} /></Field>
    </>
  );
}

function FormContent({ p, setProps }: { p: Record<string, any>; setProps: (x: Record<string, unknown>) => void }) {
  type F = { id: string; type: string; label: string; placeholder?: string; required: boolean; options?: string[] };
  const fields = (p.fields as F[]) ?? [];
  const update = (i: number, patch: Partial<F>) => setProps({ fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  return (
    <>
      <Field label="Title" htmlFor="c-ftitle"><input id="c-ftitle" key={p.title} defaultValue={p.title} onBlur={(e) => e.target.value !== p.title && setProps({ title: e.target.value })} /></Field>
      <h3>Fields</h3>
      {fields.map((f, i) => (
        <div key={f.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="row gap">
            <SelectInput value={f.type} options={["text", "email", "phone", "textarea", "select", "checkbox"].map((t) => ({ value: t, label: t }))} onChange={(type) => update(i, { type, options: type === "select" ? (f.options ?? ["Option 1", "Option 2"]) : undefined })} ariaLabel="Field type" />
            <button className="icon-btn" aria-label="Remove field" onClick={() => setProps({ fields: fields.filter((_, j) => j !== i) })}><I.trash /></button>
          </div>
          <input key={`${f.id}l${f.label}`} defaultValue={f.label} placeholder="Label" aria-label="Field label" onBlur={(e) => e.target.value !== f.label && update(i, { label: e.target.value })} />
          {f.type !== "checkbox" && f.type !== "select" && <input key={`${f.id}p${f.placeholder}`} defaultValue={f.placeholder ?? ""} placeholder="Placeholder (optional)" aria-label="Placeholder" onBlur={(e) => e.target.value !== (f.placeholder ?? "") && update(i, { placeholder: e.target.value || undefined })} />}
          {f.type === "select" && <input key={`${f.id}o${(f.options ?? []).join()}`} defaultValue={(f.options ?? []).join(", ")} placeholder="Options, separated by commas" aria-label="Options" onBlur={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}
          <Toggle checked={f.required} onChange={(required) => update(i, { required })} label="Required" />
        </div>
      ))}
      {fields.length < 20 && <button className="btn btn-sm" onClick={() => setProps({ fields: [...fields, { id: newId("fld"), type: "text", label: "New field", required: false }] })}><I.plus /> Add field</button>}
      <Field label="Button label" htmlFor="c-submit"><input id="c-submit" key={p.submitLabel} defaultValue={p.submitLabel} onBlur={(e) => e.target.value !== p.submitLabel && setProps({ submitLabel: e.target.value })} /></Field>
      <Field label="Button style"><SelectInput value={p.buttonVariant} options={["primary", "secondary", "ghost"].map((v) => ({ value: v, label: v }))} onChange={(buttonVariant) => setProps({ buttonVariant })} /></Field>
      <Field label="Success message" htmlFor="c-success" stack><input id="c-success" key={p.successMessage} defaultValue={p.successMessage} onBlur={(e) => e.target.value !== p.successMessage && setProps({ successMessage: e.target.value })} /></Field>
      <p className="help">Submissions are stored with your site. Open them from the status bar’s Publish dialog → “Form submissions”, or the Settings menu.</p>
    </>
  );
}

function RichTextEditor({ blocks, onChange }: { blocks: RichText; onChange: (b: RichText) => void }) {
  const update = (i: number, patch: Partial<RichText[number]>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const setText = (i: number, text: string) => {
    const first = blocks[i]!.runs[0] ?? { text: "" };
    update(i, { runs: [{ ...first, text }] });
  };
  const toggleMark = (i: number, mark: "bold" | "italic" | "underline") => update(i, { runs: blocks[i]!.runs.map((r) => ({ ...r, [mark]: !r[mark] })) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, b!);
    onChange(next);
  };
  const types = [{ value: "paragraph", label: "Paragraph" }, { value: "h2", label: "Heading 2" }, { value: "h3", label: "Heading 3" }, { value: "h4", label: "Heading 4" }, { value: "quote", label: "Quote" }, { value: "bullet", label: "Bullet" }, { value: "numbered", label: "Numbered" }];
  return (
    <>
      {blocks.map((b, i) => (
        <div key={i} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="row gap">
            <SelectInput value={b.type} options={types as { value: RichText[number]["type"]; label: string }[]} onChange={(type) => update(i, { type })} ariaLabel="Block type" />
            <button className={`chip ${b.runs.every((r) => r.bold) ? "active" : ""}`} onClick={() => toggleMark(i, "bold")}><b>B</b></button>
            <button className={`chip ${b.runs.every((r) => r.italic) ? "active" : ""}`} onClick={() => toggleMark(i, "italic")}><i>I</i></button>
            <button className={`chip ${b.runs.every((r) => r.underline) ? "active" : ""}`} onClick={() => toggleMark(i, "underline")}><u>U</u></button>
          </div>
          <textarea key={`${i}${b.runs.map((r) => r.text).join("")}`} defaultValue={b.runs.map((r) => r.text).join("")} rows={2} aria-label="Block text" onBlur={(e) => e.target.value !== b.runs.map((r) => r.text).join("") && setText(i, e.target.value)} />
          <LinkEditor value={b.runs[0]?.link} onChange={(link) => update(i, { runs: b.runs.map((r, k) => (k === 0 ? { ...r, link: link.kind === "none" ? undefined : link } : r)) })} compact />
          <div className="row gap">
            <button className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}><I.up /></button>
            <button className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}><I.down /></button>
            <button className="icon-btn" aria-label="Remove block" onClick={() => onChange(blocks.filter((_, j) => j !== i))}><I.trash /></button>
          </div>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...blocks, { type: "paragraph", runs: [{ text: "" }] }])}><I.plus /> Add block</button>
    </>
  );
}

export function useMediaPicker() {
  const [open, setOpen] = useState(false);
  return useMemo(() => ({ open, setOpen }), [open]);
}
