import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as any).id);
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      jobGrade: true,
      role: true,
      department: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as any).id);
  const { firstName, lastName, email, jobTitle } = await req.json();
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!firstName?.trim() || !lastName?.trim() || !cleanEmail) {
    return NextResponse.json({ error: "First name, last name and email are required" }, { status: 400 });
  }

  const duplicate = await prisma.employee.findFirst({
    where: { email: cleanEmail, id: { not: userId } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Email is already used by another employee" }, { status: 409 });
  }

  const employee = await prisma.employee.update({
    where: { id: userId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      jobTitle: typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      jobGrade: true,
      role: true,
      department: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(employee);
}
