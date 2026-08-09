import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const { id } = await params;

  const nom = await prisma.nomination.findUnique({
    where: { id: Number(id) },
    include: {
      cycle: true,
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
    },
  });
  if (!nom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (nom.employeeId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (nom.isMandatory) return NextResponse.json({ error: "Cannot remove mandatory reviewer (manager)" }, { status: 400 });

  await prisma.nomination.delete({ where: { id: nom.id } });
  await writeAuditEvent({
    actorId: userId,
    action: "NOMINATION_REMOVED",
    entityType: "nomination",
    entityId: nom.id,
    metadata: {
      cycleId: nom.cycleId,
      cycleName: nom.cycle.name,
      employee: personAuditSnapshot(nom.employee),
      reviewer: personAuditSnapshot(nom.reviewer),
      approvalStatus: nom.approvalStatus,
      submissionStatus: nom.submissionStatus,
    },
  });

  return NextResponse.json({ ok: true });
}
