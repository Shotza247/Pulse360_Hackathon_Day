import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countDraftNominationsForEmployee, countPendingReviewsForReviewer, findLatestActiveCycle, findLatestCycleByPhase } from "@/lib/workflow-counts";

export const dynamic = "force-dynamic";

async function getDashboardData(userId: number) {
  const [activeCycle, nominateCycle, reviewCycle, manager, releasedResults] = await Promise.all([
    findLatestActiveCycle(),
    findLatestCycleByPhase("NOMINATE"),
    findLatestCycleByPhase("REVIEW"),
    prisma.employee.findFirst({ where: { directReports: { some: { id: userId } } }, select: { firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } }),
    prisma.reviewResult.findFirst({ where: { employeeId: userId, cycle: { phase: { in: ["ACCEPT", "CLOSED"] } } }, select: { cycleId: true } }),
  ]);

  const [myNominations, myPendingReviews, mySubmittedReviews] = await Promise.all([
    nominateCycle ? countDraftNominationsForEmployee(nominateCycle.id, userId) : Promise.resolve(0),
    reviewCycle ? countPendingReviewsForReviewer(reviewCycle.id, userId) : Promise.resolve(0),
    reviewCycle ? prisma.review.count({ where: { cycleId: reviewCycle.id, reviewerId: userId, status: "SUBMITTED" } }) : Promise.resolve(0),
  ]);

  return {
    activeCycle: activeCycle ? { id: activeCycle.id, name: activeCycle.name, phase: activeCycle.phase, startDate: activeCycle.startDate, endDate: activeCycle.endDate } : null,
    myNominations,
    myPendingReviews,
    mySubmittedReviews,
    resultsAvailable: Boolean(releasedResults),
    manager,
    refreshedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json(await getDashboardData(Number((session.user as any).id)));
}
