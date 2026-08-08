"use client";

import { useState } from "react";
import { downloadTextFile, escapeCsvCell, sanitizeFileName } from "@/lib/downloads";

type CriterionResult = {
  criterionId: number | null;
  criterion: { id: number; name: string } | null;
  avgScore: number;
};

type GapRow = {
  criterion: string;
  criterionId: number | null;
  peerScore: number;
  selfScore: number | null;
  gap: number | null;
  reviewCount: number;
};

type PlanRow = {
  criterion: string;
  gapLabel: string;
  weeklyAction: string;
  monthlyGoal: string;
  successMetric: string;
};

type ImprovementPlan = {
  employeeName: string;
  cycleName: string;
  gaps: GapRow[];
  plan: PlanRow[];
  narrative: string;
  stub?: boolean;
};

interface SelfAssessmentPanelProps {
  cycleId: number;
  criterionResults: CriterionResult[];
  employeeName: string;
}

const GAP_COLOURS = {
  Overrating: "text-amber-700 bg-amber-50 border-amber-200",
  Underrating: "text-blue-700 bg-blue-50 border-blue-200",
  Aligned: "text-green-700 bg-green-50 border-green-200",
};

export function SelfAssessmentPanel({ cycleId, criterionResults, employeeName }: SelfAssessmentPanelProps) {
  const criteria = criterionResults.filter((r) => r.criterionId !== null && r.criterion);
  const [selfScores, setSelfScores] = useState<Record<number, number>>({});
  const [plan, setPlan] = useState<ImprovementPlan | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Plan approval state
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function generatePlan() {
    const ratings = criteria
      .filter((r) => selfScores[r.criterionId!] !== undefined)
      .map((r) => ({ criterionId: r.criterionId!, selfScore: selfScores[r.criterionId!] }));

    if (ratings.length === 0) {
      setError("Please rate at least one criterion before generating a plan.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setPlan(null);
    setApproved(false);
    setSaved(null);

    const res = await fetch("/api/ai/improvement-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId, selfRatings: ratings }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Generation failed");
      setStatus("error");
      return;
    }

    const data = await res.json();
    setPlan(data);
    setStatus("done");
  }

  async function saveCsv() {
    if (!plan) return;
    setSaving(true);
    const fileName = `Self-Improvement-Plan-${plan.employeeName.replace(/\s+/g, "-")}-${plan.cycleName.replace(/\s+/g, "-")}.csv`;
    const safeFileName = sanitizeFileName(fileName.replace(/\.csv$/i, "")) + ".csv";
    const header = [
      "Employee", "Cycle", "Criterion",
      "Peer Score", "Self Score", "Gap", "Gap Label",
      "Weekly Action", "Monthly Goal", "Success Metric",
    ];
    const rows = plan.plan.map((row, i) => [
      plan.employeeName,
      plan.cycleName,
      row.criterion,
      plan.gaps[i]?.peerScore ?? 0,
      plan.gaps[i]?.selfScore ?? "",
      plan.gaps[i]?.gap ?? "",
      row.gapLabel,
      row.weeklyAction,
      row.monthlyGoal,
      row.successMetric,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");
    downloadTextFile(csv, safeFileName, "text/csv;charset=utf-8");
    setSaved(safeFileName);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider">Self-Assessment & Gap Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">Rate yourself on each criterion, then generate an AI-assisted improvement plan</p>
        </div>
        {status !== "done" && (
          <button
            onClick={generatePlan}
            disabled={status === "loading"}
            className="flex items-center gap-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
          >
            {status === "loading" ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Analysing…
              </>
            ) : "✨ Generate Improvement Plan"}
          </button>
        )}
        {status === "done" && (
          <button onClick={() => { setStatus("idle"); setPlan(null); setApproved(false); setSaved(null); }}
            className="text-xs text-purple-600 hover:underline font-medium">
            Start Over
          </button>
        )}
      </div>

      {/* Self-rating sliders */}
      {status !== "done" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 font-medium">Your self-ratings (1 = Needs Work → 5 = Exceptional):</p>
          {criteria.map((r) => {
            const self = selfScores[r.criterionId!] ?? 0;
            const peer = Number(r.avgScore);
            return (
              <div key={r.criterionId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">{r.criterion!.name}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">Peer: <strong>{peer.toFixed(2)}</strong></span>
                    <span className="text-[#0f1f3d] font-semibold">Self: {self > 0 ? self.toFixed(1) : "—"}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={self || 1}
                  onChange={(e) => setSelfScores((prev) => ({ ...prev, [r.criterionId!]: Number(e.target.value) }))}
                  className="w-full accent-[#0f1f3d]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>1 Needs Work</span><span>3 Meets</span><span>5 Exceptional</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Plan output */}
      {status === "done" && plan && (
        <div className="space-y-4">
          {plan.stub && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
              Demo mode — add OPENAI_API_KEY for AI-personalised plans
            </div>
          )}

          {/* Narrative */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Personal Message</p>
            <p className="text-sm text-gray-800 italic">{plan.narrative}</p>
          </div>

          {/* Gap table */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Gap Analysis</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Criterion</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Peer Score</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Self Score</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Gap</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plan.gaps.map((g, i) => {
                    const label = (plan.plan[i]?.gapLabel ?? "—") as keyof typeof GAP_COLOURS;
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-gray-800">{g.criterion}</td>
                        <td className="px-3 py-2 text-center">{g.peerScore.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">{g.selfScore?.toFixed(1) ?? "—"}</td>
                        <td className="px-3 py-2 text-center font-bold">
                          {g.gap !== null ? (g.gap > 0 ? `+${g.gap.toFixed(2)}` : g.gap.toFixed(2)) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${GAP_COLOURS[label] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
                            {label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plan rows */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Your Improvement Plan</p>
            <div className="space-y-3">
              {plan.plan.map((row, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-[#0f1f3d] mb-2">{row.criterion}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="font-bold text-blue-700 uppercase tracking-wider mb-1">Weekly Action</p>
                      <p className="text-gray-700">{row.weeklyAction}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="font-bold text-green-700 uppercase tracking-wider mb-1">Monthly Goal</p>
                      <p className="text-gray-700">{row.monthlyGoal}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                      <p className="font-bold text-purple-700 uppercase tracking-wider mb-1">Success Metric</p>
                      <p className="text-gray-700">{row.successMetric}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Human-in-the-loop approval + export */}
          {!approved && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Human-in-the-Loop</p>
              <p className="text-xs text-amber-600 mb-3">
                Review the improvement plan above. Once you are satisfied with the actions and goals, approve it to download as an Excel-compatible CSV file to use as your daily schedule.
              </p>
              <button
                onClick={() => setApproved(true)}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition"
              >
                I've reviewed this — Approve & Download
              </button>
            </div>
          )}

          {approved && !saved && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-700 mb-2">Plan Approved</p>
              <p className="text-xs text-green-600 mb-3">
                Your browser will download the improvement plan as an Excel-compatible CSV file on this device.
              </p>
              <button
                onClick={saveCsv}
                disabled={saving}
                className="text-xs font-semibold bg-[#0f1f3d] hover:bg-[#1a3160] disabled:opacity-60 text-white px-4 py-2 rounded-lg transition"
              >
                {saving ? "Saving…" : "Download as CSV (Excel)"}
              </button>
            </div>
          )}

          {saved && (
            <div className="bg-[#0f1f3d] text-white rounded-xl p-4">
              <p className="text-sm font-semibold mb-1">CSV download started!</p>
              <code className="text-blue-200 text-xs break-all">{saved}</code>
              <p className="text-xs text-blue-300 mt-2">Open it with Excel from your browser's download folder.</p>
            </div>
          )}

          <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
            ✨ AI-generated plan — always apply your own judgment. The MCP tool writes the file only after you approve.
          </p>
        </div>
      )}
    </div>
  );
}
