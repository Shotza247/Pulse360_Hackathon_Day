import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: "NOMINATE" } });
  if (!cycle) return NextResponse.json({ error: "No cycle open for nominations" }, { status: 400 });

  const nominations = await prisma.nomination.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
  });

  // For non-HR users, cap the minimum at however many same-department peers exist
  // so small departments aren't blocked from submitting
  let effectiveMin = cycle.minNominees;
  if (role !== "HR_ADMIN") {
    const me = await prisma.employee.findUnique({ where: { id: userId }, select: { departmentId: true } });
    if (me) {
      const poolSize = await prisma.employee.count({
        where: { isActive: true, id: { not: userId }, departmentId: me.departmentId },
      });
      effectiveMin = Math.min(cycle.minNominees, poolSize);
    }
  }

  if (nominations.length < effectiveMin) {
    return NextResponse.json({ error: `Minimum ${effectiveMin} reviewer${effectiveMin !== 1 ? "s" : ""} required` }, { status: 400 });
  }

  await prisma.nomination.updateMany({
    where: { cycleId: cycle.id, employeeId: userId },
    data: { submissionStatus: "SUBMITTED" },
  });

  return NextResponse.json({ ok: true });
}
