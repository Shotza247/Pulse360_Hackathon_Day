import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/notifications/read
// Body: { notifId: number }
// Records that the current user has read a notification.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { notifId } = await req.json();
  if (!notifId) return NextResponse.json({ error: "notifId required" }, { status: 400 });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "NOTIFY_READ",
      entityType: "notification",
      entityId: Number(notifId),
      metadata: { notifId: Number(notifId) },
    },
  });

  return NextResponse.json({ ok: true });
}
