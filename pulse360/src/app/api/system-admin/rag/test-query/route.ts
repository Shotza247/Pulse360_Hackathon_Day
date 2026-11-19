import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  callRagApi,
  forwardRagResponse,
  isRagTimeout,
  RAG_ASK_TIMEOUT_MS,
  RAG_CATEGORIES,
  RAG_COLLECTION_ID,
} from "@/lib/rag-api";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";

export const runtime = "nodejs";

// Dedicated rate limiter for admin testing to prevent accidental LLM credit run-away.
const adminTesterLimiter = createRateLimiter({ perKeyLimit: 30, globalLimit: 200, windowMs: 60_000 });

export async function POST(request: Request) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = session.user.id || session.user.email || "admin";
  const limit = adminTesterLimiter.check(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Admin test limit reached. Please wait a moment before sending more queries." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 1000) {
    return NextResponse.json(
      { error: "Provide a question between 2 and 1000 characters." },
      { status: 400 },
    );
  }

  const category = typeof body?.category === "string" && body.category.trim() !== "" ? body.category.trim() : undefined;
  if (category && !(RAG_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid FAQ category selected." }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    // Attempt the dedicated admin endpoint which returns full retrieval chunk diagnostics
    const testResponse = await callRagApi(
      `/collections/${RAG_COLLECTION_ID}/test-query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category }),
      },
      RAG_ASK_TIMEOUT_MS,
    );

    if (testResponse.status !== 404) {
      return forwardRagResponse(testResponse);
    }

    // Upstream fallback if the standalone /test-query route is not yet deployed:
    // Call the standard /ask route and wrap the response with timing diagnostics
    const askResponse = await callRagApi(
      "/ask",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, collection_id: RAG_COLLECTION_ID, category }),
      },
      RAG_ASK_TIMEOUT_MS,
    );

    const data = await askResponse.json().catch(() => null);
    const duration = Date.now() - startTime;

    if (!askResponse.ok) {
      return NextResponse.json(
        {
          error: data?.detail?.message || data?.error || "Failed to retrieve an answer from the assistant.",
          timing_ms: duration,
        },
        { status: askResponse.status },
      );
    }

    return NextResponse.json({
      answer: data.answer || "No response generated.",
      status: data.status || "success",
      sources: data.sources || [],
      retrieved_chunks: data.retrieved_chunks || data.chunks || [],
      timing_ms: data.timing_ms ?? duration,
      request_id: data.request_id,
      category: category ?? "all",
      collection_id: RAG_COLLECTION_ID,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    if (isRagTimeout(error)) {
      return NextResponse.json(
        { error: "The request timed out. The RAG service took longer than 60 seconds to answer.", timing_ms: duration },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reach the companion RAG service.",
        timing_ms: duration,
      },
      { status: 503 },
    );
  }
}
