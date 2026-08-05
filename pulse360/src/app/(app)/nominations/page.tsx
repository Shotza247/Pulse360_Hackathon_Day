"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: number; firstName: string; lastName: string; jobTitle: string | null; department: { name: string } };
type Nomination = { id: number; reviewer: Employee; isMandatory: boolean; approvalStatus: string };
type Cycle = { id: number; name: string; phase: string; minNominees: number; maxNominees: number; effectiveMinNominees: number; effectiveMaxNominees: number };

export default function NominationsPage() {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [cycleRes, nomRes, empRes] = await Promise.all([
      fetch("/api/nominations/cycle"),
      fetch("/api/nominations"),
      fetch("/api/employees/list"),
    ]);
    if (cycleRes.ok) setCycle(await cycleRes.json());
    if (nomRes.ok) setNominations(await nomRes.json());
    if (empRes.ok) setEmployees(await empRes.json());
    setLoading(false);
  }

  const nominatedIds = new Set(nominations.map((n) => n.reviewer.id));
  const filtered = employees.filter((e) =>
    !nominatedIds.has(e.id) &&
    `${e.firstName} ${e.lastName} ${e.department.name}`.toLowerCase().includes(search.toLowerCase())
  );

  async function addNomination(reviewerId: number) {
    setError(""); setSaving(true);
    const res = await fetch("/api/nominations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    await fetchData();
    setSaving(false);
  }

  async function removeNomination(nominationId: number) {
    setError(""); setSaving(true);
    const res = await fetch(`/api/nominations/${nominationId}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); setError(d.error); }
    await fetchData();
    setSaving(false);
  }

  async function submitNominations() {
    setError(""); setSaving(true);
    const res = await fetch("/api/nominations/submit", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setSuccess("Nominations submitted successfully!");
    await fetchData();
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Loading…</div></div>;

  if (!cycle) return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <p className="text-gray-500 text-sm">No active review cycle. Please wait for HR to open a cycle.</p>
    </div>
  );

  if (cycle.phase !== "NOMINATE") return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <p className="text-gray-500 text-sm">Nominations are not open. Current phase: <strong>{cycle.phase}</strong></p>
    </div>
  );

  const effectiveMin = cycle.effectiveMinNominees ?? cycle.minNominees;
  const effectiveMax = cycle.effectiveMaxNominees ?? cycle.maxNominees;
  const submitted = nominations.every((n) => n.approvalStatus !== "PENDING" || n.isMandatory) && nominations.length > 0;
  const canSubmit = nominations.length >= effectiveMin;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Nominations</h1>
        <p className="text-sm text-gray-500 mt-1">Cycle: <strong>{cycle.name}</strong> · Select {effectiveMin}–{effectiveMax} reviewer{effectiveMax !== 1 ? "s" : ""}</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Reviewers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">My Reviewers ({nominations.length}/{effectiveMax})</h2>
            {canSubmit && (
              <button onClick={submitNominations} disabled={saving}
                className="text-xs font-semibold rounded-lg bg-[#0f1f3d] text-white px-3 py-1.5 hover:bg-[#1a3160] disabled:opacity-60 transition">
                {saving ? "Saving…" : "Submit All"}
              </button>
            )}
          </div>
          {nominations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No reviewers added yet</p>
          ) : (
            <div className="space-y-2">
              {nominations.map((nom) => (
                <div key={nom.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-xs font-bold">
                      {nom.reviewer.firstName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{nom.reviewer.firstName} {nom.reviewer.lastName}</p>
                      <p className="text-xs text-gray-500">{nom.reviewer.department.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {nom.isMandatory ? (
                      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Manager</span>
                    ) : (
                      <button onClick={() => removeNomination(nom.id)} disabled={saving}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40">Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {nominations.length < effectiveMin && (
            <p className="mt-3 text-xs text-amber-600">Add {effectiveMin - nominations.length} more reviewer{effectiveMin - nominations.length !== 1 ? "s" : ""} to submit</p>
          )}
        </div>

        {/* Employee search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Add Reviewers</h2>
          <input type="text" placeholder="Search by name or department…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.slice(0, 30).map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {emp.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-500">{emp.jobTitle ?? emp.department.name}</p>
                  </div>
                </div>
                <button onClick={() => addNomination(emp.id)} disabled={saving || nominations.length >= effectiveMax}
                  className="text-xs font-semibold rounded-lg border border-[#0f1f3d] text-[#0f1f3d] px-3 py-1 hover:bg-[#0f1f3d] hover:text-white disabled:opacity-40 transition">
                  Add
                </button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No employees found</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
