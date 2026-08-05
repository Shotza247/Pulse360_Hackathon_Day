"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type CycleMeta = { id: number; name: string; phase: string; startDate: string; endDate: string };
type Criterion = { id: number; name: string };
type Department = { id: number; name: string };
type TrendPoint = { cycleId: number; cycleName: string; avg: number | null };
type HeatmapData = {
  cycle: CycleMeta | null;
  allCycles: CycleMeta[];
  departments: Department[];
  criteria: Criterion[];
  data: Record<number, Record<number, number | null>>;
  deptOveralls: Record<number, number | null>;
  trends: Record<number, TrendPoint[]>;
};

// ── Colour helpers ────────────────────────────────────────────────────────────
const PIE_COLOURS = [
  "#0f1f3d","#3b82d4","#7c5cd8","#10b981","#f59e0b",
  "#ef4444","#6366f1","#ec4899","#14b8a6","#f97316",
];

function scoreColor(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 4.5) return "bg-green-700 text-white";
  if (score >= 4.0) return "bg-green-500 text-white";
  if (score >= 3.5) return "bg-green-300 text-green-900";
  if (score >= 3.0) return "bg-amber-200 text-amber-900";
  if (score >= 2.5) return "bg-amber-400 text-amber-900";
  if (score >= 2.0) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function scoreLabel(score: number | null) {
  if (score === null) return "—";
  if (score >= 4.5) return "Exceptional";
  if (score >= 4.0) return "Exceeds";
  if (score >= 3.5) return "Good";
  if (score >= 3.0) return "Meets";
  if (score >= 2.5) return "Developing";
  return "Needs Work";
}

// ── SVG Pie Chart (pure, no external lib) ────────────────────────────────────
function PieChart({ slices }: { slices: { label: string; value: number; colour: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="text-xs text-gray-400 text-center py-6">No data</p>;

  let cumAngle = -Math.PI / 2;
  const R = 80;
  const cx = 100;
  const cy = 100;

  const paths = slices.map((slice) => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { d: `M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`, colour: slice.colour, label: slice.label, value: slice.value };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-40 h-40 flex-shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.colour} stroke="#fff" strokeWidth="1.5">
            <title>{p.label}: {((p.value / total) * 100).toFixed(1)}%</title>
          </path>
        ))}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs truncate">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.colour }} />
            <span className="text-gray-700 truncate">{s.label}</span>
            <span className="font-semibold text-gray-900 ml-auto pl-2">{s.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVG Trend Bars ────────────────────────────────────────────────────────────
function TrendBars({ trends, criteria }: { trends: Record<number, TrendPoint[]>; criteria: Criterion[] }) {
  const allCycleNames = criteria.length > 0 && trends[criteria[0].id]
    ? trends[criteria[0].id].map((t) => t.cycleName)
    : [];

  if (allCycleNames.length < 2) {
    return (
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm text-gray-400">Historical trend comparison will appear once 2+ cycles have results.</p>
      </div>
    );
  }

  const barWidth = 16;
  const gap = 6;
  const groupGap = 20;
  const groupW = criteria.length * (barWidth + gap) - gap + groupGap;
  const svgW = allCycleNames.length * groupW + 60;
  const svgH = 160;
  const maxY = 5;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${svgW} ${svgH + 40}`} style={{ width: "100%", minWidth: svgW }}>
        {/* Y axis labels */}
        {[0, 1, 2, 3, 4, 5].map((v) => {
          const y = svgH - (v / maxY) * svgH;
          return (
            <g key={v}>
              <line x1={40} x2={svgW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={36} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
            </g>
          );
        })}

        {allCycleNames.map((cycleName, ci) => {
          const groupX = 44 + ci * groupW;
          return (
            <g key={ci}>
              {criteria.map((crit, ki) => {
                const point = trends[crit.id]?.[ci];
                const val = point?.avg ?? 0;
                const barH = (val / maxY) * svgH;
                const x = groupX + ki * (barWidth + gap);
                const colour = PIE_COLOURS[ki % PIE_COLOURS.length];
                return (
                  <g key={ki}>
                    <rect x={x} y={svgH - barH} width={barWidth} height={barH} fill={colour} rx="2">
                      <title>{crit.name} · {cycleName}: {val.toFixed(2)}</title>
                    </rect>
                    {val > 0 && (
                      <text x={x + barWidth / 2} y={svgH - barH - 3} textAnchor="middle" fontSize="8" fill="#374151">
                        {val.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={groupX + (criteria.length * (barWidth + gap)) / 2}
                y={svgH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="#57606a"
              >
                {cycleName.length > 12 ? cycleName.slice(0, 10) + "…" : cycleName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {criteria.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm" style={{ background: PIE_COLOURS[i % PIE_COLOURS.length] }} />
            {c.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ deptId: number; critId: number } | null>(null);

  // Report state
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportStub, setReportStub] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportApproved, setReportApproved] = useState(false);
  const [reportEditing, setReportEditing] = useState(false);
  const [editableHtml, setEditableHtml] = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState<string | null>(null);

  const fetchData = useCallback(async (cycleId?: number) => {
    setLoading(true);
    const url = cycleId ? `/api/analytics/heatmap?cycleId=${cycleId}` : "/api/analytics/heatmap";
    const res = await fetch(url);
    if (res.ok) {
      const d: HeatmapData = await res.json();
      setData(d);
      if (!cycleId && d.cycle) setSelectedCycleId(d.cycle.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleCycleChange(id: number) {
    setSelectedCycleId(id);
    setReportHtml(null);
    setReportApproved(false);
    setReportSaved(null);
    fetchData(id);
  }

  async function generateReport() {
    if (!data?.cycle) return;
    setReportLoading(true);
    setReportHtml(null);
    setReportApproved(false);
    setReportSaved(null);
    const res = await fetch("/api/analytics/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId: data.cycle.id }),
    });
    if (res.ok) {
      const d = await res.json();
      setReportHtml(d.html);
      setEditableHtml(d.html);
      setReportStub(d.stub ?? false);
    }
    setReportLoading(false);
  }

  async function saveReport() {
    if (!editableHtml || !data?.cycle) return;
    setReportSaving(true);
    const fileName = `Pulse360-Report-${data.cycle.name.replace(/\s+/g, "-")}.html`;
    const downloadsPath = `C:\\Users\\RomeoNdlovu\\Downloads\\${fileName}`;
    // Call MCP tool via the app's proxy endpoint
    const res = await fetch("/api/mcp/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputPath: downloadsPath,
        htmlContent: editableHtml,
        reportTitle: `Pulse360 Performance Report — ${data.cycle.name}`,
      }),
    });
    if (res.ok) {
      setReportSaved(downloadsPath);
    }
    setReportSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading analytics…</div>;
  }

  const hasCycles = data && data.allCycles.length > 0;
  const hasCycleData = data?.cycle !== null;

  // ── Compute stats for current cycle ────────────────────────────────────────
  const orgAverages: Record<number, number | null> = {};
  if (data) {
    for (const crit of data.criteria) {
      const scores = data.departments
        .map((d) => data.data[d.id]?.[crit.id])
        .filter((v): v is number => v !== null);
      orgAverages[crit.id] = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;
    }
  }

  const deptOverallsSorted = data
    ? data.departments
        .map((d) => ({ dept: d, avg: data.deptOveralls[d.id] ?? null }))
        .filter((x) => x.avg !== null)
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    : [];

  const orgOverall = deptOverallsSorted.length
    ? Math.round((deptOverallsSorted.reduce((s, x) => s + (x.avg ?? 0), 0) / deptOverallsSorted.length) * 100) / 100
    : null;

  const pieSlices = deptOverallsSorted.map((x, i) => ({
    label: x.dept.name,
    value: x.avg ?? 0,
    colour: PIE_COLOURS[i % PIE_COLOURS.length],
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          {data?.cycle && (
            <p className="text-sm text-gray-500 mt-1">
              Viewing: <strong>{data.cycle.name}</strong>
              &nbsp;·&nbsp;
              {new Date(data.cycle.startDate).toLocaleDateString()} – {new Date(data.cycle.endDate).toLocaleDateString()}
              &nbsp;·&nbsp; Phase: <span className="font-medium">{data.cycle.phase}</span>
            </p>
          )}
        </div>

        {/* Cycle selector */}
        {hasCycles && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs text-gray-500 font-medium">Cycle:</label>
            <select
              value={selectedCycleId ?? ""}
              onChange={(e) => handleCycleChange(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20"
            >
              {data!.allCycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phase})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* No data state */}
      {!hasCycleData && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 font-semibold text-sm">No results available yet</p>
          <p className="text-gray-400 text-xs mt-1">Analytics appear once a cycle reaches the Consultation phase.</p>
        </div>
      )}

      {hasCycleData && data && (
        <>
          {/* ── Row 1: Org overall + Pie ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Org overall score */}
            <div className="bg-[#0f1f3d] rounded-xl p-6 text-white flex flex-col justify-center">
              <p className="text-xs text-blue-200 uppercase tracking-wider mb-1">Organisation Overall</p>
              <div className="text-5xl font-black">{orgOverall?.toFixed(2) ?? "—"}</div>
              <p className="text-blue-200 text-sm mt-1">Average across all departments · Scale 1–5</p>
              <p className="text-xs text-blue-300 mt-2">{data.cycle!.name}</p>
            </div>

            {/* Pie chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Department Average Score Distribution</h2>
              <PieChart slices={pieSlices} />
            </div>
          </div>

          {/* ── Row 2: Top / Bottom ──────────────────────────────────────── */}
          {deptOverallsSorted.length >= 2 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3">Top Performers</p>
                <div className="space-y-2">
                  {deptOverallsSorted.slice(0, 3).map(({ dept, avg }) => (
                    <div key={dept.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800">{dept.name}</span>
                      <span className="text-sm font-bold text-green-700">{avg?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">Growth Opportunity</p>
                <div className="space-y-2">
                  {[...deptOverallsSorted].reverse().slice(0, 3).map(({ dept, avg }) => (
                    <div key={dept.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800">{dept.name}</span>
                      <span className="text-sm font-bold text-amber-700">{avg?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Row 3: Historical Trend ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Historical Trend — Org Average per Criterion</h2>
            <p className="text-xs text-gray-400 mb-4">Score per criterion across all closed cycles</p>
            <TrendBars trends={data.trends} criteria={data.criteria} />
          </div>

          {/* ── Row 4: Heatmap ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
            {/* Legend */}
            <div className="flex items-center gap-2 px-6 pt-5 pb-3 flex-wrap border-b border-gray-100">
              <span className="text-xs text-gray-500 font-semibold mr-1">Score:</span>
              {[
                { label: "< 2.5 Needs Work", cls: "bg-red-500 text-white" },
                { label: "2.5 Developing", cls: "bg-orange-400 text-white" },
                { label: "3.0 Meets", cls: "bg-amber-200 text-amber-900" },
                { label: "3.5 Good", cls: "bg-green-300 text-green-900" },
                { label: "4.0 Exceeds", cls: "bg-green-500 text-white" },
                { label: "4.5+ Exceptional", cls: "bg-green-700 text-white" },
              ].map((item) => (
                <span key={item.label} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${item.cls}`}>
                  {item.label}
                </span>
              ))}
            </div>

            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-[#0f1f3d] text-white">
                  <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider w-44">Department</th>
                  {data.criteria.map((c) => (
                    <th key={c.id} className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider">{c.name}</th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider text-blue-300">Overall</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((dept, idx) => {
                  const deptScores = data.criteria
                    .map((c) => data.data[dept.id]?.[c.id])
                    .filter((v): v is number => v !== null);
                  const deptAvg = deptScores.length
                    ? Math.round((deptScores.reduce((a, b) => a + b, 0) / deptScores.length) * 100) / 100
                    : null;

                  return (
                    <tr key={dept.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-5 py-3 font-medium text-gray-800 text-xs">{dept.name}</td>
                      {data.criteria.map((crit) => {
                        const score = data.data[dept.id]?.[crit.id] ?? null;
                        const isHovered = tooltip?.deptId === dept.id && tooltip?.critId === crit.id;
                        return (
                          <td key={crit.id} className="px-2 py-2 text-center relative">
                            <div
                              className={`mx-auto w-16 h-10 rounded-lg flex flex-col items-center justify-center cursor-default transition-transform hover:scale-110 ${scoreColor(score)}`}
                              onMouseEnter={() => setTooltip({ deptId: dept.id, critId: crit.id })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <span className="text-sm font-bold leading-none">{score !== null ? score.toFixed(2) : "—"}</span>
                              {isHovered && score !== null && (
                                <span className="text-[9px] leading-none mt-0.5 opacity-90">{scoreLabel(score)}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <div className={`mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${scoreColor(deptAvg)} ring-2 ring-white`}>
                          {deptAvg !== null ? deptAvg.toFixed(2) : "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Org average row */}
                <tr className="bg-[#0f1f3d]/5 border-t-2 border-[#0f1f3d]/20">
                  <td className="px-5 py-3 font-bold text-[#0f1f3d] text-xs uppercase tracking-wider">Org Average</td>
                  {data.criteria.map((crit) => {
                    const score = orgAverages[crit.id];
                    return (
                      <td key={crit.id} className="px-2 py-2 text-center">
                        <div className={`mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm ring-2 ring-[#0f1f3d]/20 ${scoreColor(score)}`}>
                          {score !== null ? score.toFixed(2) : "—"}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">
                    <div className="mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-[#0f1f3d] text-white">
                      {orgOverall?.toFixed(2) ?? "—"}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Row 5: PDF Report Generator ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#0f1f3d] uppercase tracking-wider">PDF Report Generator</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  AI generates a narrative report. Review and optionally edit before saving.
                </p>
              </div>
              {!reportHtml && (
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="flex items-center gap-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition"
                >
                  {reportLoading ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Generating…
                    </>
                  ) : "✨ Generate AI Report"}
                </button>
              )}
              {reportHtml && !reportApproved && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setReportEditing((e) => !e)}
                    className="text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {reportEditing ? "Preview" : "Edit"}
                  </button>
                  <button
                    onClick={() => { setReportApproved(true); setReportEditing(false); }}
                    className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    Approve & Save
                  </button>
                  <button
                    onClick={() => { setReportHtml(null); setReportApproved(false); setReportEditing(false); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
                  >
                    ✕
                  </button>
                </div>
              )}
              {reportApproved && !reportSaved && (
                <button
                  onClick={saveReport}
                  disabled={reportSaving}
                  className="flex items-center gap-2 text-xs font-semibold bg-[#0f1f3d] hover:bg-[#1a3160] disabled:opacity-60 text-white px-4 py-2 rounded-lg transition"
                >
                  {reportSaving ? "Saving…" : "Save to Downloads"}
                </button>
              )}
            </div>

            {reportStub && reportHtml && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
                Demo mode — add OPENAI_API_KEY for AI-generated narrative
              </div>
            )}

            {reportHtml && !reportApproved && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-700">Human-in-the-Loop Review</span>
                  <span className="text-xs text-amber-600">— Review the AI-generated report below before approving it for download.</span>
                </div>
                {reportEditing ? (
                  <textarea
                    value={editableHtml}
                    onChange={(e) => setEditableHtml(e.target.value)}
                    className="w-full h-96 font-mono text-xs p-4 focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    className="p-4 max-h-96 overflow-y-auto prose prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: editableHtml }}
                  />
                )}
              </div>
            )}

            {reportApproved && !reportSaved && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                Report approved. Click <strong>Save to Downloads</strong> to write the HTML file via the MCP tool. Open it in a browser and use Print → Save as PDF.
              </div>
            )}

            {reportSaved && (
              <div className="bg-[#0f1f3d] text-white rounded-lg px-4 py-3 text-sm">
                ✅ Report saved to <code className="text-blue-200 text-xs">{reportSaved}</code>
                <br /><span className="text-xs text-blue-200 mt-1 block">Open in a browser → File → Print → Save as PDF</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
