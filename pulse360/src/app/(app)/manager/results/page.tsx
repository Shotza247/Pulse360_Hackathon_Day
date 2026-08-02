import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagerResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;
  if (!["HR_ADMIN", "LINE_MANAGER"].includes(user.role)) redirect("/dashboard");

  const managerId = Number(user.id);
  const params = await searchParams;
  const focusEmployeeId = params.employee ? Number(params.employee) : null;

  // Get latest cycle with results
  const latestCycle = await prisma.reviewCycle.findFirst({
    where: { phase: { in: ["CONSULTATION", "ACCEPT", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
  });

  // Get direct reports
  const directReports = await prisma.employee.findMany({
    where: { managerId, isActive: true },
    select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
    orderBy: { lastName: "asc" },
  });

  // Results summary per direct report
  const teamResults = latestCycle
    ? await prisma.reviewResult.findMany({
        where: {
          cycleId: latestCycle.id,
          criterionId: null,
          employeeId: { in: directReports.map((e) => e.id) },
        },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      })
    : [];

  const resultsMap = new Map(teamResults.map((r) => [r.employeeId, r]));

  // Drill-down: criterion breakdown for a specific employee
  const focusEmployee = focusEmployeeId
    ? directReports.find((e) => e.id === focusEmployeeId) ?? null
    : null;

  const focusResults = focusEmployee && latestCycle
    ? await prisma.reviewResult.findMany({
        where: { cycleId: latestCycle.id, employeeId: focusEmployee.id },
        include: { criterion: true },
        orderBy: { criterion: { sortOrder: "asc" } },
      })
    : [];

  const focusReviews = focusEmployee && latestCycle
    ? await prisma.review.findMany({
        where: { cycleId: latestCycle.id, employeeId: focusEmployee.id, status: "SUBMITTED" },
        select: { doWellComment: true, improveComment: true },
      })
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Team Results</h1>
        <p className="text-sm text-gray-500 mt-1">
          {latestCycle ? `Cycle: ${latestCycle.name}` : "No results available yet"}
        </p>
      </div>

      {directReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No direct reports assigned to you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team summary table */}
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Your Team</h2>
            <div className="space-y-2">
              {directReports.map((emp) => {
                const result = resultsMap.get(emp.id);
                const score = result ? Number(result.avgScore) : null;
                const isFocus = focusEmployeeId === emp.id;
                return (
                  <Link
                    key={emp.id}
                    href={`/manager/results?employee=${emp.id}`}
                    className={`flex items-center justify-between p-4 rounded-xl border transition ${
                      isFocus
                        ? "border-[#0f1f3d] bg-[#0f1f3d]/5"
                        : "border-gray-200 bg-white hover:border-[#0f1f3d]/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold text-sm">
                        {emp.firstName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-gray-500">{emp.jobTitle ?? emp.department.name}</p>
                      </div>
                    </div>
                    {score !== null ? (
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                        score >= 4 ? "bg-green-100 text-green-700" :
                        score >= 3 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {score.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No results yet</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Drill-down panel */}
          <div>
            {focusEmployee ? (
              <div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  {focusEmployee.firstName} {focusEmployee.lastName} — Breakdown
                </h2>
                {focusResults.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm">No results calculated yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Overall */}
                    {focusResults.filter(r => r.criterionId === null).map(r => (
                      <div key={r.id} className="bg-[#0f1f3d] rounded-xl p-5 text-white">
                        <p className="text-xs text-blue-200 mb-1">Overall Score</p>
                        <p className="text-4xl font-black">{Number(r.avgScore).toFixed(2)}</p>
                        <p className="text-blue-200 text-xs mt-1">Based on {r.reviewCount} reviews</p>
                      </div>
                    ))}
                    {/* Per criterion */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Criterion</p>
                      <div className="space-y-3">
                        {focusResults.filter(r => r.criterionId !== null).map(r => {
                          const score = Number(r.avgScore);
                          return (
                            <div key={r.id}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-800">{r.criterion?.name}</span>
                                <span className="font-bold">{score.toFixed(2)}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#0f1f3d] rounded-full" style={{ width: `${(score / 5) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Anonymised comments */}
                    {focusReviews.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Feedback (anonymised)</p>
                        <div className="space-y-4">
                          {focusReviews.some(r => r.doWellComment) && (
                            <div>
                              <p className="text-xs font-semibold text-green-700 mb-2">What they do well</p>
                              {focusReviews.filter(r => r.doWellComment).map((r, i) => (
                                <p key={i} className="text-sm text-gray-700 bg-green-50 border-l-2 border-green-400 rounded px-3 py-2 mb-1">{r.doWellComment}</p>
                              ))}
                            </div>
                          )}
                          {focusReviews.some(r => r.improveComment) && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 mb-2">Areas to improve</p>
                              {focusReviews.filter(r => r.improveComment).map((r, i) => (
                                <p key={i} className="text-sm text-gray-700 bg-amber-50 border-l-2 border-amber-400 rounded px-3 py-2 mb-1">{r.improveComment}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-400 text-sm">← Click a team member to see their detailed results</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
