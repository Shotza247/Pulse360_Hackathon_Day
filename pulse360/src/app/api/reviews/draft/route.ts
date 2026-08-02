import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { searchParams } = new URL(req.url);
  const employeeId = Number(searchParams.get("employeeId"));
  if (!employeeId) return NextResponse.json(null);

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: "REVIEW" } });
  if (!cycle) return NextResponse.json(null);

  const review = await prisma.review.findUnique({
    where: { cycleId_reviewerId_employeeId: { cycleId: cycle.id, reviewerId: userId, employeeId } },
    include: { ratings: true },
  });

  return NextResponse.json(review ?? null);
}
