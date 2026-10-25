export * from "./types.js";
export * from "./registry.js";
export * from "./render.js";
// search.ts is deliberately NOT re-exported: it carries the search vocabulary and is imported only by the icon browser.
export * from "./shapes.js";
export * from "./spec.js";
export { iconProblem, iconNodeProblem, isClosedNode } from "./safe.js";
