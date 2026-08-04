"use client";

import { useState } from "react";

type ThemeSummary = {
  strengths: string[];
  improvements: string[];
  sentiment: string;
  stub?: boolean;
};

type Status = "idle" | "loading" | "done" | "error";

interface AISummaryPanelProps {
  employeeId: number;
  cycleId: number;
  employeeName: string;
}

export function AISummaryPanel({ employeeId, cycleId, employeeName }: AISummaryPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<ThemeSummary | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    setStatus("loading");
    setError("");
    setSummary(null);
    try {
      const res = await fetch("/api/ai/theme-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, cycleId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Generation failed");
      }
      const data = await res.json();
      setSummary(data);
      setStatus("done");
    } catch (e: any) {
      setError(e.message ?? "Failed");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider">AI Feedback Themes</h2>
          <p className="text-xs text-gray-500 mt-0.5">AI-generated summary of key themes from all peer feedback</p>
        </div>
        {status !== "done" && (
          <button
            onClick={generate}
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
            ) : (
              <>✨ Generate AI Summary</>
            )}
          </button>
        )}
        {status === "done" && (
          <button
            onClick={generate}
            className="text-xs text-purple-600 hover:underline font-medium"
          >
            Regenerate
          </button>
        )}
      </div>

      {status === "idle" && (
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-4xl mb-2">🤖</p>
          <p className="text-sm text-gray-500">
            Click <strong>Generate AI Summary</strong> to analyse all peer comments for {employeeName} and surface key themes.
          </p>
          <p className="text-xs text-purple-600 mt-1 italic">Human-in-the-Loop: Review the AI output before acting on it.</p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error} — <button onClick={generate} className="underline">Try again</button>
        </div>
      )}

      {status === "done" && summary && (
        <div className="space-y-4">
          {summary.stub && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
              Demo Mode — add OPENAI_API_KEY to pulse360/.env for live AI generation
            </div>
          )}

          {/* Sentiment */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Overall Sentiment</p>
            <p className="text-sm text-gray-800">{summary.sentiment}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Strengths */}
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Top 3 Strengths</p>
              <ul className="space-y-2">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Top 3 Growth Areas</p>
              <ul className="space-y-2">
                {summary.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
            ✨ AI-generated — always review with human judgment before use in performance conversations.
          </p>
        </div>
      )}
    </div>
  );
}
