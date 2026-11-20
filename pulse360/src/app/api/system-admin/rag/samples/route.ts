import { NextResponse } from "next/server";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";
import { callRagApi, forwardRagResponse, ragFailureResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
import { writeAuditEvent } from "@/lib/audit";
import { validateSampleInput } from "@/lib/rag-samples";

export const runtime = "nodejs";

// Samples live in the RAG service's database (rag.evaluation_samples). These routes only
// proxy to it: when it cannot answer they say so, rather than pretending to have stored or
// listed anything.

export async function GET(request: Request) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    const upstreamUrl = `/collections/${RAG_COLLECTION_ID}/samples${category ? `?category=${encodeURIComponent(category)}` : ""}`;
    return await forwardRagResponse(await callRagApi(upstreamUrl));
  } catch (error) {
    return ragFailureResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateSampleInput(body);
  if (!validation.valid || !validation.clean) {
    return NextResponse.json({ error: validation.error || "Invalid sample data." }, { status: 400 });
  }

  const actorId = Number(session.user.id) || null;
  const userIdentifier = session.user.email || session.user.name || "admin";

  try {
    const upstream = await callRagApi(`/collections/${RAG_COLLECTION_ID}/samples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validation.clean,
        created_by: userIdentifier,
      }),
    });

    const data = await upstream.json().catch(() => null);
    if (upstream.ok && data?.id) {
      await writeAuditEvent({
        actorId,
        action: "RAG_SAMPLE_CREATED",
        entityType: "rag_sample",
        metadata: { sampleId: data.id, question: validation.clean.question, category: validation.clean.category },
      }).catch(() => {});
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return ragFailureResponse(error);
  }
}
