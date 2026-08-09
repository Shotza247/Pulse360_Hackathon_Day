import { prisma } from "@/lib/prisma";

const latestCycleOrder = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export async function findLatestActiveCycle() {
  return prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } },
    orderBy: latestCycleOrder,
  });
}

export async function findLatestCycleByPhase(phase: string) {
  return prisma.reviewCycle.findFirst({
    where: { phase: phase as any },
    orderBy: latestCycleOrder,
  });
}

export async function countPendingApprovalsForRole(cycleId: number, role: string, userId: number) {
  if (role === "HR_ADMIN") {
    return prisma.nomination.count({
      where: { cycleId, approvalStatus: "PENDING" },
    });
  }

  if (role === "LINE_MANAGER") {
    return prisma.nomination.count({
      where: {
        cycleId,
        approvalStatus: "PENDING",
        employee: { managerId: userId },
      },
    });
  }

  return 0;
}

export async function countPendingReviewsForReviewer(cycleId: number, reviewerId: number) {
  const [approvedNominations, submittedReviews] = await Promise.all([
    prisma.nomination.findMany({
      where: { cycleId, reviewerId, approvalStatus: "APPROVED" },
      select: { employeeId: true },
    }),
    prisma.review.findMany({
      where: { cycleId, reviewerId, status: "SUBMITTED" },
      select: { employeeId: true },
    }),
  ]);

  const submittedEmployeeIds = new Set(submittedReviews.map((review) => review.employeeId));
  return approvedNominations.filter((nomination) => !submittedEmployeeIds.has(nomination.employeeId)).length;
}

export async function countDraftNominationsForEmployee(cycleId: number, employeeId: number) {
  return prisma.nomination.count({
    where: { cycleId, employeeId, submissionStatus: "DRAFT" },
  });
}

export async function getSidebarBadgeCounts(userId: number, role: string) {
  const [approvalCycle, reviewCycle, nominateCycle] = await Promise.all([
    findLatestCycleByPhase("APPROVE"),
    findLatestCycleByPhase("REVIEW"),
    findLatestCycleByPhase("NOMINATE"),
  ]);

  const [approvals, reviews, nominations] = await Promise.all([
    approvalCycle ? countPendingApprovalsForRole(approvalCycle.id, role, userId) : Promise.resolve(0),
    reviewCycle && ["EMPLOYEE", "LINE_MANAGER"].includes(role)
      ? countPendingReviewsForReviewer(reviewCycle.id, userId)
      : Promise.resolve(0),
    nominateCycle && ["EMPLOYEE", "LINE_MANAGER"].includes(role)
      ? countDraftNominationsForEmployee(nominateCycle.id, userId)
      : Promise.resolve(0),
  ]);

  return { approvals, reviews, nominations };
}
