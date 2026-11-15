import { NextResponse } from "next/server";
import { getClientIp, getTrustedProxyHops } from "@/lib/client-ip";
import { createRateLimiter } from "@/lib/rate-limit";
import { callRagApi, RAG_ASK_TIMEOUT_MS } from "@/lib/rag-api";

export const runtime = "nodejs";

// No model credits are spent here, but keep the route from being used to hammer the RAG API.
const limiter = createRateLimiter({ perKeyLimit: 5, globalLimit: 60, windowMs: 60_000 });

// However many visitors load the page, ping the RAG API at most once per interval.
const WARM_INTERVAL_MS = 2 * 60_000;
let lastWarmAt = Number.NEGATIVE_INFINITY;

// Public endpoint the landing page calls when the assistant pop-up appears. It wakes the
// RAG API (which may be asleep after idle time) so the first real question is faster.
// The ping runs in the background; the visitor never waits on it.
export async function POST(request: Request) {
  const clientIp = getClientIp(request.headers, getTrustedProxyHops());
  if (!limiter.check(clientIp ?? "unknown").allowed) {
    return new NextResponse(null, { status: 429 });
  }

  const now = Date.now();
  if (now - lastWarmAt >= WARM_INTERVAL_MS) {
    lastWarmAt = now;
    callRagApi("/health", { method: "GET" }, RAG_ASK_TIMEOUT_MS).catch(() => {
      // Best effort. Allow the next visitor to retry sooner after a failed wake-up.
      lastWarmAt = Number.NEGATIVE_INFINITY;
    });
  }

  return new NextResponse(null, { status: 202 });
}
