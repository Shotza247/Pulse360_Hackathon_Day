import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/analytics/heatmap?cycleId=4
// Returns avg score per department × criterion for a specific cycle (or latest if omitted).
// Also returns all closed/consultation/accept cycles for the selector.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // All historical cycles (for selector + trend chart)
  const allCycles = await prisma.reviewCycle.findMany({
    where: { phase: { in: ["CONSULTATION", "ACCEPT", "CLOSED"] } },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, phase: true, startDate: true, endDate: true },
  });

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("cycleId");

  const cycle = requestedId
    ? await prisma.reviewCycle.findUnique({ where: { id: Number(requestedId) } })
    : await prisma.reviewCycle.findFirst({
        where: { phase: { in: ["CONSULTATION", "ACCEPT", "CLOSED"] } },
        orderBy: { startDate: "desc" },
      });

  if (!cycle) {
    return NextResponse.json({ cycle: null, allCycles, departments: [], criteria: [], data: {}, trends: {} });
  }

  const [criteria, departments] = await Promise.all([
    prisma.pulseCriterion.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Helper: build deptId → critId → avg map for a single cycleId
  async function buildScoreMap(cycId: number) {
    const results = await prisma.reviewResult.findMany({
      where: { cycleId: cycId, criterionId: { not: null } },
      include: { employee: { select: { departmentId: true } } },
    });
    const raw: Record<number, Record<number, number[]>> = {};
    for (const r of results) {
      const dId = r.employee.departmentId;
      const cId = r.criterionId!;
      if (!raw[dId]) raw[dId] = {};
      if (!raw[dId][cId]) raw[dId][cId] = [];
      raw[dId][cId].push(Number(r.avgScore));
    }
    const out: Record<number, Record<number, number | null>> = {};
    for (const dept of departments) {
      out[dept.id] = {};
      for (const crit of criteria) {
        const scores = raw[dept.id]?.[crit.id];
        out[dept.id][crit.id] = scores?.length
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : null;
      }
    }
    return out;
  }

  const data = await buildScoreMap(cycle.id);

  // Trend data: for each prior cycle, compute org-level avg per criterion
  // Shape: { criterionId: [{ cycleId, cycleName, avg }] }
  const trends: Record<number, { cycleId: number; cycleName: string; avg: number | null }[]> = {};
  for (const crit of criteria) {
    trends[crit.id] = [];
    for (const c of allCycles) {
      const allResults = await prisma.reviewResult.findMany({
        where: { cycleId: c.id, criterionId: crit.id },
      });
      const scores = allResults.map((r) => Number(r.avgScore));
      const avg = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;
      trends[crit.id].push({ cycleId: c.id, cycleName: c.name, avg });
    }
  }

  // Department overall averages across all criteria (for pie chart)
  const deptOveralls: Record<number, number | null> = {};
  for (const dept of departments) {
    const scores = criteria.map((c) => data[dept.id]?.[c.id]).filter((v): v is number => v !== null);
    deptOveralls[dept.id] = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
  }

  return NextResponse.json({
    cycle: { id: cycle.id, name: cycle.name, phase: cycle.phase, startDate: cycle.startDate, endDate: cycle.endDate },
    allCycles,
    departments,
    criteria,
    data,
    deptOveralls,
    trends,
  });
}
