/**
 * In-memory rate limiter by key (IP + email) for signup/login. Good enough
 * for a single instance; protects against brute force without Redis. Also
 * reused for anything that costs money or CPU rather than guessing attempts
 * (e.g. score recognition), with its own window and max.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export interface RateLimit {
  /** How many are allowed in the window. */
  max: number;
  windowMs: number;
}

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, now = Date.now(), limit: RateLimit = { max: MAX_ATTEMPTS, windowMs: WINDOW_MS }): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + limit.windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    return false;
  }
  entry.count++;
  return entry.count > limit.max;
}

export function clearRateLimit(key: string) {
  hits.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "local").trim();
}
