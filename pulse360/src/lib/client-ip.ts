import { isIP } from "node:net";

/**
 * Visitor IP behind trusted reverse proxies.
 *
 * Each proxy appends the address it received the request from to `X-Forwarded-For`,
 * so the only entries a client cannot forge are the ones at the END of the list. A
 * client can freely prepend its own values, which is why the FIRST entry must not be
 * trusted. `trustedProxyHops` is how many proxies we run behind (Render's load
 * balancer = 1; add one if a CDN such as Cloudflare also sits in front). The visitor
 * is the entry that many places from the end.
 *
 * Returns null unless the selected entry is a valid IP address, so the result is safe
 * to use as a rate-limit key and to forward as a header.
 */
export function getClientIp(headers: Pick<Headers, "get">, trustedProxyHops = 1): string | null {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = entries[entries.length - trustedProxyHops];
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/** Reads `TRUSTED_PROXY_HOPS`; falls back to 1 for anything that is not a positive integer. */
export function getTrustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(hops) && hops >= 1 ? hops : 1;
}
