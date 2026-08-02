import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["HR_ADMIN", "LINE_MANAGER"].includes((session.user as any).role)) {
    return new Response(null, { status: 303, headers: { Location: "/approvals" } });
  }
  const { id } = await params;
  await prisma.nomination.update({ where: { id: Number(id) }, data: { approvalStatus: "REJECTED" } });
  return new Response(null, { status: 303, headers: { Location: "/approvals" } });
}
