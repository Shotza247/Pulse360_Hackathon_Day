import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const employeeId = Number((session.user as any).id);
  if (!employeeId) return NextResponse.json({ error: "Employee identity unavailable" }, { status: 400 });

  const cycles = await prisma.reviewCycle.findMany({
    where: { phase: { in: ["ACCEPT", "CLOSED"] }, results: { some: { employeeId } } },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, startDate: true, endDate: true, phase: true },
  });

  const results = await Promise.all(cycles.map(async (cycle) => {
    const [rows, reviews] = await Promise.all([
      prisma.reviewResult.findMany({
        where: { cycleId: cycle.id, employeeId },
        include: { criterion: { select: { id: true, name: true, sortOrder: true } } },
        orderBy: { criterion: { sortOrder: "asc" } },
      }),
      prisma.review.findMany({
        where: { cycleId: cycle.id, employeeId, status: "SUBMITTED" },
        select: { doWellComment: true, improveComment: true, attentionComment: true },
      }),
    ]);
    const overall = rows.find((row) => row.criterionId === null);
    return {
      cycle,
      overall: overall ? Number(overall.avgScore) : null,
      reviewCount: overall?.reviewCount ?? reviews.length,
      criteria: rows.filter((row) => row.criterionId !== null).map((row) => ({ id: row.criterionId!, name: row.criterion?.name ?? "Criterion", score: Number(row.avgScore) })),
      comments: reviews,
    };
  }));

  return NextResponse.json({ results, refreshedAt: new Date().toISOString() });
}
