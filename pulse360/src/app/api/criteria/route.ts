import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const criteria = await prisma.pulseCriterion.findMany({
    where: { isActive: true },
    include: { questions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(criteria);
}

// POST /api/criteria — HR Admin creates a new criterion
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Auto-assign next sort order
  const last = await prisma.pulseCriterion.findFirst({ orderBy: { sortOrder: "desc" } });
  const nextSort = (last?.sortOrder ?? 0) + 1;

  const criterion = await prisma.pulseCriterion.create({
    data: {
      name: name.trim().toUpperCase(),
      description: description?.trim() || null,
      isActive: true,
      sortOrder: nextSort,
    },
  });

  return NextResponse.json(criterion, { status: 201 });
}
