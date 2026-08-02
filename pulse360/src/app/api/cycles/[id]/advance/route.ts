import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CyclePhase } from "@prisma/client";

const PHASE_NEXT: Record<string, CyclePhase> = {
  DRAFT: "NOMINATE", NOMINATE: "APPROVE", APPROVE: "REVIEW",
  REVIEW: "CALCULATION", CALCULATION: "CONSULTATION", CONSULTATION: "ACCEPT", ACCEPT: "CLOSED",
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "HR_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const cycle = await prisma.reviewCycle.findUnique({ where: { id: Number(id) } });
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const next = PHASE_NEXT[cycle.phase];
  if (!next) return NextResponse.json({ error: "Cycle is already closed" }, { status: 400 });

  const updated = await prisma.reviewCycle.update({
    where: { id: cycle.id },
    data: { phase: next },
  });

  return NextResponse.json(updated);
}
