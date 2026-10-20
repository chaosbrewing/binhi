import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { newId } from "../../core/ids.js";

export const SESSION_COOKIE = "binhi_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const TOUCH_INTERVAL_MS = 1000 * 60 * 10;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export class SessionService {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
  ) {}

  private hash(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("hex");
  }

  async create(userId: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db.insert(sessions).values({ id: newId("sess"), userId, tokenHash: this.hash(token), expiresAt, userAgent: userAgent?.slice(0, 300) });
    return { token, expiresAt };
  }

  async resolve(token: string | undefined): Promise<{ user: AuthUser; sessionId: string } | null> {
    if (!token || token.length < 20 || token.length > 200) return null;
    const rows = await this.db
      .select({ sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt, id: users.id, email: users.email, displayName: users.displayName, deletedAt: users.deletedAt })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, this.hash(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || row.deletedAt) return null;
    if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));
    }
    return { user: { id: row.id, email: row.email, displayName: row.displayName }, sessionId: row.sessionId };
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.delete(sessions).where(eq(sessions.tokenHash, this.hash(token)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
