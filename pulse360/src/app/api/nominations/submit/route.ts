import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: "NOMINATE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!cycle) return NextResponse.json({ error: "No cycle open for nominations" }, { status: 400 });

  const nominations = await prisma.nomination.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
    include: {
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
    },
  });

  // For non-HR users, cap the minimum at however many active reviewers exist
  // so corrected department data or small departments do not block submission.
  let effectiveMin = cycle.minNominees;
  if (role !== "HR_ADMIN") {
    const poolSize = await prisma.employee.count({
      where: { isActive: true, id: { not: userId }, role: { not: "HR_ADMIN" } },
    });
    effectiveMin = Math.min(cycle.minNominees, poolSize);
  }

  if (nominations.length < effectiveMin) {
    return NextResponse.json({ error: `Minimum ${effectiveMin} reviewer${effectiveMin !== 1 ? "s" : ""} required` }, { status: 400 });
  }

  await prisma.nomination.updateMany({
    where: { cycleId: cycle.id, employeeId: userId },
    data: { submissionStatus: "SUBMITTED" },
  });

  await writeAuditEvent({
    actorId: userId,
    action: "NOMINATIONS_SUBMITTED",
    entityType: "review_cycle",
    entityId: cycle.id,
    metadata: {
      cycleId: cycle.id,
      cycleName: cycle.name,
      employee: nominations[0] ? personAuditSnapshot(nominations[0].employee) : { id: userId },
      nominationCount: nominations.length,
      reviewers: nominations.map((nomination) => personAuditSnapshot(nomination.reviewer)),
    },
  });

  return NextResponse.json({ ok: true });
}
