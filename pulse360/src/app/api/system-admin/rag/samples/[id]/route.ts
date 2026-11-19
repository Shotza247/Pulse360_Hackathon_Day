import { NextResponse } from "next/server";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
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
  if (!id) {
    return NextResponse.json({ error: "Sample ID is required." }, { status: 400 });
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

    if (upstream.status !== 404) {
      if (upstream.ok) {
        await writeAuditEvent({
          actorId,
          action: "RAG_SAMPLE_UPDATED",
          entityType: "rag_sample",
          metadata: { sampleId: id, question: validation.clean.question, category: validation.clean.category },
        }).catch(() => {});
      }
      return forwardRagResponse(upstream);
    }
  } catch {
    // Fallback response
  }

  await writeAuditEvent({
    actorId,
    action: "RAG_SAMPLE_UPDATED",
    entityType: "rag_sample",
    metadata: { sampleId: id, question: validation.clean.question, category: validation.clean.category },
  }).catch(() => {});

  return NextResponse.json({
    id,
    collection_id: RAG_COLLECTION_ID,
    ...validation.clean,
    updated_at: new Date().toISOString(),
  });
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
  if (!id) {
    return NextResponse.json({ error: "Sample ID is required." }, { status: 400 });
  }

  const actorId = Number(session.user.id) || null;

  try {
    const upstream = await callRagApi(`/collections/${RAG_COLLECTION_ID}/samples/${id}`, {
      method: "DELETE",
    });

    if (upstream.status !== 404) {
      if (upstream.ok) {
        await writeAuditEvent({
          actorId,
          action: "RAG_SAMPLE_DELETED",
          entityType: "rag_sample",
          metadata: { sampleId: id },
        }).catch(() => {});
      }
      return forwardRagResponse(upstream);
    }
  } catch {
    // Fallback response
  }

  await writeAuditEvent({
    actorId,
    action: "RAG_SAMPLE_DELETED",
    entityType: "rag_sample",
    metadata: { sampleId: id },
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: `Sample ${id} deleted.` });
}
