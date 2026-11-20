import { NextResponse } from "next/server";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";
import { callRagApi, forwardRagResponse, isRagDocumentId, ragFailureResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
import { writeAuditEvent } from "@/lib/audit";
import { validateSampleInput } from "@/lib/rag-samples";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || !isRagDocumentId(id)) {
    return NextResponse.json({ error: "A valid sample ID is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateSampleInput(body);
  if (!validation.valid || !validation.clean) {
    return NextResponse.json({ error: validation.error || "Invalid sample data." }, { status: 400 });
  }

  const actorId = Number(session.user.id) || null;

  try {
    const upstream = await callRagApi(`/collections/${RAG_COLLECTION_ID}/samples/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.clean),
    });

    if (upstream.ok) {
      await writeAuditEvent({
        actorId,
        action: "RAG_SAMPLE_UPDATED",
        entityType: "rag_sample",
        metadata: { sampleId: id, question: validation.clean.question, category: validation.clean.category },
      }).catch(() => {});
    }
    return await forwardRagResponse(upstream);
  } catch (error) {
    return ragFailureResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || !isRagDocumentId(id)) {
    return NextResponse.json({ error: "A valid sample ID is required." }, { status: 400 });
  }

  const actorId = Number(session.user.id) || null;

  try {
    const upstream = await callRagApi(`/collections/${RAG_COLLECTION_ID}/samples/${id}`, {
      method: "DELETE",
    });

    if (upstream.ok) {
      await writeAuditEvent({
        actorId,
        action: "RAG_SAMPLE_DELETED",
        entityType: "rag_sample",
        metadata: { sampleId: id },
      }).catch(() => {});
    }
    return await forwardRagResponse(upstream);
  } catch (error) {
    return ragFailureResponse(error);
  }
}
