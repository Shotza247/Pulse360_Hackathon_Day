import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;
  const role = user.role as string;
  if (role === "HR_ADMIN")     return <AdminDashboard userId={Number(user.id)} name={user.name} />;
  if (role === "LINE_MANAGER") return <ManagerDashboard userId={Number(user.id)} name={user.name} />;
  return <EmployeeDashboard userId={Number(user.id)} name={user.name} />;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const PHASE_ORDER = ["DRAFT","NOMINATE","APPROVE","REVIEW","CALCULATION","CONSULTATION","ACCEPT","CLOSED"] as const;
type Phase = typeof PHASE_ORDER[number];

const PHASE_META: Record<Phase, { color: string; bg: string; dot: string; label: string }> = {
  DRAFT:        { color: "text-gray-600",   bg: "bg-gray-100",   dot: "bg-gray-400",   label: "Draft" },
  NOMINATE:     { color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500",   label: "Nominating" },
  APPROVE:      { color: "text-amber-700",  bg: "bg-amber-100",  dot: "bg-amber-500",  label: "Approving" },
  REVIEW:       { color: "text-purple-700", bg: "bg-purple-100", dot: "bg-purple-500", label: "Reviewing" },
  CALCULATION:  { color: "text-indigo-700", bg: "bg-indigo-100", dot: "bg-indigo-500", label: "Calculating" },
  CONSULTATION: { color: "text-teal-700",   bg: "bg-teal-100",   dot: "bg-teal-500",   label: "Consulting" },
  ACCEPT:       { color: "text-green-700",  bg: "bg-green-100",  dot: "bg-green-500",  label: "Results Out" },
  CLOSED:       { color: "text-gray-500",   bg: "bg-gray-200",   dot: "bg-gray-400",   label: "Closed" },
};

function PhasePill({ phase }: { phase: string }) {
  const meta = PHASE_META[phase as Phase] ?? PHASE_META.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function PhaseTimeline({ phase }: { phase: string }) {
  const currentIdx = PHASE_ORDER.indexOf(phase as Phase);
  return (
    <div className="flex items-center gap-1 mt-4">
      {PHASE_ORDER.map((p, i) => (
        <div key={p} className={`flex-1 h-1.5 rounded-full transition-all ${
          i < currentIdx ? "bg-green-400" : i === currentIdx ? "bg-white" : "bg-white/20"
        }`} />
      ))}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold flex-shrink-0`}>
      {name?.charAt(0)?.toUpperCase() ?? "?"}
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  const bars: Record<string, string> = {
    blue:   "bg-blue-500", purple: "bg-purple-500", amber: "bg-amber-500",
    green:  "bg-emerald-500", navy: "bg-[#0f1f3d]", teal: "bg-teal-500",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className={`h-1 ${bars[accent] ?? bars.navy}`} />
      <div className="p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
        <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function RingProgress({ pct, color }: { pct: number; color: string }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const colors: Record<string, string> = { blue: "#3b82f6", green: "#10b981", amber: "#f59e0b", purple: "#8b5cf6" };
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={colors[color] ?? "#0f1f3d"}
        strokeWidth="6" strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f2328">{pct}%</text>
    </svg>
  );
}

// ─── HR Admin Dashboard ────────────────────────────────────────────────────────
async function AdminDashboard({ userId, name }: { userId: number; name: string }) {
  const [activeCycle, totalEmployees, totalCriteria, totalManagers, recentEmployees] = await Promise.all([
    prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.pulseCriterion.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { role: "LINE_MANAGER", isActive: true } }),
    prisma.employee.findMany({
      where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 4,
      select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
    }),
  ]);

  let nomSubmitted = 0, nomTotal = 0, revSubmitted = 0, revTotal = 0;
  if (activeCycle) {
    [nomSubmitted, nomTotal, revSubmitted, revTotal] = await Promise.all([
      prisma.nomination.count({ where: { cycleId: activeCycle.id, submissionStatus: "SUBMITTED" } }),
      prisma.nomination.count({ where: { cycleId: activeCycle.id } }),
      prisma.review.count({ where: { cycleId: activeCycle.id, status: "SUBMITTED" } }),
      prisma.review.count({ where: { cycleId: activeCycle.id } }),
    ]);
  }

  const nomPct = nomTotal > 0 ? Math.round((nomSubmitted / nomTotal) * 100) : 0;
  const revPct = revTotal > 0 ? Math.round((revSubmitted / revTotal) * 100) : 0;
  const firstName = name?.split(" ")[0] ?? "Admin";

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-2xl bg-[#0f1f3d] p-7 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white opacity-5 -mr-16 -mt-16" />
        <div className="absolute bottom-0 right-24 w-32 h-32 rounded-full bg-white opacity-5 -mb-10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-blue-300 text-sm font-medium mb-1">Welcome back</p>
            <h1 className="text-2xl font-black tracking-tight">{firstName}</h1>
            <p className="text-blue-200 text-sm mt-1.5">
              {activeCycle ? `Active cycle: ${activeCycle.name}` : "No active review cycle"}
            </p>
            {activeCycle && <div className="mt-3"><PhasePill phase={activeCycle.phase} /></div>}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-blue-300 text-xs font-medium uppercase tracking-wider">Organisation</p>
            <p className="text-4xl font-black mt-1">{totalEmployees}</p>
            <p className="text-blue-200 text-xs mt-0.5">active employees</p>
          </div>
        </div>
        {activeCycle && <PhaseTimeline phase={activeCycle.phase} />}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Employees"     value={totalEmployees} sub="currently active"      accent="navy"   />
        <MetricCard label="Line Managers" value={totalManagers}  sub="managing teams"        accent="blue"   />
        <MetricCard label="eWay Criteria" value={totalCriteria}  sub="active competencies"   accent="purple" />
        <MetricCard label="Cycle Phase"   value={activeCycle?.phase ?? "—"} sub={activeCycle?.name ?? "no active cycle"} accent="teal" />
      </div>

      {/* Cycle progress */}
      {activeCycle ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">{activeCycle.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(activeCycle.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                {" → "}
                {new Date(activeCycle.endDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <Link href="/cycles"
              className="text-xs font-semibold text-[#0f1f3d] border border-[#0f1f3d]/30 rounded-lg px-3 py-1.5 hover:bg-[#0f1f3d] hover:text-white transition">
              Manage →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <RingProgress pct={nomPct} color="blue" />
              <div>
                <p className="text-lg font-black text-gray-900">{nomSubmitted}<span className="text-gray-400 font-normal text-sm"> / {nomTotal}</span></p>
                <p className="text-xs text-gray-500">Nominations submitted</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <RingProgress pct={revPct} color="green" />
              <div>
                <p className="text-lg font-black text-gray-900">{revSubmitted}<span className="text-gray-400 font-normal text-sm"> / {revTotal}</span></p>
                <p className="text-xs text-gray-500">Reviews completed</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-gray-700 font-semibold mb-1">Ready to start a new review cycle?</p>
          <p className="text-gray-400 text-sm mb-4">Create a cycle to kick off nominations and reviews across the organisation.</p>
          <Link href="/cycles/new"
            className="inline-block rounded-xl bg-[#0f1f3d] text-white text-sm font-bold px-6 py-2.5 hover:bg-[#1a3160] transition">
            + Create Cycle
          </Link>
        </div>
      )}

      {/* Recent employees + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Recent Employees</h2>
            <Link href="/employees" className="text-xs font-semibold text-[#0f1f3d] hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {recentEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-3">
                <Avatar name={emp.firstName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.department.name}</p>
                </div>
                <Link href={`/employees/${emp.id}`} className="text-xs text-[#0f1f3d] hover:underline font-semibold flex-shrink-0">Edit</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-1">
            {[
              { href: "/employees/new", icon: "➕", label: "Add new employee",   sub: "Create an employee account" },
              { href: "/cycles",        icon: "🔄", label: "Manage cycles",      sub: "Advance or create review cycles" },
              { href: "/approvals",     icon: "✅", label: "Review approvals",   sub: "Override nomination decisions" },
              { href: "/results",       icon: "📊", label: "View all results",   sub: "Organisation-wide score table" },
              { href: "/criteria",      icon: "📋", label: "eWay Criteria",      sub: "Edit competency pillars" },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                <span className="text-xl w-8 text-center">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0f1f3d]">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <span className="text-gray-300 group-hover:text-[#0f1f3d] transition text-lg">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Line Manager Dashboard ────────────────────────────────────────────────────
async function ManagerDashboard({ userId, name }: { userId: number; name: string }) {
  const activeCycle = await prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" },
  });

  const [directReports, pendingApprovals, myPendingReviews] = await Promise.all([
    prisma.employee.findMany({
      where: { managerId: userId, isActive: true },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
    }),
    activeCycle
      ? prisma.nomination.count({ where: { cycleId: activeCycle.id, employee: { managerId: userId }, approvalStatus: "PENDING" } })
      : Promise.resolve(0),
    activeCycle
      ? prisma.review.count({ where: { cycleId: activeCycle.id, reviewerId: userId, status: "DRAFT" } })
      : Promise.resolve(0),
  ]);

  const teamReviewStats = activeCycle
    ? await prisma.review.groupBy({
        by: ["status"],
        where: { cycleId: activeCycle.id, employee: { managerId: userId } },
        _count: true,
      })
    : [];

  const revSubmitted = teamReviewStats.find(s => s.status === "SUBMITTED")?._count ?? 0;
  const revTotal     = teamReviewStats.reduce((a, b) => a + b._count, 0);
  const revPct       = revTotal > 0 ? Math.round((revSubmitted / revTotal) * 100) : 0;
  const firstName    = name?.split(" ")[0] ?? "Manager";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-[#0f1f3d] p-7 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white opacity-5 -mr-16 -mt-16" />
        <div className="absolute bottom-0 right-24 w-32 h-32 rounded-full bg-white opacity-5 -mb-10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-blue-300 text-sm font-medium mb-1">Manager Dashboard</p>
            <h1 className="text-2xl font-black tracking-tight">{firstName}</h1>
            <p className="text-blue-200 text-sm mt-1.5">
              {activeCycle ? `Cycle: ${activeCycle.name}` : "No active cycle"}
            </p>
            {activeCycle && <div className="mt-3"><PhasePill phase={activeCycle.phase} /></div>}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-blue-300 text-xs font-medium uppercase tracking-wider">Team size</p>
            <p className="text-4xl font-black mt-1">{directReports.length}</p>
            <p className="text-blue-200 text-xs mt-0.5">direct reports</p>
          </div>
        </div>
        {activeCycle && <PhaseTimeline phase={activeCycle.phase} />}
      </div>

      {/* Alert banners */}
      {pendingApprovals > 0 && (
        <Link href="/approvals"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition group">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg flex-shrink-0">⏳</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">{pendingApprovals} nomination{pendingApprovals > 1 ? "s" : ""} awaiting your approval</p>
            <p className="text-xs text-amber-700 mt-0.5">Review and approve your team&apos;s peer nominations</p>
          </div>
          <span className="text-amber-400 group-hover:text-amber-600 text-xl">›</span>
        </Link>
      )}
      {myPendingReviews > 0 && (
        <Link href="/reviews"
          className="flex items-center gap-4 bg-purple-50 border border-purple-200 rounded-2xl p-4 hover:bg-purple-100 transition group">
          <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center text-lg flex-shrink-0">✍️</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-purple-900">{myPendingReviews} review{myPendingReviews > 1 ? "s" : ""} to complete</p>
            <p className="text-xs text-purple-700 mt-0.5">You have draft reviews waiting to be submitted</p>
          </div>
          <span className="text-purple-400 group-hover:text-purple-600 text-xl">›</span>
        </Link>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Direct Reports"    value={directReports.length}          sub="in your team"            accent="navy"   />
        <MetricCard label="Pending Approvals" value={pendingApprovals}              sub="nominations to action"   accent="amber"  />
        <MetricCard label="Team Reviews Done" value={`${revSubmitted}/${revTotal}`} sub={`${revPct}% complete`}   accent="green"  />
        <MetricCard label="My Pending Reviews" value={myPendingReviews}             sub="draft reviews to submit" accent="purple" />
      </div>

      {/* Team + Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Your Team</h2>
            <Link href="/manager/results" className="text-xs font-semibold text-[#0f1f3d] hover:underline">View results →</Link>
          </div>
          {directReports.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No direct reports assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {directReports.map(emp => (
                <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                  <Avatar name={emp.firstName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{emp.jobTitle ?? emp.department.name}</p>
                  </div>
                  <Link href={`/manager/results?employee=${emp.id}`}
                    className="text-xs font-semibold text-[#0f1f3d] border border-[#0f1f3d]/30 rounded-lg px-2.5 py-1 hover:bg-[#0f1f3d] hover:text-white transition flex-shrink-0">
                    Results
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Team Review Progress</h2>
          <div className="flex items-center gap-5 mb-5">
            <RingProgress pct={revPct} color="green" />
            <div>
              <p className="text-2xl font-black text-gray-900">
                {revSubmitted}<span className="text-gray-400 font-normal text-base"> / {revTotal}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">team reviews submitted</p>
              {revPct === 100 && revTotal > 0 && (
                <p className="text-xs text-emerald-600 font-semibold mt-1">All reviews complete!</p>
              )}
            </div>
          </div>
          <div className="space-y-1 mt-4 border-t border-gray-100 pt-4">
            {[
              { href: "/approvals",       icon: "✅", label: "Approve nominations", sub: `${pendingApprovals} pending` },
              { href: "/manager/results", icon: "📊", label: "Team results",         sub: "View scores and feedback" },
              { href: "/my-results",      icon: "🎯", label: "My own results",       sub: "See how you scored" },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                <span className="text-lg w-7 text-center">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0f1f3d]">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <span className="text-gray-300 group-hover:text-[#0f1f3d] transition text-lg">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Dashboard ────────────────────────────────────────────────────────
async function EmployeeDashboard({ userId, name }: { userId: number; name: string }) {
  const [activeCycle, myNominations, myPendingReviews, manager, mySubmittedReviews] = await Promise.all([
    prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } }),
    prisma.nomination.count({ where: { employeeId: userId, submissionStatus: "DRAFT" } }),
    prisma.review.count({ where: { reviewerId: userId, status: "DRAFT" } }),
    prisma.employee.findFirst({
      where: { directReports: { some: { id: userId } } },
      select: { firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
    }),
    prisma.review.count({ where: { reviewerId: userId, status: "SUBMITTED" } }),
  ]);

  const resultsAvailable = await prisma.reviewCycle.findFirst({
    where: { phase: { in: ["ACCEPT", "CLOSED"] } },
  });

  const totalActions = myNominations + myPendingReviews;
  const firstName = name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className={`rounded-2xl p-7 text-white relative overflow-hidden ${
        totalActions > 0 ? "bg-[#0f1f3d]" : "bg-gradient-to-r from-emerald-600 to-teal-600"
      }`}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white opacity-5 -mr-16 -mt-16" />
        <div className="relative">
          <p className={`text-sm font-medium mb-1 ${totalActions > 0 ? "text-blue-300" : "text-emerald-100"}`}>
            {totalActions > 0 ? "Action required" : "You're all caught up!"}
          </p>
          <h1 className="text-2xl font-black tracking-tight">Hi, {firstName}</h1>
          <p className={`text-sm mt-1.5 ${totalActions > 0 ? "text-blue-200" : "text-emerald-100"}`}>
            {activeCycle
              ? `${activeCycle.name} · ${activeCycle.phase} phase`
              : "No active review cycle at the moment"}
          </p>
          {activeCycle && <div className="mt-3"><PhasePill phase={activeCycle.phase} /></div>}
        </div>
        {activeCycle && <PhaseTimeline phase={activeCycle.phase} />}
      </div>

      {/* Action banners */}
      {myNominations > 0 && (
        <Link href="/nominations"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition group">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg flex-shrink-0">🎯</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Submit your nominations</p>
            <p className="text-xs text-amber-700 mt-0.5">You have {myNominations} draft nomination(s) — minimum 3 reviewers required</p>
          </div>
          <span className="text-amber-400 group-hover:text-amber-600 text-xl">›</span>
        </Link>
      )}
      {myPendingReviews > 0 && (
        <Link href="/reviews"
          className="flex items-center gap-4 bg-purple-50 border border-purple-200 rounded-2xl p-4 hover:bg-purple-100 transition group">
          <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center text-lg flex-shrink-0">✍️</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-purple-900">Complete your reviews</p>
            <p className="text-xs text-purple-700 mt-0.5">{myPendingReviews} review form{myPendingReviews > 1 ? "s" : ""} in draft</p>
          </div>
          <span className="text-purple-400 group-hover:text-purple-600 text-xl">›</span>
        </Link>
      )}
      {resultsAvailable && (
        <Link href="/my-results"
          className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 hover:bg-emerald-100 transition group">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg flex-shrink-0">🏆</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">Your results are ready!</p>
            <p className="text-xs text-emerald-700 mt-0.5">View your anonymised scores and feedback from reviewers</p>
          </div>
          <span className="text-emerald-400 group-hover:text-emerald-600 text-xl">›</span>
        </Link>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Nominations"       value={myNominations > 0 ? myNominations : "✓"}      sub={myNominations > 0 ? "draft — needs submitting" : "all submitted"}   accent={myNominations > 0 ? "amber"  : "green"} />
        <MetricCard label="Reviews Pending"   value={myPendingReviews > 0 ? myPendingReviews : "✓"} sub={myPendingReviews > 0 ? "to complete"           : "all done"}        accent={myPendingReviews > 0 ? "purple" : "green"} />
        <MetricCard label="Reviews Submitted" value={mySubmittedReviews}                            sub="submitted this cycle"                                               accent="blue"  />
        <MetricCard label="Active Cycle"      value={activeCycle?.phase ?? "—"}                     sub={activeCycle?.name ?? "no active cycle"}                             accent="navy"  />
      </div>

      {/* Manager card + Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {manager ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Your Line Manager</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                {manager.firstName.charAt(0)}
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">{manager.firstName} {manager.lastName}</p>
                <p className="text-sm text-gray-500">{manager.jobTitle ?? manager.department.name}</p>
                <p className="text-xs text-gray-400 mt-1">Auto-included as your mandatory reviewer</p>
              </div>
            </div>
          </div>
        ) : <div />}

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">My Actions</h2>
          <div className="space-y-1">
            {[
              { href: "/nominations", icon: "🎯", label: "My nominations",  sub: "Choose who reviews you" },
              { href: "/reviews",     icon: "✍️", label: "My reviews",      sub: "Rate colleagues on eWay criteria" },
              { href: "/my-results",  icon: "📊", label: "My results",      sub: "View your anonymised scores" },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                <span className="text-xl w-8 text-center">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0f1f3d]">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <span className="text-gray-300 group-hover:text-[#0f1f3d] transition text-lg">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
