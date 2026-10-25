// Stable identifiers for documents, pages and nodes. No dependency on
// node:crypto or the DOM so the same code runs in the editor and the server.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Deterministic id source for replaying an operation. The editor applies an operation locally and later sends it to
 * the server, which applies it again; both runs must mint the same ids (for composite components, duplicates,
 * pastes, groups, pages, reusable sections) or later edits that refer to the new elements would not resolve.
 * `withIdSeed` makes every `newId` call inside `fn` draw from a PRNG derived from `seed`.
 */
let seeded: (() => number) | null = null;

function seedToPrng(seed: string): () => number {
  // xmur3 string hash → mulberry32 PRNG (small, well-known, deterministic across platforms)
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    a = (a + ((h ^= h >>> 16) >>> 0) + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function withIdSeed<T>(seed: string | undefined, fn: () => T): T {
  if (!seed) return fn();
  const previous = seeded;
  seeded = seedToPrng(seed);
  try {
    return fn();
  } finally {
    seeded = previous;
  }
}

export const ID_SEED_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;

/** A fresh random seed for one operation. */
export function newIdSeed(): string {
  return newId("s", 16).slice(2);
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (seeded) {
    for (let i = 0; i < n; i++) out[i] = Math.floor(seeded() * 256);
    return out;
  }
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export function newId(prefix: string, length = 10): string {
  const bytes = randomBytes(length);
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  return `${prefix}_${s}`;
}

export const ID_PATTERN = /^[a-z]{1,8}_[a-z0-9]{6,24}$/;
