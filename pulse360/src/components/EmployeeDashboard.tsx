"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DashboardData = {
  activeCycle: { id: number; name: string; phase: string; startDate: string; endDate: string } | null;
  myNominations: number;
  myPendingReviews: number;
  mySubmittedReviews: number;
  resultsAvailable: boolean;
  manager: { firstName: string; lastName: string; jobTitle: string | null; department: { name: string } } | null;
  refreshedAt: string;
};

const PHASES = ["NOMINATE", "APPROVE", "REVIEW", "CONSULTATION", "ACCEPT"];
const PHASE_LABELS: Record<string, string> = { NOMINATE: "Nominate", APPROVE: "Approvals", REVIEW: "Peer reviews", CONSULTATION: "Manager review", ACCEPT: "Results" };

function Metric({ label, value, detail, colour }: { label: string; value: string | number; detail: string; colour: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-5 relative overflow-hidden"><div className={`absolute inset-x-0 top-0 h-1 ${colour}`} /><p className="text-[11px] uppercase tracking-[.16em] font-bold text-gray-400">{label}</p><p className="text-3xl font-black text-gray-900 mt-3 leading-none">{value}</p><p className="text-xs text-gray-500 mt-2">{detail}</p></div>;
}

function phaseIndex(phase: string) { return PHASES.indexOf(phase); }

export function EmployeeDashboard({ name }: { name: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch("/api/dashboard/employee", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load your dashboard");
      setData(await response.json() as DashboardData);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load your dashboard"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  if (loading || !data) return <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-400">Loading your workspace…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700"><strong>Dashboard unavailable.</strong><p className="mt-1">{error}</p><button onClick={() => load()} className="mt-4 px-3 py-2 rounded-lg bg-red-700 text-white text-xs font-bold">Try again</button></div>;

  const firstName = name?.split(" ")[0] ?? "there";
  const actions = data.myNominations + data.myPendingReviews;
  const currentIndex = data.activeCycle ? phaseIndex(data.activeCycle.phase) : -1;
  const statusText = actions ? `${actions} action${actions === 1 ? "" : "s"} needs your attention` : "You are all caught up";

  return <div className="space-y-6">
    <div className={`rounded-2xl p-7 text-white relative overflow-hidden ${actions ? "bg-[#0f1f3d]" : "bg-gradient-to-r from-emerald-600 to-teal-600"}`}><div className="absolute -right-12 -top-16 w-64 h-64 rounded-full bg-white opacity-5" /><div className="relative flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-medium text-blue-200 mb-1">{statusText}</p><h1 className="text-2xl font-black tracking-tight">Hi, {firstName}</h1><p className="text-sm text-blue-200 mt-1.5">{data.activeCycle ? `${data.activeCycle.name} · ${PHASE_LABELS[data.activeCycle.phase] ?? data.activeCycle.phase}` : "No active review cycle at the moment"}</p></div><div className="flex items-center gap-2 text-xs text-blue-200"><span className={`w-2 h-2 rounded-full ${refreshing ? "bg-blue-300 animate-pulse" : "bg-emerald-300"}`} />{refreshing ? "Updating" : "Live"}</div></div>{data.activeCycle && <div className="mt-7"><div className="flex justify-between text-[10px] text-blue-200 mb-2"><span>Cycle progress</span><span>{PHASE_LABELS[data.activeCycle.phase] ?? data.activeCycle.phase}</span></div><div className="flex items-center gap-1.5">{PHASES.map((phase, index) => <div key={phase} className="flex-1"><div className={`h-2 rounded-full ${index <= currentIndex ? "bg-emerald-400" : "bg-white/20"}`} /><p className="text-[9px] text-blue-200 mt-1 truncate">{PHASE_LABELS[phase]}</p></div>)}</div></div>}</div>

    {actions > 0 && <div className="grid md:grid-cols-2 gap-4">{data.myNominations > 0 && <Link href="/nominations" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:bg-amber-100 transition"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">{data.myNominations}</span><div><p className="text-sm font-bold text-amber-900">Finish your nominations</p><p className="text-xs text-amber-700 mt-1">Draft reviewers are waiting to be submitted.</p></div><span className="ml-auto text-amber-500 text-xl">›</span></div></Link>}{data.myPendingReviews > 0 && <Link href="/reviews" className="bg-purple-50 border border-purple-200 rounded-2xl p-5 hover:bg-purple-100 transition"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center font-black">{data.myPendingReviews}</span><div><p className="text-sm font-bold text-purple-900">Complete your reviews</p><p className="text-xs text-purple-700 mt-1">Approved review assignments need your feedback.</p></div><span className="ml-auto text-purple-500 text-xl">›</span></div></Link>}</div>}

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Metric label="Nominations" value={data.myNominations || "✓"} detail={data.myNominations ? "drafts to submit" : "all submitted"} colour={data.myNominations ? "bg-amber-500" : "bg-emerald-500"} /><Metric label="Reviews pending" value={data.myPendingReviews || "✓"} detail={data.myPendingReviews ? "awaiting your feedback" : "all complete"} colour={data.myPendingReviews ? "bg-purple-500" : "bg-emerald-500"} /><Metric label="Reviews submitted" value={data.mySubmittedReviews} detail="in the current cycle" colour="bg-blue-500" /></div>

    <div className="grid lg:grid-cols-3 gap-6"><div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6"><div className="flex items-center justify-between mb-5"><div><h2 className="text-base font-bold text-gray-900">Your next steps</h2><p className="text-xs text-gray-500 mt-1">Keep the cycle moving with the actions that matter now.</p></div><span className="text-xs text-gray-400">{actions ? `${actions} open` : "No open actions"}</span></div><div className="grid sm:grid-cols-3 gap-3"><Link href="/nominations" className="rounded-xl border border-gray-100 p-4 hover:border-blue-300 hover:bg-blue-50 transition"><p className="text-xl mb-3">◎</p><p className="text-sm font-bold text-gray-900">Nominate peers</p><p className="text-xs text-gray-500 mt-1">Choose reviewers for your cycle.</p></Link><Link href="/reviews" className="rounded-xl border border-gray-100 p-4 hover:border-purple-300 hover:bg-purple-50 transition"><p className="text-xl mb-3">✓</p><p className="text-sm font-bold text-gray-900">Give feedback</p><p className="text-xs text-gray-500 mt-1">Complete assigned reviews.</p></Link><Link href="/my-results" className="rounded-xl border border-gray-100 p-4 hover:border-emerald-300 hover:bg-emerald-50 transition"><p className="text-xl mb-3">↗</p><p className="text-sm font-bold text-gray-900">View results</p><p className="text-xs text-gray-500 mt-1">{data.resultsAvailable ? "Your latest cycle is ready." : "Results appear after release."}</p></Link></div></div><div className="bg-white rounded-2xl border border-gray-100 p-6">{data.manager ? <><p className="text-[11px] uppercase tracking-[.16em] font-bold text-gray-400 mb-4">Your line manager</p><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold">{data.manager.firstName.charAt(0)}</div><div><p className="text-sm font-bold text-gray-900">{data.manager.firstName} {data.manager.lastName}</p><p className="text-xs text-gray-500 mt-1">{data.manager.jobTitle ?? data.manager.department.name}</p></div></div><p className="text-xs text-gray-400 mt-5">Your manager is automatically included as a reviewer.</p></> : <><p className="text-sm font-bold text-gray-900">Manager mapping</p><p className="text-xs text-gray-500 mt-2">Your line manager has not been assigned yet. Contact HR if this looks incorrect.</p></>}</div></div>
  </div>;
}
