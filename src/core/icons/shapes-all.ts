import type { IconNode } from "./types.js";
import { shapes as navigation } from "./generated/shapes/navigation.js";
import { shapes as editing } from "./generated/shapes/editing.js";
import { shapes as selection } from "./generated/shapes/selection.js";
import { shapes as alignment } from "./generated/shapes/alignment.js";
import { shapes as layers } from "./generated/shapes/layers.js";
import { shapes as typography } from "./generated/shapes/typography.js";
import { shapes as adjustments } from "./generated/shapes/adjustments.js";
import { shapes as effects } from "./generated/shapes/effects.js";
import { shapes as colors } from "./generated/shapes/colors.js";
import { shapes as shapesCat } from "./generated/shapes/shapes.js";
import { shapes as structure } from "./generated/shapes/structure.js";
import { shapes as elements } from "./generated/shapes/elements.js";
import { shapes as media } from "./generated/shapes/media.js";
import { shapes as conversion } from "./generated/shapes/conversion.js";
import { shapes as devices } from "./generated/shapes/devices.js";
import { shapes as publishing } from "./generated/shapes/publishing.js";
import { shapes as forms } from "./generated/shapes/forms.js";
import { shapes as communication } from "./generated/shapes/communication.js";
import { shapes as commerce } from "./generated/shapes/commerce.js";
import { shapes as people } from "./generated/shapes/people.js";
import { shapes as time } from "./generated/shapes/time.js";
import { shapes as places } from "./generated/shapes/places.js";
import { shapes as creative } from "./generated/shapes/creative.js";
import { shapes as nature } from "./generated/shapes/nature.js";
import { shapes as status } from "./generated/shapes/status.js";
import { iconProblem } from "./safe.js";

/**
 * Server-side (Node) and test-side resolver with every category loaded synchronously. NOT exported from
 * `core/index.ts` and not imported by the browser bundle, which loads categories on demand (`shapes.ts`).
 * Published pages still embed only the icons a page actually uses.
 */
const ALL: Record<string, readonly IconNode[]> = {};
for (const cat of [navigation, editing, selection, alignment, layers, typography, adjustments, effects, colors, shapesCat, structure, elements, media, conversion, devices, publishing, forms, communication, commerce, people, time, places, creative, nature, status]) {
  for (const [slug, nodes] of Object.entries(cat)) {
    if (iconProblem(nodes) === null) ALL[`binhi.icon.${slug}`] = nodes;
  }
}

export function resolveIconShapeSync(id: string): readonly IconNode[] | undefined {
  return ALL[id];
}

export const ALL_ICON_SHAPES: Readonly<Record<string, readonly IconNode[]>> = ALL;
