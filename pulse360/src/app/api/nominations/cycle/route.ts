import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!cycle) return NextResponse.json(null);

  // Compute how many active reviewers are actually available so the UI can
  // show the correct effective minimum for small or corrected departments.
  let effectiveMinNominees = cycle.minNominees;
  let effectiveMaxNominees = cycle.maxNominees;
  if (role !== "HR_ADMIN") {
    const poolSize = await prisma.employee.count({
      where: { isActive: true, id: { not: userId }, role: { not: "HR_ADMIN" } },
    });
    effectiveMinNominees = Math.min(cycle.minNominees, poolSize);
    effectiveMaxNominees = Math.min(cycle.maxNominees, poolSize);
  }

  return NextResponse.json({ ...cycle, effectiveMinNominees, effectiveMaxNominees });
}
