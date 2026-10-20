/**
 * In-memory sliding-window rate limiter. Good enough for a single-process
 * deployment (the standalone BINHI host); swap for a shared store when the
 * app runs on more than one instance.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true when the request is allowed. */
  check(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 50_000) this.prune(now);
    return true;
  }

  prune(now = Date.now()): void {
    const since = now - this.windowMs;
    for (const [k, v] of this.hits) {
      const kept = v.filter((t) => t > since);
      if (kept.length) this.hits.set(k, kept);
      else this.hits.delete(k);
    }
  }
}
