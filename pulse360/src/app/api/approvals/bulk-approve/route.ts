import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

// POST /api/approvals/bulk-approve
// Body: { employeeId?: number } — if provided, approve all pending for that employee
//                                 if omitted (HR Admin only), approve ALL pending in the cycle
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["HR_ADMIN", "LINE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await req.json().catch(() => ({}));

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { in: ["APPROVE", "NOMINATE"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  if (!cycle) return NextResponse.json({ error: "No active approval cycle" }, { status: 400 });

  const managerId = Number((session.user as any).id);

  // Build where clause
  // LINE_MANAGER: can only bulk-approve nominations for their direct reports
  // HR_ADMIN: can approve anyone
  const where: any = {
    cycleId: cycle.id,
    approvalStatus: "PENDING",
  };

  if (employeeId) {
    where.employeeId = Number(employeeId);
  }

  if (role === "LINE_MANAGER") {
    where.employee = { managerId };
  }

  const nominations = await prisma.nomination.findMany({
    where,
    include: {
      cycle: true,
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
    },
  });
  const nominationIds = nominations.map((nomination) => nomination.id);

  if (nominationIds.length === 0) {
    return NextResponse.json({ approved: 0 });
  }

  const result = await prisma.nomination.updateMany({
    where: { id: { in: nominationIds } },
    data: { approvalStatus: "APPROVED" },
  });

  await Promise.all(
    nominations.map((nomination) =>
      writeAuditEvent({
        actorId: managerId,
        action: "NOMINATION_APPROVED_BULK",
        entityType: "nomination",
        entityId: nomination.id,
        metadata: {
          cycleId: nomination.cycleId,
          cycleName: nomination.cycle.name,
          employee: personAuditSnapshot(nomination.employee),
          reviewer: personAuditSnapshot(nomination.reviewer),
          previousApprovalStatus: nomination.approvalStatus,
          approvalStatus: "APPROVED",
          approvedByRole: role,
          bulkEmployeeFilter: employeeId ? Number(employeeId) : null,
        },
      })
    )
  );

  return NextResponse.json({ approved: result.count });
}
