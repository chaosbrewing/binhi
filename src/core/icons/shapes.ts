import type { IconNode } from "./types.js";
import { getIcon } from "./registry.js";
import { iconProblem } from "./safe.js";

type ShapeModule = { shapes: Readonly<Record<string, readonly IconNode[]>> };

/**
 * One lazy chunk per category: the browser only downloads the categories a person actually opens or uses.
 * (Literal import() paths so the bundler can split them. The server uses `shapes-all.ts` instead.)
 */
const LOADERS: Readonly<Record<string, () => Promise<ShapeModule>>> = {
  navigation: () => import("./generated/shapes/navigation.js"),
  editing: () => import("./generated/shapes/editing.js"),
  selection: () => import("./generated/shapes/selection.js"),
  alignment: () => import("./generated/shapes/alignment.js"),
  layers: () => import("./generated/shapes/layers.js"),
  typography: () => import("./generated/shapes/typography.js"),
  adjustments: () => import("./generated/shapes/adjustments.js"),
  effects: () => import("./generated/shapes/effects.js"),
  colors: () => import("./generated/shapes/colors.js"),
  shapes: () => import("./generated/shapes/shapes.js"),
  structure: () => import("./generated/shapes/structure.js"),
  elements: () => import("./generated/shapes/elements.js"),
  media: () => import("./generated/shapes/media.js"),
  conversion: () => import("./generated/shapes/conversion.js"),
  devices: () => import("./generated/shapes/devices.js"),
  publishing: () => import("./generated/shapes/publishing.js"),
  forms: () => import("./generated/shapes/forms.js"),
  communication: () => import("./generated/shapes/communication.js"),
  commerce: () => import("./generated/shapes/commerce.js"),
  people: () => import("./generated/shapes/people.js"),
  time: () => import("./generated/shapes/time.js"),
  places: () => import("./generated/shapes/places.js"),
  creative: () => import("./generated/shapes/creative.js"),
  nature: () => import("./generated/shapes/nature.js"),
  status: () => import("./generated/shapes/status.js"),
};

export const SHAPE_CATEGORIES: readonly string[] = Object.keys(LOADERS);

const cache = new Map<string, readonly IconNode[]>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

/** Synchronous lookup of an already-loaded icon (undefined until its category chunk has loaded). */
export function getLoadedShape(id: string): readonly IconNode[] | undefined {
  return cache.get(id);
}

/** Subscribe to "a category finished loading" (used to re-render icons that were waiting). */
export function onShapesLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function store(category: string, shapes: Readonly<Record<string, readonly IconNode[]>>): void {
  for (const [slug, nodes] of Object.entries(shapes)) {
    const problem = iconProblem(nodes);
    if (problem) continue; // never cache geometry that fails the allowlist
    cache.set(`binhi.icon.${slug}`, nodes);
  }
  void category;
}

/** Loads the category chunk that holds `id` (once) and resolves when its geometry is available. */
export function ensureCategoryLoaded(category: string): Promise<void> {
  const loader = LOADERS[category];
  if (!loader) return Promise.reject(new Error(`unknown icon category ${category}`));
  let p = inflight.get(category);
  if (!p) {
    p = loader().then((mod) => {
      store(category, mod.shapes);
      listeners.forEach((fn) => fn());
    });
    p.catch(() => inflight.delete(category)); // allow a retry after a network failure
    inflight.set(category, p);
  }
  return p;
}

export async function loadIconShape(id: string): Promise<readonly IconNode[] | undefined> {
  const def = getIcon(id);
  if (!def) return undefined;
  if (!cache.has(id)) await ensureCategoryLoaded(def.category);
  return cache.get(id);
}

/** Loads every category an icon list needs. */
export async function loadIconShapes(ids: readonly string[]): Promise<void> {
  const cats = new Set<string>();
  for (const id of ids) {
    const def = getIcon(id);
    if (def && !cache.has(id)) cats.add(def.category);
  }
  await Promise.all([...cats].map(ensureCategoryLoaded));
}
