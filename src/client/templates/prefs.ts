/**
 * Recently used templates stay in this browser only, keyed by account id:
 * what a person looks at is never sent to the server. Favorites are an
 * explicit choice and live in the person's account (see the favorites
 * endpoints); the only thing left here is a one-time hand-over of favorites
 * saved by an earlier version of this page. Every access is wrapped: private
 * windows and blocked storage must not break the page. Removed on sign-out
 * and account deletion.
 */
const PREFIX = "binhi.templates.v1";
const MAX_RECENTS = 12;

export interface TemplatePrefs {
  /** Mirrors the account's favorites (loaded from the server). */
  favorites: string[];
  recents: string[];
}

const key = (userId: string) => `${PREFIX}.${userId}`;

function read(userId: string): { favorites?: unknown; recents?: unknown } | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as { favorites?: unknown; recents?: unknown }) : null;
  } catch {
    return null;
  }
}

const clean = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, max) : []);

export function loadRecents(userId: string): string[] {
  return clean(read(userId)?.recents, MAX_RECENTS);
}

export function pushRecent(userId: string, templateId: string): void {
  const recents = [templateId, ...loadRecents(userId).filter((r) => r !== templateId)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(key(userId), JSON.stringify({ recents }));
  } catch {
    /* storage unavailable: recents last for this page view only */
  }
}

/** Favorites saved in this browser by the earlier, browser-only version. Newest first. */
export function legacyFavorites(userId: string): string[] {
  return clean(read(userId)?.favorites, 100);
}

/** Forget the browser-only favorites once they are safely in the account. */
export function clearLegacyFavorites(userId: string): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ recents: loadRecents(userId) }));
  } catch {
    /* nothing to clear */
  }
}

export function clearPrefs(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* nothing to clear */
  }
}
