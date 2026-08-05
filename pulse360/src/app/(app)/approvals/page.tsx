"use client";

import { useState, useEffect, useCallback } from "react";

type Department = { name: string };
type Person = { id: number; firstName: string; lastName: string; jobTitle: string | null; department: Department };
type Nomination = {
  id: number;
  employeeId: number;
  reviewerId: number;
  isMandatory: boolean;
  employee: Person;
  reviewer: Person;
};
type Cycle = { id: number; name: string; phase: string };

export default function ApprovalsPage() {
  const [role, setRole] = useState<string>("");
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sessionRes, nomRes] = await Promise.all([
      fetch("/api/auth/session"),
      fetch("/api/approvals?pending=true"),
    ]);
    const sessionData = await sessionRes.json();
    setRole(sessionData?.user?.role ?? "");

    if (nomRes.ok) {
      const noms: Nomination[] = await nomRes.json();
      setNominations(noms);
      // Derive cycle from nominations context via cycles/list
      const cycleRes = await fetch("/api/cycles/list");
      const cycles: Cycle[] = cycleRes.ok ? await cycleRes.json() : [];
      const activeCycle = cycles.find((c) => ["APPROVE", "NOMINATE"].includes(c.phase)) ?? null;
      setCycle(activeCycle);
    } else {
      setNominations([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group by employee
  const byEmployee = nominations.reduce<Record<number, Nomination[]>>((acc, n) => {
    if (!acc[n.employeeId]) acc[n.employeeId] = [];
    acc[n.employeeId].push(n);
    return acc;
  }, {});

  async function approveOne(nomId: number) {
    const key = `nom-${nomId}`;
    setBusy((b) => new Set(b).add(key));
    const res = await fetch(`/api/approvals/${nomId}/approve`, { method: "POST" });
    if (res.ok || res.status === 303) {
      setNominations((prev) => prev.filter((n) => n.id !== nomId));
      showToast("Nomination approved");
    } else {
      showToast("Approve failed", "error");
    }
    setBusy((b) => { const s = new Set(b); s.delete(key); return s; });
  }

  async function rejectOne(nomId: number) {
    const key = `rej-${nomId}`;
    setBusy((b) => new Set(b).add(key));
    const res = await fetch(`/api/approvals/${nomId}/reject`, { method: "POST" });
    if (res.ok || res.status === 303) {
      setNominations((prev) => prev.filter((n) => n.id !== nomId));
      showToast("Nomination rejected");
    } else {
      showToast("Reject failed", "error");
    }
    setBusy((b) => { const s = new Set(b); s.delete(key); return s; });
  }

  async function approveAllForEmployee(employeeId: number) {
    const key = `bulk-emp-${employeeId}`;
    setBusy((b) => new Set(b).add(key));
    const res = await fetch("/api/approvals/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    const data = await res.json();
    if (res.ok) {
      setNominations((prev) => prev.filter((n) => n.employeeId !== employeeId));
      showToast(`${data.approved} nomination${data.approved !== 1 ? "s" : ""} approved for this employee`);
    } else {
      showToast(data.error ?? "Bulk approve failed", "error");
    }
    setBusy((b) => { const s = new Set(b); s.delete(key); return s; });
  }

  async function approveAll() {
    const key = "bulk-all";
    setBusy((b) => new Set(b).add(key));
    const res = await fetch("/api/approvals/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setNominations([]);
      showToast(`All ${data.approved} pending nominations approved ✓`);
    } else {
      showToast(data.error ?? "Bulk approve failed", "error");
    }
    setBusy((b) => { const s = new Set(b); s.delete(key); return s; });
  }

  const isHR = role === "HR_ADMIN";
  const totalPending = nominations.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading approvals…
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nomination Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {cycle
              ? `Cycle: ${cycle.name} · Phase: ${cycle.phase} · ${totalPending} pending`
              : "No active cycle in approval phase"}
          </p>
        </div>

        {/* HR Admin: Approve All Everyone button */}
        {isHR && totalPending > 0 && (
          <button
            onClick={approveAll}
            disabled={busy.has("bulk-all")}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
          >
            {busy.has("bulk-all") ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Approving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Approve All ({totalPending})
              </>
            )}
          </button>
        )}
      </div>

      {!cycle || totalPending === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-gray-600 font-semibold text-sm">No pending approvals</p>
          <p className="text-gray-400 text-xs mt-1">
            {cycle ? "All nominations have been reviewed." : "No cycle is currently in the approval phase."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(byEmployee).map((noms) => {
            const emp = noms[0].employee;
            const empBusyKey = `bulk-emp-${emp.id}`;
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Employee header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {emp.firstName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-sm text-gray-500">{emp.jobTitle ?? emp.department.name}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                      {noms.length} pending
                    </span>
                    {/* Approve All for this employee */}
                    <button
                      onClick={() => approveAllForEmployee(emp.id)}
                      disabled={busy.has(empBusyKey)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      {busy.has(empBusyKey) ? (
                        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                      Approve All
                    </button>
                  </div>
                </div>

                {/* Individual nominations */}
                <div className="divide-y divide-gray-100">
                  {noms.map((nom) => {
                    const approveBusy = busy.has(`nom-${nom.id}`);
                    const rejectBusy = busy.has(`rej-${nom.id}`);
                    return (
                      <div key={nom.id} className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {nom.reviewer.firstName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {nom.reviewer.firstName} {nom.reviewer.lastName}
                              {nom.isMandatory && (
                                <span className="ml-2 text-xs bg-[#0f1f3d] text-white px-1.5 py-0.5 rounded font-semibold">
                                  Manager
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{nom.reviewer.department.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveOne(nom.id)}
                            disabled={approveBusy || rejectBusy || nom.isMandatory}
                            className="text-xs font-semibold rounded-lg bg-green-600 text-white px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            {approveBusy ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectOne(nom.id)}
                            disabled={approveBusy || rejectBusy || nom.isMandatory}
                            className="text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 hover:bg-red-100 disabled:opacity-50 transition"
                          >
                            {rejectBusy ? "…" : "Reject"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
