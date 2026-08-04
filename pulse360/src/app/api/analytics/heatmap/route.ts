import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/analytics/heatmap
// Returns avg score per department × criterion for the latest closed/consultation/accept cycle
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { in: ["CONSULTATION", "ACCEPT", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!cycle) return NextResponse.json({ cycle: null, departments: [], criteria: [], data: {} });

  const criteria = await prisma.pulseCriterion.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Fetch all per-criterion results for this cycle (with employee department)
  const results = await prisma.reviewResult.findMany({
    where: { cycleId: cycle.id, criterionId: { not: null } },
    include: { employee: { select: { departmentId: true } } },
  });

  // Build map: deptId → criterionId → [scores]
  const scoreMap: Record<number, Record<number, number[]>> = {};
  for (const r of results) {
    const deptId = r.employee.departmentId;
    const critId = r.criterionId!;
    if (!scoreMap[deptId]) scoreMap[deptId] = {};
    if (!scoreMap[deptId][critId]) scoreMap[deptId][critId] = [];
    scoreMap[deptId][critId].push(Number(r.avgScore));
  }

  // Compute averages
  const data: Record<number, Record<number, number | null>> = {};
  for (const dept of departments) {
    data[dept.id] = {};
    for (const crit of criteria) {
      const scores = scoreMap[dept.id]?.[crit.id];
      data[dept.id][crit.id] = scores?.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;
    }
  }

  return NextResponse.json({ cycle: { id: cycle.id, name: cycle.name }, departments, criteria, data });
}
