import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const { id } = await params;

  const nom = await prisma.nomination.findUnique({ where: { id: Number(id) } });
  if (!nom) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (nom.employeeId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (nom.isMandatory) return NextResponse.json({ error: "Cannot remove mandatory reviewer (manager)" }, { status: 400 });

  await prisma.nomination.delete({ where: { id: nom.id } });
  return NextResponse.json({ ok: true });
}
