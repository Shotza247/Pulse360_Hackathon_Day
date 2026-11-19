import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit";
import {
  callRagApi,
  forwardRagResponse,
  isRagDocumentId,
  isRagTimeout,
  RAG_COLLECTION_ID,
  RAG_DELETE_TIMEOUT_MS,
} from "@/lib/rag-api";
import { RAG_MUTATION_ROLES, requireRagSession } from "@/lib/rag-auth";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRagSession(RAG_MUTATION_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isRagDocumentId(id)) {
    return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  }

  try {
    const response = await callRagApi(
      `/collections/${RAG_COLLECTION_ID}/documents/${id}`,
      { method: "DELETE" },
      RAG_DELETE_TIMEOUT_MS,
    );

    if (response.ok) {
      const removed = await response
        .clone()
        .json()
        .catch(() => null);
      // The audit helper takes a numeric entityId, but document IDs are UUIDs, so the UUID
      // goes in metadata. A failed audit write must not hide that the delete succeeded.
      await writeAuditEvent({
        actorId: Number(session.user.id),
        action: "RAG_DOCUMENT_DELETED",
        entityType: "rag_document",
        metadata: {
          documentId: id,
          filename: removed?.filename ?? null,
          chunks: removed?.chunks ?? null,
          collection: RAG_COLLECTION_ID,
        },
      }).catch(() => {});
    }

    return forwardRagResponse(response);
  } catch (error) {
    if (isRagTimeout(error)) {
      return NextResponse.json(
        { error: "Delete timed out. Refresh the library to see whether it completed." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the RAG service." },
      { status: 503 },
    );
  }
}
