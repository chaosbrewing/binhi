import { hasIcon } from "../../core/icons/index.js";

/** Per-browser convenience lists. Never authoritative: ids are re-validated against the registry on every read. */
export const FAVORITES_KEY = "binhi.icons.favorites";
export const RECENTS_KEY = "binhi.icons.recents";
export const MAX_RECENTS = 24;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // blocked storage (private window, disabled cookies)
  }
}

export function readIconList(key: string, storage: StorageLike | null = defaultStorage()): string[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(hasIcon))];
  } catch {
    return [];
  }
}

export function writeIconList(key: string, ids: readonly string[], storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(ids));
  } catch {
    /* quota or blocked: the list simply isn't remembered */
  }
}

export function toggleFavorite(favorites: readonly string[], id: string): string[] {
  if (!hasIcon(id)) return [...favorites];
  return favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites];
}

export function pushRecent(recents: readonly string[], id: string): string[] {
  if (!hasIcon(id)) return [...recents];
  return [id, ...recents.filter((x) => x !== id)].slice(0, MAX_RECENTS);
}
