import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";
import { NextResponse } from "next/server";

// GET — my current nominations for the active cycle
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!cycle) return NextResponse.json([]);

  const nominations = await prisma.nomination.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
    include: { reviewer: { include: { department: true } } },
    orderBy: { isMandatory: "desc" },
  });

  return NextResponse.json(nominations);
}

// POST — add a nomination
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  const { reviewerId } = await req.json();
  if (!reviewerId) return NextResponse.json({ error: "reviewerId required" }, { status: 400 });
  if (reviewerId === userId) return NextResponse.json({ error: "You cannot nominate yourself" }, { status: 400 });

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: "NOMINATE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!cycle) return NextResponse.json({ error: "No cycle open for nominations" }, { status: 400 });

  // Non-HR users may nominate any active non-HR colleague. This avoids blocking
  // nominations when department data is corrected after accounts are seeded.
  if (role !== "HR_ADMIN") {
    const reviewer = await prisma.employee.findUnique({
      where: { id: reviewerId },
      select: { isActive: true, role: true },
    });
    if (!reviewer) return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
    if (!reviewer.isActive || reviewer.role === "HR_ADMIN") {
      return NextResponse.json({ error: "Reviewer must be an active colleague" }, { status: 400 });
    }
  }

  const [existing, poolSize] = await Promise.all([
    prisma.nomination.count({ where: { cycleId: cycle.id, employeeId: userId } }),
    role !== "HR_ADMIN"
      ? prisma.employee.count({ where: { isActive: true, id: { not: userId }, role: { not: "HR_ADMIN" } } })
      : Promise.resolve(cycle.maxNominees),
  ]);
  const effectiveMax = Math.min(cycle.maxNominees, poolSize);
  if (existing >= effectiveMax) {
    return NextResponse.json({ error: `Maximum ${effectiveMax} nominators allowed` }, { status: 400 });
  }

  const nom = await prisma.nomination.create({
    data: {
      cycleId: cycle.id,
      employeeId: userId,
      reviewerId,
      direction: "INBOUND",
      isMandatory: false,
    },
    include: {
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
    },
  });

  await writeAuditEvent({
    actorId: userId,
    action: "NOMINATION_CREATED",
    entityType: "nomination",
    entityId: nom.id,
    metadata: {
      cycleId: cycle.id,
      cycleName: cycle.name,
      employee: personAuditSnapshot(nom.employee),
      reviewer: personAuditSnapshot(nom.reviewer),
      direction: nom.direction,
      isMandatory: nom.isMandatory,
      approvalStatus: nom.approvalStatus,
      submissionStatus: nom.submissionStatus,
    },
  });

  return NextResponse.json(nom, { status: 201 });
}
