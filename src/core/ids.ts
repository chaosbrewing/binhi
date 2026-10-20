// Stable identifiers for documents, pages and nodes. No dependency on
// node:crypto or the DOM so the same code runs in the editor and the server.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
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
