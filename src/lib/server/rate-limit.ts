/**
 * Limitador en memoria por clave (IP + correo) para registro e inicio de sesión.
 * Basta para una sola instancia; protege de fuerza bruta sin necesitar Redis.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export function clearRateLimit(key: string) {
  hits.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "local").trim();
}
