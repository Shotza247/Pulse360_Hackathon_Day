import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  // HR_ADMIN sees everyone; all other roles see only same-department peers (excluding themselves)
  let where: object = { isActive: true, id: { not: userId } };

  if (role !== "HR_ADMIN") {
    const me = await prisma.employee.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (me) {
      where = { isActive: true, id: { not: userId }, departmentId: me.departmentId };
    }
  }

  const employees = await prisma.employee.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(employees);
}
