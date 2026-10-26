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
import { getIcon } from "./registry.js";
import { shapes as c01 } from "./canonical/shapes/c01.js";
import { shapes as c02 } from "./canonical/shapes/c02.js";
import { shapes as c03 } from "./canonical/shapes/c03.js";
import { shapes as c04 } from "./canonical/shapes/c04.js";
import { shapes as c05 } from "./canonical/shapes/c05.js";
import { shapes as c06 } from "./canonical/shapes/c06.js";
import { shapes as c07 } from "./canonical/shapes/c07.js";
import { shapes as c08 } from "./canonical/shapes/c08.js";
import { shapes as c09 } from "./canonical/shapes/c09.js";
import { shapes as c10 } from "./canonical/shapes/c10.js";
import { shapes as c11 } from "./canonical/shapes/c11.js";
import { shapes as c12 } from "./canonical/shapes/c12.js";
import { shapes as c13 } from "./canonical/shapes/c13.js";
import { shapes as c14 } from "./canonical/shapes/c14.js";
import { shapes as c15 } from "./canonical/shapes/c15.js";
import { shapes as c16 } from "./canonical/shapes/c16.js";
import { shapes as c17 } from "./canonical/shapes/c17.js";
import { shapes as c18 } from "./canonical/shapes/c18.js";
import { shapes as c19 } from "./canonical/shapes/c19.js";
import { shapes as c20 } from "./canonical/shapes/c20.js";
import { shapes as c21 } from "./canonical/shapes/c21.js";
import { shapes as c22 } from "./canonical/shapes/c22.js";
import { shapes as c23 } from "./canonical/shapes/c23.js";
import { shapes as c24 } from "./canonical/shapes/c24.js";
import { shapes as c25 } from "./canonical/shapes/c25.js";

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

export const LEGACY_ICON_SHAPES: Readonly<Record<string, readonly IconNode[]>> = { ...ALL };
for (const cat of [c01,c02,c03,c04,c05,c06,c07,c08,c09,c10,c11,c12,c13,c14,c15,c16,c17,c18,c19,c20,c21,c22,c23,c24,c25]) {
  for (const [slug, nodes] of Object.entries(cat)) {
    const id = `binhi.icon.${slug}`;
    const problem = iconProblem(nodes);
    if (problem) throw new Error(`Invalid canonical geometry ${id}: ${problem}`);
    if (ALL[id] && JSON.stringify(ALL[id]) !== JSON.stringify(nodes)) throw new Error(`Legacy geometry changed: ${id}`);
    ALL[id] = nodes;
  }
}
export function resolveIconShapeSync(id: string): readonly IconNode[] | undefined {
  return ALL[getIcon(id)?.id ?? id];
}

export const ALL_ICON_SHAPES: Readonly<Record<string, readonly IconNode[]>> = ALL;
