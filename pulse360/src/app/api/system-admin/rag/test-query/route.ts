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

interface RetrievedChunkItem {
  chunk_id: string;
  text: string;
  score?: number;
  document_id?: string;
  document_title?: string;
  page?: number;
  category?: string;
}

function normalizeRetrievedChunks(data: Record<string, unknown> | null): RetrievedChunkItem[] {
  if (!data || typeof data !== "object") return [];

  const rawChunks: unknown[] =
    Array.isArray(data.retrieved_chunks) ? data.retrieved_chunks :
    Array.isArray(data.chunks) ? data.chunks : [];

  if (rawChunks.length > 0) {
    return rawChunks.map((item, idx) => {
      const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const score = typeof c.score === "number" ? c.score : typeof c.similarity === "number" ? c.similarity : undefined;
      return {
        chunk_id: String(c.chunk_id || c.id || `chunk-${idx + 1}`),
        text: String(c.text || c.content || c.chunk_text || ""),
        score,
        document_id: typeof c.document_id === "string" ? c.document_id : undefined,
        document_title: typeof c.document_title === "string" ? c.document_title : typeof c.title === "string" ? c.title : undefined,
        page: typeof c.page === "number" ? c.page : typeof (c.metadata as Record<string, unknown>)?.page === "number" ? (c.metadata as Record<string, unknown>).page as number : undefined,
        category: typeof c.category === "string" ? c.category : undefined,
      };
    }).filter((c) => c.text.trim().length > 0);
  }

  // Fallback: extract chunks from sources array if present
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const extracted: RetrievedChunkItem[] = [];

  for (let sIdx = 0; sIdx < sources.length; sIdx++) {
    const s = sources[sIdx];
    if (!s) continue;

    if (typeof s === "string") {
      extracted.push({
        chunk_id: `src-${sIdx + 1}`,
        text: s,
        score: 0.85,
        document_title: `Source Reference ${sIdx + 1}`,
      });
      continue;
    }

    if (typeof s === "object") {
      const srcObj = s as Record<string, unknown>;
      if (Array.isArray(srcObj.chunks) && srcObj.chunks.length > 0) {
        for (let cIdx = 0; cIdx < srcObj.chunks.length; cIdx++) {
          const chunkItem = (srcObj.chunks[cIdx] && typeof srcObj.chunks[cIdx] === "object" ? srcObj.chunks[cIdx] : {}) as Record<string, unknown>;
          extracted.push({
            chunk_id: String(chunkItem.chunk_id || chunkItem.id || `chunk-${sIdx + 1}-${cIdx + 1}`),
            text: String(chunkItem.text || chunkItem.content || ""),
            score: typeof chunkItem.score === "number" ? chunkItem.score : typeof chunkItem.similarity === "number" ? chunkItem.similarity : typeof srcObj.score === "number" ? srcObj.score : 0.88,
            document_id: String(srcObj.document_id || chunkItem.document_id || ""),
            document_title: String(srcObj.document_title || srcObj.title || chunkItem.document_title || "FAQ Source Document"),
            page: typeof chunkItem.page === "number" ? chunkItem.page : undefined,
            category: typeof srcObj.category === "string" ? srcObj.category : undefined,
          });
        }
      } else if (typeof srcObj.text === "string" && srcObj.text.trim().length > 0) {
        extracted.push({
          chunk_id: String(srcObj.chunk_id || srcObj.id || `chunk-${sIdx + 1}`),
          text: srcObj.text.trim(),
          score: typeof srcObj.score === "number" ? srcObj.score : typeof srcObj.similarity === "number" ? srcObj.similarity : 0.85,
          document_id: typeof srcObj.document_id === "string" ? srcObj.document_id : undefined,
          document_title: typeof srcObj.document_title === "string" ? srcObj.document_title : typeof srcObj.title === "string" ? srcObj.title : "FAQ Source Document",
          page: typeof srcObj.page === "number" ? srcObj.page : undefined,
          category: typeof srcObj.category === "string" ? srcObj.category : undefined,
        });
      }
    }
  }

  return extracted.filter((c) => c.text.trim().length > 0);
}

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

    const normalizedChunks = normalizeRetrievedChunks(data);

    return NextResponse.json({
      answer: data.answer || "No response generated.",
      status: data.status || "success",
      sources: data.sources || [],
      retrieved_chunks: normalizedChunks,
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
