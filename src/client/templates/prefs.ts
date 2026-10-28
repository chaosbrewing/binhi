/**
 * Favorites and recently used templates, stored only in this browser and
 * keyed by account id. Nothing about what a person browses or favorites is
 * sent to the server, so there is no activity profile to protect or leak.
 * Every access is wrapped: private windows and blocked storage must not
 * break the page. Prefs are removed on sign-out and account deletion.
 */
const PREFIX = "binhi.templates.v1";
const MAX_FAVORITES = 100;
const MAX_RECENTS = 12;

export interface TemplatePrefs {
  favorites: string[];
  recents: string[];
}

const key = (userId: string) => `${PREFIX}.${userId}`;

export function loadPrefs(userId: string): TemplatePrefs {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return { favorites: [], recents: [] };
    const parsed = JSON.parse(raw) as Partial<TemplatePrefs>;
    const clean = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 80).slice(0, max) : []);
    return { favorites: clean(parsed.favorites, MAX_FAVORITES), recents: clean(parsed.recents, MAX_RECENTS) };
  } catch {
    return { favorites: [], recents: [] };
  }
}

function save(userId: string, prefs: TemplatePrefs): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prefs));
  } catch {
    /* storage unavailable: prefs last for this page view only */
  }
}

export function toggleFavorite(userId: string, prefs: TemplatePrefs, templateId: string): TemplatePrefs {
  const has = prefs.favorites.includes(templateId);
  const favorites = has ? prefs.favorites.filter((f) => f !== templateId) : [templateId, ...prefs.favorites].slice(0, MAX_FAVORITES);
  const next = { ...prefs, favorites };
  save(userId, next);
  return next;
}

export function pushRecent(userId: string, templateId: string): void {
  const prefs = loadPrefs(userId);
  save(userId, { ...prefs, recents: [templateId, ...prefs.recents.filter((r) => r !== templateId)].slice(0, MAX_RECENTS) });
}

export function clearPrefs(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* nothing to clear */
  }
}
