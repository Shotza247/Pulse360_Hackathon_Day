import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  callRagApi,
  forwardRagResponse,
  isRagTimeout,
  RAG_CATEGORIES,
  RAG_COLLECTION_ID,
  RAG_COMMIT_TIMEOUT_MS,
} from "@/lib/rag-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.preview_id !== "string" || body.approved !== true) {
    return NextResponse.json(
      { error: "Approve the preview before starting embedding." },
      { status: 400 },
    );
  }

  const category = body.category ?? "platform";
  if (!(RAG_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Choose a valid FAQ category." }, { status: 400 });
  }

  try {
    const response = await callRagApi(
      `/collections/${RAG_COLLECTION_ID}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_id: body.preview_id, approved: true, category }),
      },
      RAG_COMMIT_TIMEOUT_MS,
    );
    return forwardRagResponse(response);
  } catch (error) {
    if (isRagTimeout(error)) {
      return NextResponse.json(
        {
          error:
            "Embedding is taking longer than expected. It may still finish; refresh the document list before retrying.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the RAG service." },
      { status: 503 },
    );
  }
}
