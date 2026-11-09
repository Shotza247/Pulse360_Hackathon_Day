import { isIP } from "node:net";

/**
 * Best-effort visitor IP behind Render's proxy. Uses the first `X-Forwarded-For`
 * entry and returns null unless it is a valid IP address, so the value is safe to
 * forward as a rate-limit key.
 *
 * Caveat: a client can prepend its own `X-Forwarded-For` entry. That only lets a
 * visitor pick their own rate-limit bucket; it cannot block other visitors.
 */
export function getClientIp(headers: Pick<Headers, "get">): string | null {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first && isIP(first) !== 0 ? first : null;
}
