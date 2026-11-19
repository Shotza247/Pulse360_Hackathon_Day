"use client";

import { useState, useEffect, useCallback } from "react";
import { RAG_CATEGORIES } from "@/lib/rag-api";
import { EvaluationSample, parseSamplesCsv } from "@/lib/rag-samples";

export default function RagSamplesWorkspace() {
  const [samples, setSamples] = useState<EvaluationSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit modal state
  const [editingSample, setEditingSample] = useState<Partial<EvaluationSample> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Bulk import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/system-admin/rag/samples${selectedCategory !== "all" ? `?category=${encodeURIComponent(selectedCategory)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSamples(Array.isArray(data) ? data : []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  async function handleSaveSample(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSample?.question || !editingSample?.approved_answer) {
      setModalError("Please provide both a question and an approved answer.");
      return;
    }

    setModalSaving(true);
    setModalError("");

    try {
      const isEdit = Boolean(editingSample.id);
      const url = isEdit
        ? `/api/system-admin/rag/samples/${editingSample.id}`
        : "/api/system-admin/rag/samples";

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editingSample.question,
          approved_answer: editingSample.approved_answer,
          category: editingSample.category || "platform",
          is_active: editingSample.is_active ?? true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.detail?.message || "Failed to save sample.");
      }

      setIsModalOpen(false);
      setEditingSample(null);
      await loadSamples();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error saving sample.");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteSample(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/system-admin/rag/samples/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadSamples();
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkImport() {
    if (!importText.trim()) return;
    setImportLoading(true);
    setImportStatus("");

    try {
      const isJson = importText.trim().startsWith("[") || importText.trim().startsWith("{");
      const headers: Record<string, string> = {
        "Content-Type": isJson ? "application/json" : "text/plain",
      };

      const res = await fetch("/api/system-admin/rag/samples/import", {
        method: "POST",
        headers,
        body: importText,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Import failed.");
      }

      setImportStatus(`Successfully imported ${data.imported_count ?? "all"} samples.`);
      setImportText("");
      await loadSamples();
      setTimeout(() => {
        setIsImportOpen(false);
        setImportStatus("");
      }, 1500);
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportLoading(false);
    }
  }

  function handleExportJson() {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(samples, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `golden_samples_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  const filteredSamples = samples.filter((s) => {
    const matchesSearch =
      s.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.approved_answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const activeCount = samples.filter((s) => s.is_active).length;
  const categoriesCount = new Set(samples.map((s) => s.category)).size;

  return (
    <div className="space-y-6">
      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Golden Dataset Size</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{samples.length}</p>
          <p className="mt-1 text-xs text-gray-500">Approved reference questions</p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Benchmarks</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-xs text-gray-500">Used in automated scoring runs</p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Categories Covered</p>
          <p className="mt-2 text-2xl font-black text-blue-600">{categoriesCount}</p>
          <p className="mt-1 text-xs text-gray-500">FAQ knowledge domains</p>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-gray-200">
        <div className="flex flex-1 items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions or answers…"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {RAG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            disabled={samples.length === 0}
            className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => { setImportText(""); setImportStatus(""); setIsImportOpen(true); }}
            className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
          >
            Bulk Import
          </button>
          <button
            type="button"
            onClick={() => { setEditingSample({ category: "platform", is_active: true }); setModalError(""); setIsModalOpen(true); }}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
          >
            + New Approved Answer
          </button>
        </div>
      </div>

      {/* Samples Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading approved answers dataset…</div>
        ) : filteredSamples.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm font-semibold text-gray-700">No Golden Samples Found</p>
            <p className="text-xs text-gray-500 mt-1">Create or import reference answers to benchmark the FAQ Assistant.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSamples.map((sample) => (
              <div key={sample.id} className="p-5 hover:bg-slate-50/60 transition flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="capitalize text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {sample.category}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sample.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {sample.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-gray-900">{sample.question}</h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-gray-700 leading-relaxed font-sans">
                    <span className="font-semibold text-gray-500 block mb-1">Approved Answer:</span>
                    {sample.approved_answer}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-start">
                  <button
                    type="button"
                    onClick={() => { setEditingSample(sample); setModalError(""); setIsModalOpen(true); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded hover:bg-blue-50 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === sample.id}
                    onClick={() => handleDeleteSample(sample.id)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded hover:bg-red-50 transition"
                  >
                    {deletingId === sample.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && editingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              {editingSample.id ? "Edit Approved Answer" : "Add Ground-Truth Approved Answer"}
            </h3>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveSample} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Reference Question
                </label>
                <textarea
                  rows={2}
                  value={editingSample.question || ""}
                  onChange={(e) => setEditingSample({ ...editingSample, question: e.target.value })}
                  placeholder="e.g. How does the employee 360 rating scale work?"
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Company-Approved Answer (Golden Standard)
                </label>
                <textarea
                  rows={4}
                  value={editingSample.approved_answer || ""}
                  onChange={(e) => setEditingSample({ ...editingSample, approved_answer: e.target.value })}
                  placeholder="State the authoritative policy answer against which RAG generated answers will be evaluated..."
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                    Category
                  </label>
                  <select
                    value={editingSample.category || "platform"}
                    onChange={(e) => setEditingSample({ ...editingSample, category: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white text-gray-700"
                  >
                    {RAG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Active Benchmark</label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={editingSample.is_active ?? true}
                      onChange={(e) => setEditingSample({ ...editingSample, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">Include in scoring runs</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {modalSaving ? "Saving…" : "Save Approved Answer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Bulk Import Golden Dataset</h3>
            <p className="text-xs text-gray-500">
              Paste CSV text (with headers <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">question, approved_answer, category</code>) or a JSON array of samples.
            </p>

            {importStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium ${
                  importStatus.startsWith("Successfully")
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {importStatus}
              </div>
            )}

            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`question,approved_answer,category\n"How do peer nominations work?","Employees nominate up to 5 peers for review during the Nominate phase.",platform`}
              className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">Supported: CSV / JSON</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={importLoading}
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={importLoading || !importText.trim()}
                  onClick={handleBulkImport}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  {importLoading ? "Importing…" : "Execute Import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
