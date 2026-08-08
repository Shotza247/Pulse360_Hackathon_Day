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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function ReportBarList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number | null }[];
}) {
  const visibleRows = rows.filter((row) => row.value !== null).slice(0, 8);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f1f3d] mb-3">{title}</h3>
      {visibleRows.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No report data available</p>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => {
            const value = row.value ?? 0;
            const width = `${Math.max(4, Math.min(100, (value / 5) * 100))}%`;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                  <span className="font-medium text-gray-700 truncate">{row.label}</span>
                  <span className="font-bold text-[#0f1f3d]">{value.toFixed(2)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#3b82d4]" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExecutiveReportPreview({
  narrativeHtml,
  cycleName,
  orgOverall,
  departments,
  criteria,
}: {
  narrativeHtml: string;
  cycleName: string;
  orgOverall: number | null;
  departments: { label: string; value: number | null }[];
  criteria: { label: string; value: number | null }[];
}) {
  const topDepartment = [...departments]
    .filter((row) => row.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];

  return (
    <div className="bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-gray-200">
        <div className="rounded-xl bg-[#0f1f3d] text-white p-4">
          <p className="text-xs text-blue-200 uppercase tracking-wider">Overall Score</p>
          <p className="text-3xl font-black mt-1">{orgOverall !== null ? orgOverall.toFixed(2) : "-"}</p>
          <p className="text-xs text-blue-200 mt-1">Scale 1-5</p>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Cycle</p>
          <p className="text-sm font-bold text-gray-900 mt-2">{cycleName}</p>
        </div>
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Top Department</p>
          <p className="text-sm font-bold text-gray-900 mt-2">{topDepartment?.label ?? "No data yet"}</p>
          {topDepartment?.value !== null && topDepartment?.value !== undefined && (
            <p className="text-xs text-green-700 font-semibold mt-1">{topDepartment.value.toFixed(2)} average</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-b border-gray-200">
        <ReportBarList title="Department Score Dashboard" rows={departments} />
        <ReportBarList title="Criteria Score Dashboard" rows={criteria} />
      </div>

      <div className="p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f1f3d] mb-3">Executive Narrative</h3>
        <div
          className="prose prose-sm max-w-none text-sm bg-white rounded-xl border border-gray-200 p-4"
          dangerouslySetInnerHTML={{ __html: narrativeHtml }}
        />
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
    const departments = deptOverallsSorted.map(({ dept, avg }) => ({ label: dept.name, value: avg }));
    const criteria = data.criteria.map((criterion) => ({
      label: criterion.name,
      value: orgAverages[criterion.id] ?? null,
    }));
    const topDepartment = [...departments]
      .filter((row) => row.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    const barRows = (rows: { label: string; value: number | null }[]) => rows
      .filter((row) => row.value !== null)
      .slice(0, 10)
      .map((row) => {
        const value = row.value ?? 0;
        const width = Math.max(4, Math.min(100, (value / 5) * 100));
        return `
          <div class="bar-row">
            <div class="bar-meta"><span>${escapeHtml(row.label)}</span><strong>${value.toFixed(2)}</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          </div>`;
      })
      .join("");

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=850");
    if (!printWindow) {
      setReportSaving(false);
      setReportSaved("Popup blocked. Allow popups, then try Print / Save PDF again.");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pulse360 Report - ${escapeHtml(data.cycle.name)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .sheet { max-width: 980px; margin: 0 auto; background: #fff; min-height: 100vh; }
    .hero { background: #0f1f3d; color: #fff; padding: 28px 32px; }
    .hero h1 { margin: 0; font-size: 24px; line-height: 1.2; }
    .hero p { margin: 8px 0 0; color: #bfdbfe; font-size: 13px; }
    .section { padding: 22px 32px; border-bottom: 1px solid #e5e7eb; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: #fff; }
    .card.dark { background: #0f1f3d; color: #fff; border-color: #0f1f3d; }
    .label { color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .dark .label { color: #bfdbfe; }
    .metric { margin-top: 8px; font-size: 30px; font-weight: 900; line-height: 1; }
    .value { margin-top: 8px; font-size: 15px; font-weight: 800; }
    .subtle { margin-top: 6px; color: #6b7280; font-size: 12px; }
    .dark .subtle { color: #bfdbfe; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    h2 { margin: 0 0 14px; color: #0f1f3d; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
    .panel { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; break-inside: avoid; }
    .bar-row { margin-bottom: 12px; }
    .bar-meta { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin-bottom: 5px; }
    .bar-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { height: 10px; border-radius: 999px; background: #e5e7eb; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; background: #3b82d4; }
    .narrative { font-size: 13px; line-height: 1.55; }
    .narrative h1, .narrative h2, .narrative h3 { color: #0f1f3d; text-transform: none; letter-spacing: 0; }
    .footer { padding: 16px 32px 28px; color: #6b7280; font-size: 11px; }
    .no-print { padding: 12px 32px; background: #ecfdf5; color: #166534; font-size: 13px; border-bottom: 1px solid #bbf7d0; }
    @media print {
      body { background: #fff; }
      .sheet { max-width: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="no-print">Use your browser print dialog and choose <strong>Save as PDF</strong>.</div>
    <header class="hero">
      <h1>Pulse360 Executive Performance Report</h1>
      <p>${escapeHtml(data.cycle.name)}</p>
    </header>

    <section class="section cards">
      <div class="card dark">
        <div class="label">Overall Score</div>
        <div class="metric">${orgOverall !== null ? orgOverall.toFixed(2) : "-"}</div>
        <div class="subtle">Scale 1-5</div>
      </div>
      <div class="card">
        <div class="label">Cycle</div>
        <div class="value">${escapeHtml(data.cycle.name)}</div>
      </div>
      <div class="card">
        <div class="label">Top Department</div>
        <div class="value">${escapeHtml(topDepartment?.label ?? "No data yet")}</div>
        <div class="subtle">${topDepartment?.value !== null && topDepartment?.value !== undefined ? `${topDepartment.value.toFixed(2)} average` : ""}</div>
      </div>
    </section>

    <section class="section grid">
      <div class="panel">
        <h2>Department Score Dashboard</h2>
        ${barRows(departments) || "<p class=\"subtle\">No department data available.</p>"}
      </div>
      <div class="panel">
        <h2>Criteria Score Dashboard</h2>
        ${barRows(criteria) || "<p class=\"subtle\">No criteria data available.</p>"}
      </div>
    </section>

    <section class="section">
      <h2>Executive Narrative</h2>
      <div class="narrative">${editableHtml}</div>
    </section>

    <footer class="footer">Generated by Pulse360. Human-reviewed by HR before export.</footer>
  </main>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setReportSaved("Print dialog opened. Choose Save as PDF in your browser.");
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
                  AI generates a narrative report with executive analytics dashboards for HR review.
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
                    Approve Report
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
                  {reportSaving ? "Preparing..." : "Print / Save PDF"}
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
                  <div className="max-h-[42rem] overflow-y-auto">
                    <ExecutiveReportPreview
                      narrativeHtml={editableHtml}
                      cycleName={data.cycle!.name}
                      orgOverall={orgOverall}
                      departments={deptOverallsSorted.map(({ dept, avg }) => ({ label: dept.name, value: avg }))}
                      criteria={data.criteria.map((criterion) => ({
                        label: criterion.name,
                        value: orgAverages[criterion.id] ?? null,
                      }))}
                    />
                  </div>
                )}
              </div>
            )}

            {reportApproved && !reportSaved && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                Report approved. Click <strong>Print / Save PDF</strong>, then choose Save as PDF in your browser.
              </div>
            )}

            {reportSaved && (
              <div className="bg-[#0f1f3d] text-white rounded-lg px-4 py-3 text-sm">
                <span>{reportSaved}</span>
                <br /><span className="text-xs text-blue-200 mt-1 block">The PDF will contain the executive cards, dashboard bars, and narrative from the preview.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
