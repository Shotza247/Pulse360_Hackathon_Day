import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const HR_MANAGED_ROLES = ["EMPLOYEE", "LINE_MANAGER", "HR_ADMIN"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { firstName, lastName, email, jobTitle, role, departmentId, managerId, isActive } = await req.json();
  if (!firstName || !lastName || !email || !departmentId) {
    return NextResponse.json({ error: "firstName, lastName, email and departmentId are required" }, { status: 400 });
  }
  const employeeRole = role ?? "EMPLOYEE";
  if (!HR_MANAGED_ROLES.includes(employeeRole)) {
    return NextResponse.json({ error: "This role cannot be managed from HR employee screens" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash("Pulse360!Employee", 12);

  const employee = await prisma.employee.create({
    data: { firstName, lastName, email: email.toLowerCase(), jobTitle, role: employeeRole, departmentId, managerId: managerId ?? null, isActive: isActive ?? true, passwordHash },
  });

  return NextResponse.json(employee, { status: 201 });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const search = searchParams.get("search") ?? "";
  const take = 20;
  const skip = (page - 1) * take;

  const where = search
    ? { OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ], role: { not: "SYSTEM_ADMIN" as const } }
    : { role: { not: "SYSTEM_ADMIN" as const } };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({ where, skip, take, include: { department: true }, orderBy: { lastName: "asc" } }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({ employees, total, page, pages: Math.ceil(total / take) });
}
