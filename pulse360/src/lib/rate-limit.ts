/**
 * In-memory fixed-window rate limiter for public routes.
 *
 * State lives in the Node process, so it is per instance and resets on restart. That
 * suits Pulse360's single Render web service; if the app is scaled out, move the
 * counters to shared storage. Two layers apply to every request:
 *
 * - a per-key limit (key = visitor IP), which stops one visitor flooding the route;
 * - a global limit across all keys, which caps total spend even if a visitor rotates
 *   forged IPs to get a fresh per-key bucket.
 */
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  check(key: string, now?: number): RateLimitResult;
};

const OVERFLOW_KEY = "__overflow__";

export function createRateLimiter(options: {
  perKeyLimit: number;
  globalLimit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const { perKeyLimit, globalLimit, windowMs, maxKeys = 10_000 } = options;
  let windowStart = Number.NEGATIVE_INFINITY; // the first request always opens a window
  let globalCount = 0;
  const counts = new Map<string, number>();

  return {
    check(key, now = Date.now()) {
      if (now - windowStart >= windowMs) {
        windowStart = now;
        globalCount = 0;
        counts.clear();
      }
      const denied = {
        allowed: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
      };

      // Bound memory: once the table is full, unseen keys share one overflow bucket.
      const bucket = counts.has(key) || counts.size < maxKeys ? key : OVERFLOW_KEY;
      const used = counts.get(bucket) ?? 0;
      if (globalCount >= globalLimit || used >= perKeyLimit) return denied;

      counts.set(bucket, used + 1);
      globalCount += 1;
      return { allowed: true };
    },
  };
}
