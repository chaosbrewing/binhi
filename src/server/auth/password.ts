import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}
const N = 16384, r = 8, p = 1, KEYLEN = 64;

/** scrypt password hashing; format: scrypt$N$r$p$salt$hash (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, "base64url");
  const expected = Buffer.from(hashB64!, "base64url");
  const key = await scrypt(password.normalize("NFKC"), salt, expected.length, { N: Number(n), r: Number(rr), p: Number(pp) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
