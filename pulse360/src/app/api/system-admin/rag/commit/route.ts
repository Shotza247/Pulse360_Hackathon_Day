import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";

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

  try {
    const response = await callRagApi(`/collections/${RAG_COLLECTION_ID}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview_id: body.preview_id, approved: true }),
    });
    return forwardRagResponse(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the RAG service." },
      { status: 503 },
    );
  }
}
