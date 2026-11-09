import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";

export const runtime = "nodejs";

// Public endpoint for the landing-page FAQ assistant. The browser never talks to
// the RAG service directly; this route pins the collection and forwards only the
// question. Errors use { detail: { message } } to match the RAG service's shape.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 800) {
    return NextResponse.json(
      { detail: { message: "Ask a question between 2 and 800 characters." } },
      { status: 400 },
    );
  }

  // The RAG API rate-limits per IP. This server is its only caller, so name the
  // real visitor; the RAG API honours this header only when our query key is valid.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const clientIp = getClientIp(request.headers);
  if (clientIp) headers["X-Forwarded-Client-IP"] = clientIp;

  try {
    const response = await callRagApi("/ask", {
      method: "POST",
      headers,
      body: JSON.stringify({ question, collection_id: RAG_COLLECTION_ID }),
    });
    return forwardRagResponse(response);
  } catch {
    return NextResponse.json(
      { detail: { message: "The assistant is temporarily unavailable." } },
      { status: 503 },
    );
  }
}
