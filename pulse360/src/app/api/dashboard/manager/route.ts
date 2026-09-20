import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countPendingApprovalsForRole, countPendingReviewsForReviewer, findLatestActiveCycle, findLatestCycleByPhase } from "@/lib/workflow-counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const managerId = Number((session.user as any).id);
  const [activeCycle, approvalCycle, reviewCycle, directReports] = await Promise.all([
    findLatestActiveCycle(), findLatestCycleByPhase("APPROVE"), findLatestCycleByPhase("REVIEW"),
    prisma.employee.findMany({ where: { managerId, isActive: true }, select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } }),
  ]);
  const [pendingApprovals, myPendingReviews, teamReviews, teamScores] = await Promise.all([
    approvalCycle ? countPendingApprovalsForRole(approvalCycle.id, "LINE_MANAGER", managerId) : Promise.resolve(0),
    reviewCycle ? countPendingReviewsForReviewer(reviewCycle.id, managerId) : Promise.resolve(0),
    reviewCycle ? prisma.review.findMany({ where: { cycleId: reviewCycle.id, employee: { managerId } }, select: { employeeId: true, status: true } }) : Promise.resolve([]),
    prisma.reviewResult.findMany({ where: { employeeId: { in: directReports.map((employee) => employee.id) }, criterionId: null, cycle: { phase: { in: ["ACCEPT", "CLOSED"] } } }, orderBy: { calculatedAt: "desc" }, select: { employeeId: true, avgScore: true, cycle: { select: { name: true } } } }),
  ]);
  const progress = directReports.map((employee) => { const rows = teamReviews.filter((review) => review.employeeId === employee.id); const submitted = rows.filter((review) => review.status === "SUBMITTED").length; return { ...employee, submitted, total: rows.length, complete: rows.length > 0 && submitted === rows.length }; });
  const latestScoreByEmployee = new Map<number, { score: number; cycleName: string }>();
  for (const score of teamScores) if (!latestScoreByEmployee.has(score.employeeId)) latestScoreByEmployee.set(score.employeeId, { score: Number(score.avgScore), cycleName: score.cycle.name });
  return NextResponse.json({ activeCycle: activeCycle ? { id: activeCycle.id, name: activeCycle.name, phase: activeCycle.phase, startDate: activeCycle.startDate, endDate: activeCycle.endDate } : null, pendingApprovals, myPendingReviews, directReports: progress, teamReviewTotal: teamReviews.length, teamReviewSubmitted: teamReviews.filter((review) => review.status === "SUBMITTED").length, teamScores: progress.map((employee) => ({ employeeId: employee.id, name: `${employee.firstName} ${employee.lastName}`, score: latestScoreByEmployee.get(employee.id)?.score ?? null, cycleName: latestScoreByEmployee.get(employee.id)?.cycleName ?? null })), refreshedAt: new Date().toISOString() });
}
