import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";

export const runtime = "nodejs";

async function requireSystemAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "SYSTEM_ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireSystemAdmin())) {
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
