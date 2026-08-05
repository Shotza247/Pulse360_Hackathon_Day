import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/notifications
// Returns unread notifications for the current user, scoped by role.
// Notifications are stored in the audit_log table using a special action prefix "NOTIFY:".
// Each notification row:  metadata = { title, body, forRole?, forUserId? }
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);
  const role = (session.user as any).role as string;

  // Fetch notifications targeted at this user or this role
  const rows = await prisma.auditLog.findMany({
    where: {
      action: { startsWith: "NOTIFY:" },
      OR: [
        { metadata: { path: ["forUserId"], equals: userId } },
        { metadata: { path: ["forRole"],   equals: role } },
        { metadata: { path: ["forRole"],   equals: "ALL" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Mark which ones the user has already read (stored as a JSON array in their employee record)
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  // We use a simple "read" tracking via a separate query on audit_log with action "NOTIFY_READ"
  const readRows = await prisma.auditLog.findMany({
    where: { actorId: userId, action: "NOTIFY_READ" },
    select: { metadata: true },
  });
  const readIds = new Set(
    readRows.map((r) => (r.metadata as any)?.notifId as number).filter(Boolean)
  );

  const notifications = rows.map((r) => {
    const meta = r.metadata as any;
    return {
      id: Number(r.id),
      title: meta?.title ?? "Notification",
      body:  meta?.body  ?? "",
      phase: meta?.phase ?? null,
      createdAt: r.createdAt,
      read: readIds.has(Number(r.id)),
    };
  });

  return NextResponse.json(notifications);
}
