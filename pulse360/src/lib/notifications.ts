import { prisma } from "@/lib/prisma";

/**
 * Writes a notification to the audit_log for delivery via the bell.
 * forRole: "ALL" | "HR_ADMIN" | "LINE_MANAGER" | "EMPLOYEE"
 * forUserId: specific user (overrides forRole when set)
 */
export async function notify({
  title,
  body,
  phase,
  forRole,
  forUserId,
  actorId,
}: {
  title: string;
  body: string;
  phase?: string;
  forRole?: string;
  forUserId?: number;
  actorId?: number;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action: "NOTIFY:" + (phase ?? "GENERAL"),
      entityType: "review_cycle",
      metadata: {
        title,
        body,
        phase: phase ?? null,
        forRole: forRole ?? "ALL",
        ...(forUserId !== undefined ? { forUserId } : {}),
      },
    },
  });
}

/**
 * Emits the correct notifications when a cycle advances to a new phase.
 */
export async function notifyPhaseTransition(cycleId: number, cycleName: string, newPhase: string) {
  switch (newPhase) {
    case "NOMINATE":
      await notify({
        title: "Nominations are now open",
        body: `The review cycle "${cycleName}" is now in the nomination phase. Log in to nominate your peer reviewers.`,
        phase: "NOMINATE",
        forRole: "ALL",
      });
      break;

    case "APPROVE":
      await notify({
        title: "Nominations ready for approval",
        body: `Nominations for "${cycleName}" are ready. Please review and approve your team's nominations.`,
        phase: "APPROVE",
        forRole: "LINE_MANAGER",
      });
      await notify({
        title: "Cycle moved to Approval phase",
        body: `"${cycleName}" is now in the approval phase. Line managers are reviewing nominations.`,
        phase: "APPROVE",
        forRole: "HR_ADMIN",
      });
      break;

    case "REVIEW":
      await notify({
        title: "Review period is open",
        body: `Approved nominations are confirmed. The review period for "${cycleName}" is now open — complete your peer reviews.`,
        phase: "REVIEW",
        forRole: "ALL",
      });
      break;

    case "CONSULTATION":
      await notify({
        title: "Scores calculated — your team's results are ready",
        body: `Reviews for "${cycleName}" are closed and scores have been calculated. You can now view your team's results before they are shared with employees.`,
        phase: "CONSULTATION",
        forRole: "LINE_MANAGER",
      });
      await notify({
        title: "Scores calculated",
        body: `All scores for "${cycleName}" have been calculated. Results are with managers for consultation.`,
        phase: "CONSULTATION",
        forRole: "HR_ADMIN",
      });
      break;

    case "ACCEPT":
      await notify({
        title: "Your results are available",
        body: `Your performance review results for "${cycleName}" are now available. Log in to view your scores and feedback.`,
        phase: "ACCEPT",
        forRole: "EMPLOYEE",
      });
      await notify({
        title: "Results released to employees",
        body: `Results for "${cycleName}" have been shared with all employees.`,
        phase: "ACCEPT",
        forRole: "LINE_MANAGER",
      });
      break;

    case "CLOSED":
      await notify({
        title: `Cycle "${cycleName}" is now closed`,
        body: `The review cycle has been closed. All results are now part of the historical record.`,
        phase: "CLOSED",
        forRole: "HR_ADMIN",
      });
      break;
  }
}
