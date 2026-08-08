import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["HR_ADMIN", "LINE_MANAGER"].includes((session.user as any).role)) {
    return new Response(null, { status: 303, headers: { Location: "/approvals" } });
  }
  const { id } = await params;
  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);
  if (role === "LINE_MANAGER") {
    const nomination = await prisma.nomination.findUnique({
      where: { id: Number(id) },
      select: { reviewerId: true, employee: { select: { managerId: true } } },
    });
    if (!nomination || (nomination.reviewerId !== userId && nomination.employee.managerId !== userId)) {
      return new Response(null, { status: 303, headers: { Location: "/approvals" } });
    }
  }
  await prisma.nomination.update({ where: { id: Number(id) }, data: { approvalStatus: "REJECTED" } });
  return new Response(null, { status: 303, headers: { Location: "/approvals" } });
}
