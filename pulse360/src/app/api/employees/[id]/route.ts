import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit";

const HR_MANAGED_ROLES = ["EMPLOYEE", "LINE_MANAGER", "HR_ADMIN"];
const EMPLOYMENT_TYPES = ["INTERNSHIP", "LEARNERSHIP", "CONTRACT", "PERMANENT"];
const CONVERSION_HIRE_STATUSES = ["NO", "YES", "PENDING_DECISION", "REVIEWED"];
const GENDERS = ["WOMAN", "MAN", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"];
const ETHNICITIES = ["BLACK", "WHITE", "COLOURED", "ASIAN", "INDIAN", "OTHER", "PREFER_NOT_TO_SAY"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { department: true },
  });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((session.user as any).role !== "HR_ADMIN") {
    const { ethnicity: _ethnicity, ...safeEmployee } = employee;
    return NextResponse.json(safeEmployee);
  }

  return NextResponse.json(employee);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
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
  if (!HR_MANAGED_ROLES.includes(role)) {
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

  const before = await prisma.employee.findUnique({
    where: { id: Number(id) },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      jobGrade: true,
      employmentType: true,
      conversionHireStatus: true,
      gender: true,
      ethnicity: true,
      role: true,
      departmentId: true,
      managerId: true,
      isActive: true,
    },
  });

  const employee = await prisma.employee.update({
    where: { id: Number(id) },
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
      role,
      departmentId,
      managerId: managerId ?? null,
      isActive,
    },
  });

  await writeAuditEvent({
    actorId: Number((session.user as any).id),
    action: "EMPLOYEE_UPDATED",
    entityType: "employee",
    entityId: employee.id,
    metadata: {
      changedFields: {
        firstName: before?.firstName !== employee.firstName,
        lastName: before?.lastName !== employee.lastName,
        email: before?.email !== employee.email,
        jobTitle: before?.jobTitle !== employee.jobTitle,
        jobGrade: before?.jobGrade !== employee.jobGrade,
        employmentType: before?.employmentType !== employee.employmentType,
        conversionHireStatus: before?.conversionHireStatus !== employee.conversionHireStatus,
        gender: before?.gender !== employee.gender,
        ethnicity: before?.ethnicity !== employee.ethnicity,
        role: before?.role !== employee.role,
        departmentId: before?.departmentId !== employee.departmentId,
        managerId: before?.managerId !== employee.managerId,
        isActive: before?.isActive !== employee.isActive,
      },
      role: employee.role,
      departmentId: employee.departmentId,
      employmentType: employee.employmentType,
      conversionHireStatus: employee.conversionHireStatus,
      gender: employee.gender,
    },
  }).catch(() => {});

  return NextResponse.json(employee);
}
