import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, startDate, endDate, minNominees, maxNominees } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: "name, startDate and endDate are required" }, { status: 400 });
  }
  if (new Date(endDate) <= new Date(startDate)) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  // Only one active cycle at a time
  const existing = await prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } } });
  if (existing) {
    return NextResponse.json({ error: `Cycle "${existing.name}" is already active (${existing.phase}). Close it first.` }, { status: 409 });
  }

  const createdById = Number((session.user as any).id);

  // Attach all active criteria to the new cycle
  const activeCriteria = await prisma.pulseCriterion.findMany({ where: { isActive: true }, select: { id: true } });

  const cycle = await prisma.reviewCycle.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      minNominees: minNominees ?? 3,
      maxNominees: maxNominees ?? 8,
      createdById,
      criteria: { create: activeCriteria.map((c) => ({ criterionId: c.id })) },
    },
  });

  return NextResponse.json(cycle, { status: 201 });
}
