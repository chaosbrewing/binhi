import { eq } from "drizzle-orm";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "../db/client.js";
import { assetBlobs } from "../db/schema.js";

/**
 * Object-storage abstraction for uploaded media. The editor never talks to a
 * provider directly, so the backing store can change (S3-compatible bucket,
 * LIYAB-managed storage) without touching BINHI's editor or renderer.
 */
export interface ObjectStorage {
  readonly name: string;
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Default: bytes live next to the metadata in Postgres. Durable with the database backup. */
export class PostgresBlobStorage implements ObjectStorage {
  readonly name = "postgres";
  constructor(private readonly db: Db) {}
  async put(key: string, data: Buffer): Promise<void> {
    await this.db.insert(assetBlobs).values({ key, data }).onConflictDoUpdate({ target: assetBlobs.key, set: { data } });
  }
  async get(key: string): Promise<Buffer | null> {
    const row = await this.db.select({ data: assetBlobs.data }).from(assetBlobs).where(eq(assetBlobs.key, key)).limit(1);
    return row[0] ? Buffer.from(row[0].data) : null;
  }
  async delete(key: string): Promise<void> {
    await this.db.delete(assetBlobs).where(eq(assetBlobs.key, key));
  }
}

/** Files on a persistent volume. Keys are validated so they can never escape the root. */
export class DiskStorage implements ObjectStorage {
  readonly name = "disk";
  constructor(private readonly root: string) {}
  private resolve(key: string): string {
    if (!/^[A-Za-z0-9_\-/.]+$/.test(key) || key.includes("..")) throw new Error("invalid storage key");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
