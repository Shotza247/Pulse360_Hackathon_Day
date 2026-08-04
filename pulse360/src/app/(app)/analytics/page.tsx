"use client";

import { useState, useEffect } from "react";

type Criterion = { id: number; name: string };
type Department = { id: number; name: string };
type HeatmapData = {
  cycle: { id: number; name: string } | null;
  departments: Department[];
  criteria: Criterion[];
  data: Record<number, Record<number, number | null>>;
};

function getColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 4.5) return "bg-green-700 text-white";
  if (score >= 4.0) return "bg-green-500 text-white";
  if (score >= 3.5) return "bg-green-300 text-green-900";
  if (score >= 3.0) return "bg-amber-200 text-amber-900";
  if (score >= 2.5) return "bg-amber-400 text-amber-900";
  if (score >= 2.0) return "bg-orange-400 text-white";
  return "bg-red-500 text-white";
}

function getLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 4.5) return "Exceptional";
  if (score >= 4.0) return "Exceeds";
  if (score >= 3.5) return "Good";
  if (score >= 3.0) return "Meets";
  if (score >= 2.5) return "Developing";
  return "Needs Work";
}

export default function AnalyticsPage() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ deptId: number; critId: number } | null>(null);

  useEffect(() => {
    fetch("/api/analytics/heatmap")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading analytics…
      </div>
    );
  }

  if (!data?.cycle) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Analytics</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 font-semibold text-sm">No results available yet</p>
          <p className="text-gray-400 text-xs mt-1">Analytics will appear once a cycle reaches the Consultation phase.</p>
        </div>
      </div>
    );
  }

  // Compute org-wide averages per criterion
  const orgAverages: Record<number, number | null> = {};
  for (const crit of data.criteria) {
    const scores = data.departments
      .map((d) => data.data[d.id]?.[crit.id])
      .filter((v): v is number => v !== null);
    orgAverages[crit.id] = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
  }

  // Best / worst departments (by overall avg)
  const deptOveralls = data.departments.map((dept) => {
    const scores = data.criteria
      .map((c) => data.data[dept.id]?.[c.id])
      .filter((v): v is number => v !== null);
    const avg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
    return { dept, avg };
  }).filter((d) => d.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Department Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cycle: <strong>{data.cycle.name}</strong> · Average scores per department × criterion
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-gray-500 font-semibold mr-1">Score Scale:</span>
        {[
          { label: "< 2.5 Needs Work", cls: "bg-red-500 text-white" },
          { label: "2.5 Developing", cls: "bg-orange-400 text-white" },
          { label: "3.0 Meets", cls: "bg-amber-200 text-amber-900" },
          { label: "3.5 Good", cls: "bg-green-300 text-green-900" },
          { label: "4.0 Exceeds", cls: "bg-green-500 text-white" },
          { label: "4.5+ Exceptional", cls: "bg-green-700 text-white" },
        ].map((item) => (
          <span key={item.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.cls}`}>
            {item.label}
          </span>
        ))}
      </div>

      {/* Heatmap table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto mb-8">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-[#0f1f3d] text-white">
              <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider w-44">
                Department
              </th>
              {data.criteria.map((c) => (
                <th key={c.id} className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider">
                  {c.name}
                </th>
              ))}
              <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider text-blue-300">
                Overall
              </th>
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
                          className={`mx-auto w-16 h-10 rounded-lg flex flex-col items-center justify-center cursor-default transition-transform hover:scale-110 ${getColor(score)}`}
                          onMouseEnter={() => setTooltip({ deptId: dept.id, critId: crit.id })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span className="text-sm font-bold leading-none">
                            {score !== null ? score.toFixed(2) : "—"}
                          </span>
                          {isHovered && score !== null && (
                            <span className="text-[9px] leading-none mt-0.5 opacity-90">
                              {getLabel(score)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {/* Department overall */}
                  <td className="px-2 py-2 text-center">
                    <div className={`mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${getColor(deptAvg)} ring-2 ring-white`}>
                      {deptAvg !== null ? deptAvg.toFixed(2) : "—"}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Org average footer row */}
            <tr className="bg-[#0f1f3d]/5 border-t-2 border-[#0f1f3d]/20">
              <td className="px-5 py-3 font-bold text-[#0f1f3d] text-xs uppercase tracking-wider">
                Org Average
              </td>
              {data.criteria.map((crit) => {
                const score = orgAverages[crit.id];
                return (
                  <td key={crit.id} className="px-2 py-2 text-center">
                    <div className={`mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm ring-2 ring-[#0f1f3d]/20 ${getColor(score)}`}>
                      {score !== null ? score.toFixed(2) : "—"}
                    </div>
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center">
                <div className="mx-auto w-16 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-[#0f1f3d] text-white">
                  {(() => {
                    const all = Object.values(orgAverages).filter((v): v is number => v !== null);
                    return all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(2) : "—";
                  })()}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top / Bottom departments */}
      {deptOveralls.length >= 2 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3">🏆 Top Performers</p>
            <div className="space-y-2">
              {deptOveralls.slice(0, 3).map(({ dept, avg }) => (
                <div key={dept.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{dept.name}</span>
                  <span className="text-sm font-bold text-green-700">{avg?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">📈 Growth Opportunity</p>
            <div className="space-y-2">
              {deptOveralls.slice(-3).reverse().map(({ dept, avg }) => (
                <div key={dept.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{dept.name}</span>
                  <span className="text-sm font-bold text-amber-700">{avg?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
