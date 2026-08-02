import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: "NOMINATE" } });
  if (!cycle) return NextResponse.json({ error: "No cycle open for nominations" }, { status: 400 });

  const nominations = await prisma.nomination.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
  });

  if (nominations.length < cycle.minNominees) {
    return NextResponse.json({ error: `Minimum ${cycle.minNominees} reviewers required` }, { status: 400 });
  }

  await prisma.nomination.updateMany({
    where: { cycleId: cycle.id, employeeId: userId },
    data: { submissionStatus: "SUBMITTED" },
  });

  return NextResponse.json({ ok: true });
}
