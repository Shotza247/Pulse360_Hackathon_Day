"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCyclePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minNominees, setMinNominees] = useState(3);
  const [maxNominees, setMaxNominees] = useState(8);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate, minNominees, maxNominees }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create cycle"); setLoading(false); return; }
      router.push("/cycles");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Review Cycle</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new semi-annual performance review cycle</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cycle Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. H1 2026" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Nominators</label>
              <input type="number" min={1} max={20} required value={minNominees} onChange={e => setMinNominees(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Nominators</label>
              <input type="number" min={1} max={20} required value={maxNominees} onChange={e => setMaxNominees(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-[#0f1f3d] text-white py-2.5 text-sm font-semibold hover:bg-[#1a3160] disabled:opacity-60 transition">
              {loading ? "Creating…" : "Create Cycle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
