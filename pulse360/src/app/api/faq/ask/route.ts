import { NextResponse } from "next/server";
import { getClientIp, getTrustedProxyHops } from "@/lib/client-ip";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  callRagApi,
  forwardRagResponse,
  isRagTimeout,
  RAG_ASK_TIMEOUT_MS,
  RAG_COLLECTION_ID,
} from "@/lib/rag-api";

export const runtime = "nodejs";

// Every answer spends embedding and LLM credits, so cap both per visitor and in total.
const limiter = createRateLimiter({ perKeyLimit: 10, globalLimit: 300, windowMs: 60_000 });

// Public endpoint for the landing-page FAQ assistant. The browser never talks to
// the RAG service directly; this route pins the collection and forwards only the
// question. Errors use { detail: { message } } to match the RAG service's shape.
export async function POST(request: Request) {
  const clientIp = getClientIp(request.headers, getTrustedProxyHops());
  const limit = limiter.check(clientIp ?? "unknown");
  if (!limit.allowed) {
    return NextResponse.json(
      { detail: { message: "Too many questions. Please wait a moment and try again." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 800) {
    return NextResponse.json(
      { detail: { message: "Ask a question between 2 and 800 characters." } },
      { status: 400 },
    );
  }

  // The RAG API also rate-limits per IP. This server is its only caller, so name the
  // real visitor; the RAG API honours this header only when our query key is valid.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientIp) headers["X-Forwarded-Client-IP"] = clientIp;

  try {
    const response = await callRagApi(
      "/ask",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ question, collection_id: RAG_COLLECTION_ID }),
      },
      RAG_ASK_TIMEOUT_MS,
    );
    return forwardRagResponse(response);
  } catch (error) {
    if (isRagTimeout(error)) {
      return NextResponse.json(
        { detail: { message: "The assistant took too long to answer. Please try again." } },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { detail: { message: "The assistant is temporarily unavailable." } },
      { status: 503 },
    );
  }
}
