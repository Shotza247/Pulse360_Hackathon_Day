import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const HR_MANAGED_ROLES = ["EMPLOYEE", "LINE_MANAGER", "HR_ADMIN"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { department: true },
  });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(employee);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { firstName, lastName, email, jobTitle, role, departmentId, managerId, isActive } = await req.json();
  if (!HR_MANAGED_ROLES.includes(role)) {
    return NextResponse.json({ error: "This role cannot be managed from HR employee screens" }, { status: 400 });
  }

  const employee = await prisma.employee.update({
    where: { id: Number(id) },
    data: { firstName, lastName, email: email.toLowerCase(), jobTitle, role, departmentId, managerId: managerId ?? null, isActive },
  });

  return NextResponse.json(employee);
}
