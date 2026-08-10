import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { writeAuditEvent } from "@/lib/audit";

const HR_MANAGED_ROLES = ["EMPLOYEE", "LINE_MANAGER", "HR_ADMIN"];
const EMPLOYMENT_TYPES = ["INTERNSHIP", "LEARNERSHIP", "CONTRACT", "PERMANENT"];
const CONVERSION_HIRE_STATUSES = ["NO", "YES", "PENDING_DECISION", "REVIEWED"];
const GENDERS = ["WOMAN", "MAN", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"];
const ETHNICITIES = ["BLACK", "WHITE", "COLOURED", "ASIAN", "INDIAN", "OTHER", "PREFER_NOT_TO_SAY"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    firstName,
    lastName,
    email,
    jobTitle,
    jobGrade,
    employmentType,
    conversionHireStatus,
    gender,
    ethnicity,
    role,
    departmentId,
    managerId,
    isActive,
  } = await req.json();
  if (!firstName || !lastName || !email || !departmentId) {
    return NextResponse.json({ error: "firstName, lastName, email and departmentId are required" }, { status: 400 });
  }
  const employeeRole = role ?? "EMPLOYEE";
  if (!HR_MANAGED_ROLES.includes(employeeRole)) {
    return NextResponse.json({ error: "This role cannot be managed from HR employee screens" }, { status: 400 });
  }
  if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType)) {
    return NextResponse.json({ error: "Invalid employment type" }, { status: 400 });
  }
  if (conversionHireStatus && !CONVERSION_HIRE_STATUSES.includes(conversionHireStatus)) {
    return NextResponse.json({ error: "Invalid conversion hire status" }, { status: 400 });
  }
  if (gender && !GENDERS.includes(gender)) {
    return NextResponse.json({ error: "Invalid gender" }, { status: 400 });
  }
  if (ethnicity && !ETHNICITIES.includes(ethnicity)) {
    return NextResponse.json({ error: "Invalid ethnicity" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash("Pulse360!Employee", 12);

  const employee = await prisma.employee.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      jobTitle: typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : null,
      jobGrade: typeof jobGrade === "string" && jobGrade.trim() ? jobGrade.trim() : null,
      employmentType: employmentType ?? "PERMANENT",
      conversionHireStatus: conversionHireStatus ?? "NO",
      gender: gender || null,
      ethnicity: ethnicity || null,
      role: employeeRole,
      departmentId,
      managerId: managerId ?? null,
      isActive: isActive ?? true,
      passwordHash,
    },
  });

  await writeAuditEvent({
    actorId: Number((session.user as any).id),
    action: "EMPLOYEE_CREATED",
    entityType: "employee",
    entityId: employee.id,
    metadata: {
      role: employee.role,
      departmentId: employee.departmentId,
      employmentType: employee.employmentType,
      conversionHireStatus: employee.conversionHireStatus,
      gender: employee.gender,
    },
  }).catch(() => {});

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
