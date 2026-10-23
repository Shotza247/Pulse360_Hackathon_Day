"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DocumentRow = {
  id: string;
  filename: string;
  chunks: number;
  created: number;
};

type Preview = {
  preview_id: string;
  filename: string;
  chunk_count: number;
  dimensions: number;
  embedding_model: string;
  expires_in_seconds: number;
  already_stored: boolean;
  chunks: Array<{ chunk_id: string; text: string; metadata?: { page?: number | null } }>;
};

type Stage = "idle" | "previewing" | "ready" | "embedding" | "success" | "error";

const categories = ["platform", "pricing", "privacy", "security", "onboarding", "analytics", "billing", "support"];

function formatDate(value: number) {
  return new Date(value * 1000).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Icon({ d }: { d: string }) {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>;
}

export default function RagIngestionWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("platform");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/system-admin/rag/documents", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setDocuments(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  function chooseFile(nextFile: File | null) {
    setMessage("");
    setPreview(null);
    setStage("idle");
    if (!nextFile) return;
    const supported = /\.(pdf|txt|md)$/i.test(nextFile.name);
    if (!supported) {
      setStage("error");
      setMessage("Use a PDF, TXT, or Markdown file. DOCX ingestion will be added with the next parser update.");
      setFile(null);
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setStage("error");
      setMessage("The file must be 10 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(nextFile);
  }

  async function previewFile() {
    if (!file) return;
    setStage("previewing");
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/system-admin/rag/preview", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.detail ?? "Preview failed.");
      setPreview(data);
      setStage("ready");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Preview failed.");
    }
  }

  async function commitPreview() {
    if (!preview) return;
    setStage("embedding");
    setMessage("");
    try {
      const response = await fetch("/api/system-admin/rag/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_id: preview.preview_id, approved: true, category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.detail ?? "Embedding failed.");
      setStage("success");
      setMessage(data.status === "already_stored" ? "This document is already committed." : "Document embedded and committed successfully.");
      await loadDocuments();
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Embedding failed.");
    }
  }

  const isBusy = stage === "previewing" || stage === "embedding";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl bg-[#0f1f3d] p-7 text-white">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-blue-200">System Administrator · Knowledge Operations</p>
            <h1 className="mt-1 text-2xl font-black">FAQ document ingestion</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Review a source document before embedding it into the protected <span className="font-semibold text-white">pulse360_faq</span> collection.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            pgvector target · 384 dimensions
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Collection</p><p className="mt-2 text-lg font-black text-gray-950">pulse360_faq</p><p className="mt-1 text-xs text-gray-500">Public FAQ knowledge source</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Committed documents</p><p className="mt-2 text-3xl font-black text-gray-950">{documents.length}</p><p className="mt-1 text-xs text-gray-500">Available to the assistant</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Embedding model</p><p className="mt-2 truncate text-sm font-black text-gray-950">BAAI/bge-small-en-v1.5</p><p className="mt-1 text-xs text-gray-500">Hosted embedding pipeline</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><h2 className="text-base font-bold text-gray-950">Add a knowledge source</h2><p className="mt-1 text-sm text-gray-500">Preview first, then explicitly approve embedding.</p></div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Step {preview ? "2" : "1"} of 2</span>
          </div>

          <div
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#0f1f3d] shadow-sm"><Icon d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14a2 2 0 002-2v-4M3 14v4a2 2 0 002 2" /></div>
            <p className="mt-4 text-sm font-bold text-gray-900">{file ? file.name : "Drop a FAQ source here"}</p>
            <p className="mt-1 text-xs text-gray-500">PDF, TXT, or Markdown · up to 10 MB · readable text only</p>
            <input ref={inputRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0f1f3d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#172d58]"> <Icon d="M12 5v14m-7-7h14" /> Choose file</button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-gray-500">FAQ category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{categories.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><span className="mt-1 block text-[11px] leading-4 text-gray-500">Stored with the Supabase pgvector document when the upgraded ingestion endpoint is enabled.</span></label>
            <div><span className="text-xs font-bold uppercase tracking-wide text-gray-500">Source connector</span><div className="mt-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"><span className="text-sm font-semibold text-gray-800">Local upload</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Available</span></div></div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-500">Current connector: local upload. Google Drive folder sync is planned for a future ingestion connector.</p>
            <div className="flex gap-2"><button type="button" disabled={!file || isBusy} onClick={previewFile} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{stage === "previewing" ? "Preparing preview…" : "Preview document"}</button><button type="button" disabled={!preview || isBusy} onClick={commitPreview} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{stage === "embedding" ? "Embedding…" : "Approve & embed"}</button></div>
          </div>

          {message && <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${stage === "error" ? "border-red-200 bg-red-50 text-red-800" : stage === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{message}</div>}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4"><h2 className="text-base font-bold text-gray-950">Preview gate</h2><p className="mt-1 text-sm text-gray-500">Embedding never starts silently.</p></div>
          {!preview ? <div className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500">Choose a document and run a preview to inspect extracted chunks, model dimensions, and duplicate status.</div> : <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Chunks</p><p className="mt-1 text-2xl font-black text-gray-950">{preview.chunk_count}</p></div><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Dimensions</p><p className="mt-1 text-2xl font-black text-gray-950">{preview.dimensions}</p></div></div><div className="rounded-lg border border-gray-200 p-3"><p className="truncate text-sm font-bold text-gray-900">{preview.filename}</p><p className="mt-1 text-xs text-gray-500">{preview.already_stored ? "Already committed; re-embedding will be skipped." : `Preview expires in ${Math.round(preview.expires_in_seconds / 60)} minutes.`}</p></div><div className="max-h-52 space-y-2 overflow-y-auto">{preview.chunks.slice(0, 4).map((chunk, index) => <div key={chunk.chunk_id} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Chunk {index + 1}{chunk.metadata?.page ? ` · Page ${chunk.metadata.page}` : ""}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-700">{chunk.text}</p></div>)}</div><p className="text-xs leading-5 text-gray-500">Approve only after confirming the source is current and appropriate for the public FAQ collection.</p></div>}
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6"><div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-base font-bold text-gray-950">Committed FAQ sources</h2><p className="mt-1 text-sm text-gray-500">Only committed documents are searchable by the FAQ Assistant.</p></div><button type="button" onClick={() => void loadDocuments()} className="text-sm font-bold text-blue-700 hover:text-blue-900">Refresh library</button></div>{documents.length === 0 ? <div className="rounded-lg bg-gray-50 p-5 text-sm text-gray-500">No committed FAQ sources have been found yet.</div> : <div className="divide-y divide-gray-100">{documents.map((document) => <div key={document.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-gray-900">{document.filename}</p><p className="mt-1 text-xs text-gray-500">Document {document.id.slice(0, 12)} · {formatDate(document.created)}</p></div><span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{document.chunks} chunks · committed</span></div>)}</div>}</section>
    </div>
  );
}
