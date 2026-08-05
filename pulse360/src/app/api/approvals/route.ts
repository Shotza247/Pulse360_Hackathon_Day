import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/approvals?cycleId=4&pending=true
// Returns nominations for the approvals page (filtered by role)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = Number((session.user as any).id);

  if (!["HR_ADMIN", "LINE_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycleId");
  const pendingOnly = searchParams.get("pending") === "true";

  const cycle = cycleId
    ? await prisma.reviewCycle.findUnique({ where: { id: Number(cycleId) } })
    : await prisma.reviewCycle.findFirst({ where: { phase: { in: ["APPROVE", "NOMINATE"] } } });

  if (!cycle) return NextResponse.json([]);

  const where: any = {
    cycleId: cycle.id,
    ...(pendingOnly ? { approvalStatus: "PENDING" } : {}),
    ...(role === "LINE_MANAGER" ? { employee: { managerId: userId } } : {}),
  };

  const nominations = await prisma.nomination.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
      reviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ employeeId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(nominations);
}
