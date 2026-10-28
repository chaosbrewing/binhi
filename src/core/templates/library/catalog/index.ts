import type { Manifest } from "../index.js";

/**
 * The shipped template catalog. A record is added here only together with its
 * content, a generated preview and an inventory entry (see ../inventory.ts);
 * the catalog tests fail otherwise. It is empty on purpose until M4: no
 * placeholder records are created to make a number look bigger.
 */
export const CATALOG: readonly Manifest[] = [];
