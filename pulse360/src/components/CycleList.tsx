"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// CALCULATION is handled automatically — not shown as a user-visible step
const PHASE_ORDER = ["DRAFT","NOMINATE","APPROVE","REVIEW","CONSULTATION","ACCEPT","CLOSED"] as const;
type Phase = typeof PHASE_ORDER[number];

const PHASE_NEXT: Record<string, Phase> = {
  DRAFT: "NOMINATE", NOMINATE: "APPROVE", APPROVE: "REVIEW",
  REVIEW: "CONSULTATION", CONSULTATION: "ACCEPT", ACCEPT: "CLOSED",
};

const PHASE_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700", NOMINATE: "bg-blue-100 text-blue-800",
  APPROVE: "bg-amber-100 text-amber-800", REVIEW: "bg-purple-100 text-purple-800",
  CALCULATION: "bg-indigo-100 text-indigo-800", CONSULTATION: "bg-teal-100 text-teal-800",
  ACCEPT: "bg-green-100 text-green-800", CLOSED: "bg-gray-200 text-gray-600",
};

const PHASE_DESC: Record<string, string> = {
  DRAFT:        "Cycle created. Advance to open nominations for employees.",
  NOMINATE:     "Employees are nominating their reviewers. Advance when nominations are complete.",
  APPROVE:      "Managers are reviewing and approving nominations for their teams. Advance to begin the review period.",
  REVIEW:       "Reviewers are completing their peer reviews. Advance to close reviews — scores will be calculated automatically.",
  CONSULTATION: "Scores are calculated. Managers can see their team's results privately before employees are notified. Advance when managers are ready.",
  ACCEPT:       "Employees can now view their own results and comments. Advance to close the cycle once everyone has reviewed.",
  CLOSED:       "Cycle complete. Results are now a read-only historical record.",
};

const PHASE_ADVANCE_LABEL: Record<string, string> = {
  DRAFT:        "Open Nominations →",
  NOMINATE:     "Close Nominations & Open Approvals →",
  APPROVE:      "Close Approvals & Begin Reviews →",
  REVIEW:       "Close Reviews & Release to Managers →",
  CONSULTATION: "Release Results to Employees →",
  ACCEPT:       "Close Cycle →",
};

type Cycle = {
  id: number; name: string; phase: Phase;
  startDate: string; endDate: string;
  createdBy: { firstName: string; lastName: string };
};

export function CycleList({ initialCycles }: { initialCycles: Cycle[] }) {
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function advance(cycleId: number) {
    setError(""); setAdvancing(cycleId);
    const res = await fetch(`/api/cycles/${cycleId}/advance`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to advance cycle");
      setAdvancing(null);
      return;
    }
    // Refresh
    const listRes = await fetch("/api/cycles/list");
    if (listRes.ok) setCycles(await listRes.json());
    setAdvancing(null);
    router.refresh();
  }

  return (
    <>
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-4">
        {cycles.map((cycle) => {
          const nextPhase = PHASE_NEXT[cycle.phase];
          const isAdvancing = advancing === cycle.id;
          return (
            <div key={cycle.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">{cycle.name}</h2>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PHASE_COLORS[cycle.phase]}`}>
                      {cycle.phase}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{PHASE_DESC[cycle.phase]}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                    <span>Start: <strong className="text-gray-700">{new Date(cycle.startDate).toLocaleDateString("en-ZA")}</strong></span>
                    <span>End: <strong className="text-gray-700">{new Date(cycle.endDate).toLocaleDateString("en-ZA")}</strong></span>
                    <span>Created by: <strong className="text-gray-700">{cycle.createdBy.firstName} {cycle.createdBy.lastName}</strong></span>
                  </div>
                  {/* Phase stepper */}
                  <div className="flex flex-wrap items-center gap-1">
                    {PHASE_ORDER.map((p, i) => (
                      <div key={p} className="flex items-center gap-1">
                        <div className={`text-xs px-2 py-0.5 rounded font-medium ${
                          p === cycle.phase ? "bg-[#0f1f3d] text-white" :
                          PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(cycle.phase) ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-400"
                        }`}>{p}</div>
                        {i < PHASE_ORDER.length - 1 && <span className="text-gray-300 text-xs">›</span>}
                      </div>
                    ))}
                  </div>
                </div>
                {nextPhase && (
                  <button
                    onClick={() => advance(cycle.id)}
                    disabled={isAdvancing}
                    className="flex-shrink-0 rounded-lg border-2 border-[#0f1f3d] text-[#0f1f3d] text-xs font-bold px-4 py-2 hover:bg-[#0f1f3d] hover:text-white disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {isAdvancing ? "Advancing…" : (PHASE_ADVANCE_LABEL[cycle.phase] ?? `Advance → ${nextPhase}`)}
                  </button>
                )}
                {cycle.phase === "CLOSED" && (
                  <span className="flex-shrink-0 text-xs text-gray-400 font-medium pt-1">Closed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
