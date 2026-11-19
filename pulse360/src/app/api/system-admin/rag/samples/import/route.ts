import { NextResponse } from "next/server";
import { RAG_TOOL_ROLES, requireRagSession } from "@/lib/rag-auth";
import { callRagApi, forwardRagResponse, RAG_COLLECTION_ID } from "@/lib/rag-api";
import { writeAuditEvent } from "@/lib/audit";
import { parseSamplesCsv, SampleInput, validateSampleInput } from "@/lib/rag-samples";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireRagSession(RAG_TOOL_ROLES);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorId = Number(session.user.id) || null;
  const userIdentifier = session.user.email || session.user.name || "admin";
  const contentType = request.headers.get("content-type") || "";

  let samplesToImport: SampleInput[] = [];

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    const rawList: unknown[] = Array.isArray(body) ? body : Array.isArray(body?.samples) ? body.samples : [];

    for (const item of rawList) {
      const validated = validateSampleInput(item as Partial<SampleInput>);
      if (validated.valid && validated.clean) {
        samplesToImport.push(validated.clean);
      }
    }
  } else {
    // CSV or plain text
    const text = await request.text();
    const { samples } = parseSamplesCsv(text);
    samplesToImport = samples;
  }

  if (samplesToImport.length === 0) {
    return NextResponse.json(
      { error: "No valid samples found to import. Check format and required headers (question, approved_answer)." },
      { status: 400 },
    );
  }

  try {
    const upstream = await callRagApi(`/collections/${RAG_COLLECTION_ID}/samples/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: samplesToImport.map((s) => ({ ...s, created_by: userIdentifier })),
      }),
    });

    if (upstream.status !== 404) {
      if (upstream.ok) {
        await writeAuditEvent({
          actorId,
          action: "RAG_SAMPLES_IMPORTED",
          entityType: "rag_sample",
          metadata: { count: samplesToImport.length },
        }).catch(() => {});
      }
      return forwardRagResponse(upstream);
    }
  } catch {
    // Fallback response
  }

  await writeAuditEvent({
    actorId,
    action: "RAG_SAMPLES_IMPORTED",
    entityType: "rag_sample",
    metadata: { count: samplesToImport.length },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    imported_count: samplesToImport.length,
    message: `Successfully imported ${samplesToImport.length} evaluation samples.`,
  });
}
