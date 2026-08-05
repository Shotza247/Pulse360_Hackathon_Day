import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CyclePhase } from "@prisma/client";
import { notifyPhaseTransition } from "@/lib/notifications";

// CALCULATION is not a user-visible phase — scores are computed automatically
// when HR advances REVIEW → CONSULTATION. The CALCULATION phase in the DB enum
// is kept for audit but skipped in the UI advance flow.
const PHASE_NEXT: Record<string, CyclePhase> = {
  DRAFT: "NOMINATE", NOMINATE: "APPROVE", APPROVE: "REVIEW",
  REVIEW: "CONSULTATION", CONSULTATION: "ACCEPT", ACCEPT: "CLOSED",
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const cycleId = Number(id);

  const cycle = await prisma.reviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const next = PHASE_NEXT[cycle.phase];
  if (!next) return NextResponse.json({ error: "Cycle is already closed" }, { status: 400 });

  // ── When advancing REVIEW → CONSULTATION: silently calculate then skip to CONSULTATION ──
  if (next === "CONSULTATION") {
    await calculateResults(cycleId);
  }

  const updated = await prisma.reviewCycle.update({
    where: { id: cycleId },
    data: { phase: next },
  });

  // Fire notifications for the new phase (non-blocking)
  notifyPhaseTransition(cycleId, cycle.name, next).catch(console.error);

  return NextResponse.json(updated);
}

// ── Score calculation ────────────────────────────────────────────────────────
async function calculateResults(cycleId: number) {
  // Wipe any previous results for this cycle
  await prisma.reviewResult.deleteMany({ where: { cycleId } });

  // Get all submitted reviews for this cycle
  const reviews = await prisma.review.findMany({
    where: { cycleId, status: "SUBMITTED" },
    include: {
      ratings: {
        where: { score: { not: null } },
        include: { criterion: true },
      },
    },
  });

  if (reviews.length === 0) return;

  // Group ratings: employeeId → criterionId → scores[]
  const byEmployeeCriterion: Record<number, Record<number, number[]>> = {};
  const byEmployee: Record<number, number[]> = {};

  for (const review of reviews) {
    const empId = review.employeeId;
    if (!byEmployeeCriterion[empId]) byEmployeeCriterion[empId] = {};
    if (!byEmployee[empId]) byEmployee[empId] = [];

    for (const rating of review.ratings) {
      if (rating.score === null) continue;
      const critId = rating.criterionId;
      if (!byEmployeeCriterion[empId][critId]) byEmployeeCriterion[empId][critId] = [];
      byEmployeeCriterion[empId][critId].push(rating.score);
      byEmployee[empId].push(rating.score);
    }
  }

  // How many reviewers per employee
  const reviewerCounts: Record<number, number> = {};
  for (const review of reviews) {
    reviewerCounts[review.employeeId] = (reviewerCounts[review.employeeId] ?? 0) + 1;
  }

  // Build result rows
  const resultRows: {
    cycleId: number; employeeId: number; criterionId: number | null;
    avgScore: number; overallAvg: number; reviewCount: number;
  }[] = [];

  for (const [empIdStr, criteriaMap] of Object.entries(byEmployeeCriterion)) {
    const empId = Number(empIdStr);
    const count = reviewerCounts[empId] ?? 0;
    const allScores = byEmployee[empId] ?? [];
    const overallAvg = allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100
      : 0;

    // Per-criterion rows
    for (const [critIdStr, scores] of Object.entries(criteriaMap)) {
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
      resultRows.push({
        cycleId, employeeId: empId, criterionId: Number(critIdStr),
        avgScore: avg, overallAvg, reviewCount: count,
      });
    }

    // Overall row (criterionId = null)
    resultRows.push({
      cycleId, employeeId: empId, criterionId: null,
      avgScore: overallAvg, overallAvg, reviewCount: count,
    });
  }

  // Write all result rows using createMany (simpler, avoids null unique key issues)
  await prisma.reviewResult.createMany({
    data: resultRows.map(row => ({
      cycleId: row.cycleId,
      employeeId: row.employeeId,
      criterionId: row.criterionId,
      avgScore: row.avgScore,
      overallAvg: row.overallAvg,
      reviewCount: row.reviewCount,
    })),
    skipDuplicates: true,
  });
}
