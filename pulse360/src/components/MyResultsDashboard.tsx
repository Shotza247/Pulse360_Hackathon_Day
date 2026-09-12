"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { SelfAssessmentPanel } from "@/components/SelfAssessmentPanel";

type CycleResult = {
  cycle: { id: number; name: string; startDate: string; endDate: string; phase: string };
  overall: number | null;
  reviewCount: number;
  criteria: { id: number; name: string; score: number }[];
  comments: { doWellComment: string | null; improveComment: string | null; attentionComment: string | null }[];
};

function Metric({ label, value, detail, colour }: { label: string; value: string; detail: string; colour: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-5 relative overflow-hidden"><div className={`absolute inset-x-0 top-0 h-1 ${colour}`} /><p className="text-[11px] uppercase tracking-[.16em] font-bold text-gray-400">{label}</p><p className="text-3xl font-black text-gray-900 mt-3 leading-none">{value}</p><p className="text-xs text-gray-500 mt-2">{detail}</p></div>;
}

function ScoreBar({ name, score }: { name: string; score: number }) {
  return <div><div className="flex justify-between items-center mb-1.5"><span className="text-sm font-medium text-gray-700">{name}</span><span className="text-sm font-black text-gray-900">{score.toFixed(2)}</span></div><div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-[#0f1f3d] transition-all duration-500" style={{ width: `${Math.min(100, score / 5 * 100)}%` }} /></div></div>;
}

export function MyResultsDashboard({ employeeId }: { employeeId: number }) {
  const [data, setData] = useState<CycleResult[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch("/api/my-results", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load your results");
      const payload = await response.json() as { results: CycleResult[]; refreshedAt: string };
      setData(payload.results);
      setSelectedId((current) => payload.results.some((item) => item.cycle.id === current) ? current : payload.results.at(-1)?.cycle.id ?? null);
      setUpdatedAt(new Date(payload.refreshedAt));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load your results"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const selected = data.find((item) => item.cycle.id === selectedId) ?? data.at(-1);
  const first = data[0];
  const last = data.at(-1);
  const change = first && last && first.overall !== null && last.overall !== null ? last.overall - first.overall : null;
  const strongest = useMemo(() => selected?.criteria.slice().sort((a, b) => b.score - a.score)[0], [selected]);

  if (loading) return <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-400">Loading your results…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700"><strong>Results unavailable.</strong><p className="mt-1">{error}</p><button onClick={() => load()} className="mt-4 px-3 py-2 rounded-lg bg-red-700 text-white text-xs font-bold">Try again</button></div>;
  if (!selected) return <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center"><p className="text-gray-700 text-sm font-semibold">Your results are not available yet.</p><p className="text-gray-400 text-xs mt-1">Results appear when a cycle is released by HR.</p></div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black text-gray-900">My Results</h1><p className="text-sm text-gray-500 mt-1">A clear view of your performance and growth across released cycles.</p></div><div className="flex items-center gap-3 text-xs text-gray-400"><span className={`inline-flex items-center gap-1.5 ${refreshing ? "text-blue-600" : "text-emerald-600"}`}><span className={`w-2 h-2 rounded-full ${refreshing ? "bg-blue-500 animate-pulse" : "bg-emerald-500"}`} />{refreshing ? "Updating" : "Live"}</span>{updatedAt && <span>Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}</div></div>
    <div className="bg-[#0f1f3d] rounded-2xl p-6 text-white relative overflow-hidden"><div className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-white opacity-5" /><div className="relative flex flex-wrap items-center justify-between gap-5"><div><p className="text-blue-200 text-xs uppercase tracking-widest font-bold">Results overview</p><h2 className="text-xl font-black mt-2">{selected.cycle.name}</h2><p className="text-blue-200 text-xs mt-1">{new Date(selected.cycle.startDate).toLocaleDateString("en-ZA")} – {new Date(selected.cycle.endDate).toLocaleDateString("en-ZA")}</p></div>{data.length > 1 ? <label className="text-xs text-blue-100">View cycle<select value={selected.cycle.id} onChange={(event) => setSelectedId(Number(event.target.value))} className="block mt-1 min-w-[210px] rounded-lg border-0 px-3 py-2 text-sm font-bold text-gray-900">{data.slice().reverse().map((item) => <option key={item.cycle.id} value={item.cycle.id}>{item.cycle.name}</option>)}</select></label> : <span className="text-xs font-bold px-3 py-2 rounded-full bg-white/10">Only released cycle</span>}</div></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Metric label="Overall score" value={selected.overall === null ? "—" : `${selected.overall.toFixed(2)}/5`} detail="Anonymous peer feedback" colour="bg-blue-500" /><Metric label="Reviews received" value={String(selected.reviewCount)} detail="Submitted responses" colour="bg-emerald-500" /><Metric label="Strongest area" value={strongest ? strongest.score.toFixed(2) : "—"} detail={strongest?.name ?? "No criterion data"} colour="bg-amber-500" /><Metric label="Across cycles" value={change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}`} detail={data.length > 1 ? `${data.length} released cycles` : "Available after next cycle"} colour="bg-purple-500" /></div>
    {data.length > 1 && <div className="bg-white rounded-2xl border border-gray-100 p-6"><div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="text-base font-bold text-gray-900">Performance over time</h2><p className="text-xs text-gray-500 mt-1">Your overall score from the first released cycle to the latest.</p></div><span className="text-xs font-bold text-gray-500">{first?.overall?.toFixed(2) ?? "—"} → {last?.overall?.toFixed(2) ?? "—"}</span></div><div className="flex items-end gap-3 h-32">{data.map((item) => <button key={item.cycle.id} onClick={() => setSelectedId(item.cycle.id)} className={`flex-1 min-w-0 group ${item.cycle.id === selected.cycle.id ? "" : "opacity-60 hover:opacity-100"}`} title={`View ${item.cycle.name}`}><div className="h-24 flex items-end justify-center"><div className={`w-full max-w-16 rounded-t-lg transition-all ${item.cycle.id === selected.cycle.id ? "bg-[#0f1f3d]" : "bg-blue-300"}`} style={{ height: `${Math.max(8, (item.overall ?? 0) / 5 * 100)}%` }} /></div><p className="text-[10px] text-gray-500 truncate mt-2">{item.cycle.name}</p><p className="text-xs font-black text-gray-800 mt-1">{item.overall?.toFixed(2) ?? "—"}</p></button>)}</div></div>}
    <div className="grid lg:grid-cols-2 gap-6"><div className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="text-base font-bold text-gray-900 mb-5">Score by criterion</h2><div className="space-y-5">{selected.criteria.length ? selected.criteria.map((criterion) => <ScoreBar key={criterion.id} name={criterion.name} score={criterion.score} />) : <p className="text-sm text-gray-400">No criterion breakdown is available.</p>}</div></div><div className="bg-white rounded-2xl border border-gray-100 p-6"><h2 className="text-base font-bold text-gray-900 mb-2">What to carry forward</h2><p className="text-xs text-gray-500 mb-5">Use your strongest areas and feedback themes to plan your next steps.</p>{selected.comments.filter((comment) => comment.doWellComment).slice(0, 3).map((comment, index) => <p key={index} className="text-sm text-gray-700 bg-emerald-50 border-l-2 border-emerald-400 rounded-r-lg px-3 py-2 mb-2">{comment.doWellComment}</p>)}{!selected.comments.some((comment) => comment.doWellComment) && <p className="text-sm text-gray-400">Your feedback themes will appear here when comments are available.</p>}</div></div>
    <AISummaryPanel employeeId={employeeId} cycleId={selected.cycle.id} employeeName="you" />
    <SelfAssessmentPanel cycleId={selected.cycle.id} criterionResults={selected.criteria.map((criterion) => ({ criterionId: criterion.id, criterion: { id: criterion.id, name: criterion.name }, avgScore: criterion.score }))} employeeName="you" />
  </div>;
}
