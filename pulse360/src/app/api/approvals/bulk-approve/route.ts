import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  });

  if (!cycle) return NextResponse.json({ error: "No active approval cycle" }, { status: 400 });

  const managerId = Number((session.user as any).id);

  // Build where clause
  // LINE_MANAGER: can only bulk-approve their own direct reports
  // HR_ADMIN: can approve anyone
  const where: any = {
    cycleId: cycle.id,
    approvalStatus: "PENDING",
  };

  if (employeeId) {
    where.employeeId = Number(employeeId);
  }

  if (role === "LINE_MANAGER") {
    // Restrict to direct reports only
    where.employee = { managerId };
  }

  const result = await prisma.nomination.updateMany({
    where,
    data: { approvalStatus: "APPROVED" },
  });

  return NextResponse.json({ approved: result.count });
}
