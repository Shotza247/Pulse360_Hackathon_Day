"use client";

import { useState, useEffect } from "react";

type Criterion = {
  id: number; name: string; description: string | null;
  isActive: boolean; sortOrder: number;
  questions: { id: number; questionText: string; answerType: string; sortOrder: number }[];
};

export default function CriteriaPage() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New criterion modal
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => { fetchCriteria(); }, []);

  async function fetchCriteria() {
    setLoading(true);
    const res = await fetch("/api/criteria/full");
    if (res.ok) setCriteria(await res.json());
    setLoading(false);
  }

  function startEdit(c: Criterion) {
    setEditing(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
    setError(""); setSuccess("");
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch(`/api/criteria/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Save failed"); setSaving(false); return; }
    setSuccess("Saved!"); setEditing(null); setSaving(false);
    await fetchCriteria();
  }

  async function toggleActive(c: Criterion) {
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch(`/api/criteria/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); }
    else setSuccess(`${c.name} ${!c.isActive ? "activated" : "deactivated"}`);
    setSaving(false);
    await fetchCriteria();
  }

  async function addCriterion() {
    if (!newName.trim()) { setError("Name is required"); return; }
    setAddSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to create criterion"); setAddSaving(false); return; }
    setSuccess(`"${newName}" created successfully`);
    setNewName(""); setNewDesc(""); setShowAdd(false); setAddSaving(false);
    await fetchCriteria();
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">eWay Criteria</h1>
          <p className="text-sm text-gray-500 mt-1">The competency pillars and their questions used in every review cycle</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(""); setSuccess(""); }}
          className="flex items-center gap-2 bg-[#0f1f3d] hover:bg-[#1a3160] text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add Criterion
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* Add Criterion Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Add New eWay Criterion</h2>
            <p className="text-xs text-gray-500 mb-4">New criteria will be available for selection in upcoming review cycles.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Criterion Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. INNOVATION"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief description of this competency pillar…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={addCriterion}
                disabled={addSaving || !newName.trim()}
                className="flex-1 rounded-lg bg-[#0f1f3d] text-white text-sm font-semibold py-2.5 hover:bg-[#1a3160] disabled:opacity-60 transition"
              >
                {addSaving ? "Creating…" : "Create Criterion"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName(""); setNewDesc(""); }}
                disabled={addSaving}
                className="flex-1 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {criteria.map((c) => (
          <div key={c.id} className={`bg-white rounded-xl border ${c.isActive ? "border-gray-200" : "border-gray-100 opacity-60"} overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                {editing === c.id ? (
                  <div className="space-y-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:border-[#0f1f3d] focus:outline-none" />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#0f1f3d] focus:outline-none" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider">{c.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{c.questions.length} questions</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editing === c.id ? (
                  <>
                    <button onClick={() => saveEdit(c.id)} disabled={saving}
                      className="text-xs font-semibold rounded-lg bg-[#0f1f3d] text-white px-3 py-1.5 hover:bg-[#1a3160] disabled:opacity-60 transition">
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(null)} disabled={saving}
                      className="text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 px-3 py-1.5 hover:bg-gray-50 transition">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(c)}
                      className="text-xs font-medium text-[#0f1f3d] hover:underline">Edit</button>
                    <button onClick={() => toggleActive(c)} disabled={saving}
                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${c.isActive ? "text-red-500" : "text-green-600"}`}>
                      {c.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      className="text-xs font-medium text-gray-400 hover:text-gray-700">
                      {expanded === c.id ? "▲ Hide" : "▼ Questions"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Questions accordion */}
            {expanded === c.id && (
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Questions</p>
                {c.questions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No questions yet for this criterion.</p>
                ) : (
                  <ol className="space-y-2">
                    {c.questions.map((q) => (
                      <li key={q.id} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0f1f3d] text-white text-xs flex items-center justify-center font-bold mt-0.5">
                          {q.sortOrder}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">{q.questionText}</p>
                          <span className={`text-xs font-medium rounded-full px-2 py-0.5 mt-1 inline-block ${
                            q.answerType === "RATING" ? "bg-blue-50 text-blue-600" :
                            q.answerType === "TEXT" ? "bg-amber-50 text-amber-600" :
                            "bg-green-50 text-green-600"
                          }`}>{q.answerType}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
