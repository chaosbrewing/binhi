import type { Db } from "./db/client.js";
import { auditLog } from "./db/schema.js";
import { newId } from "../core/ids.js";

export async function audit(db: Db, entry: { actorId?: string | null; siteId?: string | null; action: string; details?: Record<string, unknown>; ip?: string }): Promise<void> {
  await db.insert(auditLog).values({ id: newId("aud"), actorId: entry.actorId ?? null, siteId: entry.siteId ?? null, action: entry.action, details: entry.details ?? {}, ip: entry.ip });
}
