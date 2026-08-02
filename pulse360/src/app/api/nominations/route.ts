import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET — my current nominations for the active cycle
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: { not: "CLOSED" } } });
  if (!cycle) return NextResponse.json([]);

  const nominations = await prisma.nomination.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
    include: { reviewer: { include: { department: true } } },
    orderBy: { isMandatory: "desc" },
  });

  return NextResponse.json(nominations);
}

// POST — add a nomination
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { reviewerId } = await req.json();
  if (!reviewerId) return NextResponse.json({ error: "reviewerId required" }, { status: 400 });
  if (reviewerId === userId) return NextResponse.json({ error: "You cannot nominate yourself" }, { status: 400 });

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: "NOMINATE" } });
  if (!cycle) return NextResponse.json({ error: "No cycle open for nominations" }, { status: 400 });

  const existing = await prisma.nomination.count({ where: { cycleId: cycle.id, employeeId: userId } });
  if (existing >= cycle.maxNominees) {
    return NextResponse.json({ error: `Maximum ${cycle.maxNominees} nominators allowed` }, { status: 400 });
  }

  const nom = await prisma.nomination.create({
    data: {
      cycleId: cycle.id,
      employeeId: userId,
      reviewerId,
      direction: "INBOUND",
      isMandatory: false,
    },
    include: { reviewer: { include: { department: true } } },
  });

  return NextResponse.json(nom, { status: 201 });
}
