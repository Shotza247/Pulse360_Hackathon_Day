import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  // HR_ADMIN sees everyone; other roles see all active non-HR colleagues so
  // corrected department assignments do not hide valid reviewers.
  const where: object = role === "HR_ADMIN"
    ? { isActive: true, id: { not: userId } }
    : { isActive: true, id: { not: userId }, role: { not: "HR_ADMIN" } };

  const employees = await prisma.employee.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(employees);
}
