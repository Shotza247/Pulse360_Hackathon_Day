import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feature, decision, employeeId, cycleId, stub } = await req.json();
  if (!feature || !decision) {
    return NextResponse.json({ error: "feature and decision are required" }, { status: 400 });
  }

  await writeAuditEvent({
    actorId: Number((session.user as any).id),
    action: "AI_HITL_DECISION",
    entityType: "ai_interaction",
    entityId: employeeId ? Number(employeeId) : null,
    metadata: {
      feature,
      decision,
      employeeId: employeeId ? Number(employeeId) : null,
      cycleId: cycleId ? Number(cycleId) : null,
      stub: Boolean(stub),
    },
  });

  return NextResponse.json({ ok: true });
}
