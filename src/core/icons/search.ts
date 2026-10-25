import { ICON_LIST, type IconDefinition } from "./registry.js";
import type { IconVariant } from "./render.js";

/**
 * Intent synonyms: what people type → words that appear in icon names/keywords. Kept small and boring on purpose;
 * the per-icon keywords in the catalog carry most of the vocabulary.
 */
export const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  photo: ["camera", "image", "picture"],
  pic: ["image", "picture", "camera"],
  picture: ["image", "photo"],
  remove: ["delete", "trash", "eraser"],
  bin: ["trash", "delete"],
  garbage: ["trash", "delete"],
  cut: ["scissors"],
  gear: ["settings", "cog"],
  cog: ["settings"],
  preferences: ["settings"],
  buy: ["cart", "shopping", "purchase"],
  shop: ["store", "cart", "shopping"],
  money: ["wallet", "payment", "price", "card"],
  pay: ["card", "wallet", "payment"],
  mail: ["email", "envelope", "letter"],
  letter: ["email", "mail", "envelope"],
  envelope: ["email", "mail"],
  idea: ["lightbulb", "tip"],
  light: ["lightbulb", "sun", "brightness"],
  like: ["heart", "star", "favorite"],
  love: ["heart"],
  favourite: ["favorite", "star", "heart"],
  favorite: ["star", "heart"],
  location: ["pin", "map", "place"],
  address: ["pin", "map", "location"],
  chat: ["message", "bubble", "comment"],
  talk: ["message", "chat", "phone"],
  security: ["shield", "lock", "key"],
  safe: ["shield", "lock"],
  password: ["key", "lock"],
  time: ["clock", "calendar", "timer"],
  date: ["calendar"],
  pdf: ["file", "document"],
  zip: ["compress", "archive", "file"],
  shrink: ["compress", "reduce"],
  mobile: ["smartphone", "phone", "device"],
  computer: ["desktop", "laptop", "monitor"],
  pc: ["desktop", "laptop", "monitor"],
  web: ["globe", "website", "internet"],
  internet: ["globe", "web"],
  website: ["page", "globe", "browser"],
  weather: ["sun", "cloud", "moon"],
  draw: ["pen", "brush", "pencil"],
  paint: ["brush", "palette", "bucket"],
  colour: ["color", "palette"],
  color: ["palette", "paint", "swatch"],
  text: ["type", "font", "paragraph"],
  font: ["type", "text"],
  save: ["disk", "store"],
  undo: ["revert", "back"],
  correct: ["check", "success", "tick"],
  tick: ["check", "success"],
  wrong: ["error", "close", "cross"],
  alert: ["warning", "bell", "notification"],
  help: ["question", "support", "info"],
  user: ["person", "account", "profile"],
  people: ["users", "team", "group"],
  group: ["users", "team", "people"],
  trophy: ["milestone", "flag"],
  music: ["note", "audio", "headphones"],
  movie: ["video", "film", "clapperboard"],
  video: ["film", "movie", "camera"],
  download: ["save", "down"],
  upload: ["send", "up"],
  share: ["send", "social", "link"],
  link: ["url", "hyperlink", "chain"],
  publish: ["launch", "deploy", "rocket"],
  launch: ["publish", "rocket"],
  stats: ["analytics", "chart", "graph"],
  graph: ["analytics", "chart"],
};

interface IndexedIcon {
  def: IconDefinition;
  name: string[];
  slug: string;
  keywords: string[];
  tags: string[];
  category: string[];
}

const tokenize = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const INDEX: readonly IndexedIcon[] = ICON_LIST.map((def) => ({
  def,
  name: tokenize(def.name),
  slug: def.slug,
  keywords: [...def.keywords],
  tags: [...def.tags],
  category: tokenize(def.categoryName),
}));

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Best score of one query term against one icon (0 = no match). */
function scoreTerm(icon: IndexedIcon, term: string, exact: boolean): number {
  const w = exact ? 1 : 0.4; // synonym hits rank below literal hits
  if (icon.slug === term) return 100 * w;
  if (icon.name.includes(term)) return 80 * w;
  if (icon.name.some((n) => n.startsWith(term))) return 65 * w;
  if (icon.keywords.includes(term)) return 45 * w;
  if (term.length >= 2 && icon.keywords.some((k) => k.startsWith(term))) return 30 * w;
  if (icon.tags.includes(term)) return 22 * w;
  if (term.length >= 3 && icon.tags.some((k) => k.startsWith(term))) return 14 * w;
  if (icon.category.includes(term)) return 6 * w;
  if (term.length >= 5 && (icon.name.some((n) => withinOneEdit(n, term)) || icon.keywords.some((k) => withinOneEdit(k, term)))) return 12 * w;
  return 0;
}

export interface IconSearchOptions {
  category?: string;
  variant?: IconVariant;
  limit?: number;
  /** Restrict the search to these ids (favorites, recents). */
  within?: readonly string[];
}

/** Ranked search over names, categories, keywords and intent synonyms; every typed word must match something. */
export function searchIcons(query: string, options: IconSearchOptions = {}): IconDefinition[] {
  const terms = tokenize(query).slice(0, 8);
  const within = options.within ? new Set(options.within) : undefined;
  const scored: { def: IconDefinition; score: number }[] = [];
  for (const icon of INDEX) {
    const def = icon.def;
    if (options.category && def.category !== options.category) continue;
    if (options.variant && !def.variants.includes(options.variant)) continue;
    if (within && !within.has(def.id)) continue;
    let total = 0;
    let ok = true;
    for (const term of terms) {
      let best = scoreTerm(icon, term, true);
      for (const alt of SEARCH_SYNONYMS[term] ?? []) best = Math.max(best, scoreTerm(icon, alt, false));
      if (best === 0) {
        ok = false;
        break;
      }
      total += best;
    }
    if (ok) scored.push({ def, score: total });
  }
  if (terms.length) scored.sort((a, b) => b.score - a.score || a.def.number - b.def.number);
  const list = scored.map((s) => s.def);
  return options.limit ? list.slice(0, options.limit) : list;
}
