import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;

  if (role === "HR_ADMIN")     return <AdminDashboard userId={Number(session.user.id)} />;
  if (role === "LINE_MANAGER") return <ManagerDashboard userId={Number(session.user.id)} />;
  return <EmployeeDashboard userId={Number(session.user.id)} />;
}

// ─── HR Admin Dashboard ───────────────────────────────────────────────────────
async function AdminDashboard({ userId }: { userId: number }) {
  const [activeCycle, totalEmployees, totalCriteria] = await Promise.all([
    prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.pulseCriterion.count({ where: { isActive: true } }),
  ]);

  let nominationStats = { submitted: 0, total: 0 };
  let reviewStats     = { submitted: 0, total: 0 };

  if (activeCycle) {
    const [nomSubmitted, nomTotal, revSubmitted, revTotal] = await Promise.all([
      prisma.nomination.count({ where: { cycleId: activeCycle.id, submissionStatus: "SUBMITTED" }, }),
      prisma.nomination.count({ where: { cycleId: activeCycle.id } }),
      prisma.review.count({ where: { cycleId: activeCycle.id, status: "SUBMITTED" } }),
      prisma.review.count({ where: { cycleId: activeCycle.id } }),
    ]);
    nominationStats = { submitted: nomSubmitted, total: nomTotal };
    reviewStats     = { submitted: revSubmitted, total: revTotal };
  }

  const PHASE_COLORS: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700", NOMINATE: "bg-blue-100 text-blue-800",
    APPROVE: "bg-amber-100 text-amber-800", REVIEW: "bg-purple-100 text-purple-800",
    CALCULATION: "bg-indigo-100 text-indigo-800", CONSULTATION: "bg-teal-100 text-teal-800",
    ACCEPT: "bg-green-100 text-green-800", CLOSED: "bg-gray-200 text-gray-600",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of the current review cycle and organisation health</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Active Employees" value={totalEmployees} icon="👥" color="blue" />
        <StatCard label="Active Criteria"  value={totalCriteria}  icon="📋" color="purple" />
        <StatCard label="Nominations In"   value={`${nominationStats.submitted}/${nominationStats.total}`} icon="🎯" color="amber" />
        <StatCard label="Reviews Complete" value={`${reviewStats.submitted}/${reviewStats.total}`}         icon="✅" color="green" />
      </div>

      {/* Active cycle card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Active Review Cycle</h2>
          <Link href="/cycles" className="text-sm text-[#0f1f3d] font-medium hover:underline">Manage cycles →</Link>
        </div>
        {activeCycle ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg font-bold text-gray-900">{activeCycle.name}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PHASE_COLORS[activeCycle.phase] ?? ""}`}>
                {activeCycle.phase}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Start:</span> <span className="font-medium ml-1">{activeCycle.startDate.toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">End:</span>   <span className="font-medium ml-1">{activeCycle.endDate.toLocaleDateString()}</span></div>
            </div>
            {/* Progress bars */}
            <div className="mt-5 space-y-3">
              <ProgressBar label="Nominations submitted" current={nominationStats.submitted} total={nominationStats.total} color="bg-blue-500" />
              <ProgressBar label="Reviews completed"     current={reviewStats.submitted}     total={reviewStats.total}     color="bg-green-500" />
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-3">No active review cycle</p>
            <Link href="/cycles/new" className="inline-block rounded-lg bg-[#0f1f3d] text-white text-sm font-medium px-4 py-2 hover:bg-[#1a3160] transition">
              Create cycle
            </Link>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink href="/employees"    label="Manage Employees"  desc="Add, edit or deactivate employees" icon="👥" />
        <QuickLink href="/cycles"       label="Review Cycles"     desc="Create and advance cycle phases"   icon="🔄" />
        <QuickLink href="/results"      label="View All Results"  desc="Filter and export performance data" icon="📊" />
      </div>
    </div>
  );
}

// ─── Line Manager Dashboard ───────────────────────────────────────────────────
async function ManagerDashboard({ userId }: { userId: number }) {
  const [directReports, activeCycle, pendingApprovals] = await Promise.all([
    prisma.employee.findMany({ where: { managerId: userId, isActive: true }, select: { id: true, firstName: true, lastName: true, jobTitle: true } }),
    prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } }),
    prisma.nomination.count({ where: { employee: { managerId: userId }, approvalStatus: "PENDING", ...(await prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } } })) ? { cycleId: (await prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } } }))!.id } : {} } }),
  ]);

  const teamReviewStats = activeCycle
    ? await prisma.review.groupBy({
        by: ["status"],
        where: { cycleId: activeCycle.id, employee: { managerId: userId } },
        _count: true,
      })
    : [];

  const submitted = teamReviewStats.find((s) => s.status === "SUBMITTED")?._count ?? 0;
  const total     = teamReviewStats.reduce((a, b) => a + b._count, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Your team's review progress and pending approvals</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard label="Direct Reports"     value={directReports.length} icon="👥" color="blue" />
        <StatCard label="Pending Approvals"  value={pendingApprovals}     icon="⏳" color="amber" />
        <StatCard label="Team Reviews Done"  value={`${submitted}/${total}`} icon="✅" color="green" />
      </div>

      {/* Team review progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
          <Link href="/approvals" className="text-sm text-[#0f1f3d] font-medium hover:underline">
            Review approvals ({pendingApprovals}) →
          </Link>
        </div>
        {directReports.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No direct reports assigned yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {directReports.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-xs font-bold">
                    {emp.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-500">{emp.jobTitle ?? "—"}</p>
                  </div>
                </div>
                <Link href={`/manager/results?employee=${emp.id}`} className="text-xs text-[#0f1f3d] hover:underline font-medium">View →</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink href="/approvals"       label="Approve Nominations" desc="Review and approve team nominations" icon="✅" />
        <QuickLink href="/manager/results" label="Team Results"        desc="View aggregated results for your team" icon="📊" />
      </div>
    </div>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────
async function EmployeeDashboard({ userId }: { userId: number }) {
  const [activeCycle, myNominations, myPendingReviews, manager] = await Promise.all([
    prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } }),
    prisma.nomination.count({ where: { employeeId: userId, submissionStatus: "DRAFT" } }),
    prisma.review.count({ where: { reviewerId: userId, status: "DRAFT" } }),
    prisma.employee.findFirst({ where: { directReports: { some: { id: userId } } }, select: { firstName: true, lastName: true, jobTitle: true } }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Your pending actions and review status</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard label="Nominations Pending" value={myNominations}    icon="🎯" color="amber" />
        <StatCard label="Reviews to Complete" value={myPendingReviews} icon="✍️" color="blue" />
        <StatCard label="Active Cycle"        value={activeCycle ? activeCycle.name : "None"} icon="🔄" color="purple" />
      </div>

      {/* Action items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Pending Actions</h2>
        <div className="space-y-3">
          {myNominations > 0 && (
            <ActionItem
              href="/nominations"
              icon="🎯"
              label="Submit your nominations"
              desc={`You have ${myNominations} draft nomination(s) to submit`}
              cta="Go to Nominations"
              urgent
            />
          )}
          {myPendingReviews > 0 && (
            <ActionItem
              href="/reviews"
              icon="✍️"
              label="Complete your reviews"
              desc={`You have ${myPendingReviews} review(s) in draft`}
              cta="Go to Reviews"
              urgent
            />
          )}
          {myNominations === 0 && myPendingReviews === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">🎉 You're all caught up! No pending actions.</p>
          )}
        </div>
      </div>

      {manager && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Your Line Manager</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold">
              {manager.firstName.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-gray-900">{manager.firstName} {manager.lastName}</p>
              <p className="text-sm text-gray-500">{manager.jobTitle}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink href="/nominations" label="Nominations"  desc="Nominate peers to review you" icon="🎯" />
        <QuickLink href="/my-results"  label="My Results"   desc="View your aggregated scores"  icon="📊" />
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const bg: Record<string, string> = { blue: "bg-blue-50 border-blue-100", purple: "bg-purple-50 border-purple-100", amber: "bg-amber-50 border-amber-100", green: "bg-green-50 border-green-100" };
  return (
    <div className={`rounded-xl border p-5 ${bg[color] ?? "bg-gray-50 border-gray-100"}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function ProgressBar({ label, current, total, color }: { label: string; current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span><span>{current}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickLink({ href, label, desc, icon }: { href: string; label: string; desc: string; icon: string }) {
  return (
    <Link href={href} className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-[#0f1f3d] hover:shadow-sm transition group">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0f1f3d]">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

function ActionItem({ href, icon, label, desc, cta, urgent }: { href: string; icon: string; label: string; desc: string; cta: string; urgent?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-4 rounded-lg ${urgent ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      <Link href={href} className="flex-shrink-0 text-xs font-semibold text-[#0f1f3d] border border-[#0f1f3d] rounded-lg px-3 py-1.5 hover:bg-[#0f1f3d] hover:text-white transition">
        {cta}
      </Link>
    </div>
  );
}
