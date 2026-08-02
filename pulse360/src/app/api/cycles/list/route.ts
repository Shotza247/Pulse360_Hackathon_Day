import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await prisma.reviewCycle.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json(cycles);
}
