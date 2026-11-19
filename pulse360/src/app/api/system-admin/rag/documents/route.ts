import { NextResponse } from "next/server";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const response = await callRagApi(`/collections/${RAG_COLLECTION_ID}/documents`);
    return forwardRagResponse(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the RAG service." },
      { status: 503 },
    );
  }
}
