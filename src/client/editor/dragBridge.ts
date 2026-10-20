/**
 * Lets the side panels hand a drag (new element, saved section, image) to
 * the canvas without the two knowing about each other's DOM.
 */
export const dragBridge: {
  hover: ((clientX: number, clientY: number) => void) | null;
  drop: ((clientX: number, clientY: number) => boolean) | null;
  cancel: (() => void) | null;
} = { hover: null, drop: null, cancel: null };
