# Layout and positioning model

BINHI supports two layout modes per container, chosen by the user, both
stored in the canonical document and rendered by the same engine.

## Structured mode (`layout.mode = "flow"`) — Wix-like

Children follow CSS flow using the container's style: `display` (flex / grid
/ block), `flexDirection`, `justifyContent`, `alignItems`, `flexWrap`, `gap`,
`gridColumns`. Sections constrain content to `theme.spacing.contentWidth`
(or their own `layout.contentWidth`) unless `fullBleed` is set. Columns stack
at the configured breakpoint (`stackBelow`).

Element sizing in flow: `width`, `height`, min/max, `aspectRatio`,
`alignSelf`, `flexGrow`, `order`, with units px / % / rem / vw / vh / auto /
fit-content. Resize handles on the canvas set `width`/`height` in px.

## Controlled freeform mode (`layout.mode = "free"`) — Canva-like

The container becomes a design canvas of `designWidth × designHeight`
pixels. Each child has a `placement` `{ x, y, width, height, rotation, z }`
in design pixels. The renderer converts these to **percentages of the
container**, and the container keeps its `aspect-ratio`, so the composition
scales with the viewport without JavaScript. Text keeps its font size (set
a mobile override in the Typography group if needed).

Supported interactions: drag to move, eight resize handles (Shift keeps the
aspect ratio; images always do), rotation handle (Shift snaps to 15°),
arrow-key nudging (Shift ×10), snapping to parent edges/centre and sibling
edges/centres (Alt disables), optional 8 px grid, alignment and distribution,
grouping (a `group` node is itself a freeform container), z-order via
bring forward/backward/front/back.

Per-breakpoint placement: tablet and mobile can override x/y/width/height/
rotation; "Reset to desktop" removes the override. `stackOnMobile` renders
children as a vertical flow below 640 px instead of scaling.

Bounds: positions are clamped by the schema (−5000…10000 px), sizes are
≥1 px, canvases 200–4000 × 40–20000 px. Which components may be placed freely
is declared in the registry (`freeformCapable`); sections, columns, galleries
and navigation stay structured.

## Breakpoints

| Name | Canvas width | CSS |
| --- | --- | --- |
| desktop | 1280 px | base rules |
| tablet | 820 px | `@media (max-width: 1023px)` |
| mobile | 390 px | `@media (max-width: 639px)` |

Overrides cascade desktop → tablet → mobile. Visibility per breakpoint uses
`display: none` inside the matching query. Text styles carry a
`mobileFontSize`.

## Renderer guarantees

- Same HTML/CSS for canvas, preview and publication (only the editor adds
  `data-b-*` attributes and shows hidden nodes).
- `overflow-x: hidden` on the body and `min-width: 0` on flex children
  prevent horizontal scrolling from long words or wide children.
- Images are `max-width: 100%`; galleries and columns collapse to one or two
  columns on small screens.
