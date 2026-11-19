import { NextResponse } from "next/server";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
import { writeAuditEvent } from "@/lib/audit";
import {
  DEFAULT_GOLDEN_SAMPLES,
  EvaluationSample,
  validateSampleInput,
} from "@/lib/rag-samples";

export const runtime = "nodejs";

// In-memory fallback sample registry ensuring evaluation workflows function immediately
// even before the companion Python RAG service migration is applied.
const inMemorySamples: Map<string, EvaluationSample> = new Map(
  DEFAULT_GOLDEN_SAMPLES.map((s, idx) => {
    const id = `gold-00000000-0000-0000-0000-${String(idx + 1).padStart(12, "0")}`;
    const now = new Date().toISOString();
    return [
      id,
      {
        ...s,
        id,
        created_at: now,
        updated_at: now,
      },
    ];
  }),
);

export async function GET(request: Request) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    const upstreamUrl = `/collections/${RAG_COLLECTION_ID}/samples${category ? `?category=${encodeURIComponent(category)}` : ""}`;
    const response = await callRagApi(upstreamUrl);
    if (response.status !== 404) {
      return forwardRagResponse(response);
    }
  } catch {
    // Fall through to fallback sample registry
  }

  // Return fallback in-memory samples
  let list = Array.from(inMemorySamples.values());
  if (category && category !== "all") {
    list = list.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }

  return NextResponse.json(list);
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

    if (upstream.status !== 404) {
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
    }
  } catch {
    // Fallback store
  }

  const sampleId = `sample-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const created: EvaluationSample = {
    id: sampleId,
    collection_id: RAG_COLLECTION_ID,
    question: validation.clean.question,
    approved_answer: validation.clean.approved_answer,
    category: validation.clean.category || "platform",
    is_active: validation.clean.is_active ?? true,
    created_by: userIdentifier,
    created_at: now,
    updated_at: now,
  };

  inMemorySamples.set(sampleId, created);

  await writeAuditEvent({
    actorId,
    action: "RAG_SAMPLE_CREATED",
    entityType: "rag_sample",
    metadata: { sampleId, question: created.question, category: created.category },
  }).catch(() => {});

  return NextResponse.json(created, { status: 201 });
}
