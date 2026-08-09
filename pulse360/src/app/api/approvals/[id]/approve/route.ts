import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["HR_ADMIN", "LINE_MANAGER"].includes((session.user as any).role)) {
    return new Response(null, { status: 303, headers: { Location: "/approvals" } });
  }
  const { id } = await params;
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  const nomination = await prisma.nomination.findUnique({
    where: { id: Number(id) },
    include: {
      cycle: true,
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
    },
  });

  if (!nomination || (role === "LINE_MANAGER" && nomination.employee.managerId !== userId)) {
    return new Response(null, { status: 303, headers: { Location: "/approvals" } });
  }

  await prisma.nomination.update({ where: { id: Number(id) }, data: { approvalStatus: "APPROVED" } });
  await writeAuditEvent({
    actorId: userId,
    action: "NOMINATION_APPROVED",
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
    },
  });

  return new Response(null, { status: 303, headers: { Location: "/approvals" } });
}
