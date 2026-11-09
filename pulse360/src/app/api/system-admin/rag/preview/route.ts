import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  callRagApi,
  forwardRagResponse,
  isRagTimeout,
  RAG_COLLECTION_ID,
  RAG_PREVIEW_TIMEOUT_MS,
} from "@/lib/rag-api";
import { RAG_MAX_UPLOAD_BYTES, RAG_MAX_UPLOAD_LABEL } from "@/lib/rag-limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF, TXT, or Markdown file." }, { status: 400 });
  }

  if (!/\.(pdf|txt|md)$/i.test(file.name)) {
    return NextResponse.json({ error: "Only PDF, TXT, and Markdown files are supported." }, { status: 415 });
  }

  if (file.size === 0 || file.size > RAG_MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `The file must be non-empty and no larger than ${RAG_MAX_UPLOAD_LABEL}.` },
      { status: 413 },
    );
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name);

  try {
    const response = await callRagApi(
      `/collections/${RAG_COLLECTION_ID}/uploads/preview`,
      { method: "POST", body: upstream },
      RAG_PREVIEW_TIMEOUT_MS,
    );
    return forwardRagResponse(response);
  } catch (error) {
    if (isRagTimeout(error)) {
      return NextResponse.json(
        { error: "Reading the file is taking too long. Try a smaller file." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the RAG service." },
      { status: 503 },
    );
  }
}
