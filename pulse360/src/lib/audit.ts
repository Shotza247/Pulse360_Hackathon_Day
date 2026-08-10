import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditEvent({
  actorId,
  action,
  entityType,
  entityId,
  metadata,
}: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? {},
    },
  });
  await writeEventProjection({ actorId, action, entityType, entityId, metadata }).catch(() => {});
}

export function personAuditSnapshot(person: {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  department?: { id?: number | null; name: string } | null;
}) {
  return {
    id: person.id,
    name: `${person.firstName} ${person.lastName}`,
    email: person.email ?? null,
    jobTitle: person.jobTitle ?? null,
    departmentId: person.department?.id ?? null,
    department: person.department?.name ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataRecord(metadata: Prisma.InputJsonValue | undefined): Record<string, unknown> {
  return isRecord(metadata) ? metadata : {};
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function personSnapshot(value: unknown) {
  return isRecord(value) ? value : {};
}

function featureFromAction(action: string, metadata: Record<string, unknown>) {
  const fromMetadata = asString(metadata.feature)?.replace(/[-\s]/g, "_").toUpperCase();
  const feature = fromMetadata ?? ({
    AI_SUGGEST_COMMENTS: "SUGGEST_COMMENTS",
    AI_THEME_SUMMARY: "THEME_SUMMARY",
    AI_IMPROVEMENT_PLAN: "IMPROVEMENT_PLAN",
    AI_ANALYTICS_REPORT: "ANALYTICS_REPORT",
  } as Record<string, string>)[action];

  return enumValue(feature, ["SUGGEST_COMMENTS", "THEME_SUMMARY", "IMPROVEMENT_PLAN", "ANALYTICS_REPORT"] as const);
}

function decisionFromMetadata(metadata: Record<string, unknown>) {
  const decision = asString(metadata.decision)?.toUpperCase();
  return enumValue(decision, ["ACCEPTED", "EDITED", "DISCARDED"] as const);
}

async function writeEventProjection(input: AuditInput) {
  const metadata = metadataRecord(input.metadata);
  const actorId = input.actorId ?? null;
  const entityId = input.entityId ?? null;

  if (input.action === "LOGIN_SUCCEEDED" || input.action === "LOGIN_FAILED") {
    const role = enumValue(metadata.role, ["SYSTEM_ADMIN", "HR_ADMIN", "LINE_MANAGER", "EMPLOYEE"] as const);
    await prisma.authEvent.create({
      data: {
        actorId,
        email: asString(metadata.email),
        role,
        departmentId: asNumber(metadata.departmentId),
        departmentName: asString(metadata.department),
        status: input.action === "LOGIN_SUCCEEDED" ? "SUCCESS" : "FAILURE",
        failureReason: asString(metadata.reason),
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
    return;
  }

  if ((input.action === "PROFILE_UPDATED" || input.action === "EMPLOYEE_UPDATED") && actorId && entityId) {
    await prisma.profileEvent.create({
      data: {
        actorId,
        employeeId: entityId,
        changedFields: (isRecord(metadata.changedFields) ? metadata.changedFields : {}) as Prisma.InputJsonObject,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
    return;
  }

  if (input.action.startsWith("AI_") && input.action !== "AI_HITL_DECISION") {
    const feature = featureFromAction(input.action, metadata);
    if (!feature) return;
    await prisma.aiUsageEvent.create({
      data: {
        actorId,
        feature,
        model: asString(metadata.model),
        status: metadata.status === "error" ? "ERROR" : "SUCCESS",
        stub: Boolean(metadata.stub),
        inputTokens: asNumber(metadata.promptTokens) ?? asNumber(metadata.inputTokens) ?? 0,
        outputTokens: asNumber(metadata.completionTokens) ?? asNumber(metadata.outputTokens) ?? 0,
        totalTokens: asNumber(metadata.totalTokens) ?? 0,
        cycleId: asNumber(metadata.cycleId),
        entityType: input.entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
    return;
  }

  if (input.action === "AI_HITL_DECISION") {
    const feature = featureFromAction(input.action, metadata);
    const decision = decisionFromMetadata(metadata);
    if (!feature || !decision) return;
    await prisma.aiHitlDecision.create({
      data: {
        actorId,
        feature,
        decision,
        cycleId: asNumber(metadata.cycleId),
        entityType: input.entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
    return;
  }

  const nominationAction = ({
    NOMINATION_CREATED: "CREATED",
    NOMINATION_REMOVED: "REMOVED",
    NOMINATIONS_SUBMITTED: "SUBMITTED",
    NOMINATION_APPROVED: "APPROVED",
    NOMINATION_REJECTED: "REJECTED",
    NOMINATION_APPROVED_BULK: "BULK_APPROVED",
  } as Record<string, string>)[input.action];

  if (nominationAction) {
    const employee = personSnapshot(metadata.employee);
    const reviewer = personSnapshot(metadata.reviewer);
    await prisma.nominationEvent.create({
      data: {
        actorId,
        nominationId: input.action === "NOMINATIONS_SUBMITTED" ? null : entityId,
        cycleId: asNumber(metadata.cycleId),
        employeeId: asNumber(employee.id),
        reviewerId: asNumber(reviewer.id),
        action: nominationAction as any,
        previousApprovalStatus: enumValue(metadata.previousApprovalStatus, ["PENDING", "APPROVED", "REJECTED"] as const),
        approvalStatus: enumValue(metadata.approvalStatus, ["PENDING", "APPROVED", "REJECTED"] as const),
        submissionStatus: enumValue(metadata.submissionStatus, ["DRAFT", "SUBMITTED"] as const),
        employeeDepartmentId: asNumber(employee.departmentId),
        reviewerDepartmentId: asNumber(reviewer.departmentId),
        employeeDepartmentName: asString(employee.department),
        reviewerDepartmentName: asString(reviewer.department),
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
    return;
  }

  const reviewAction = ({
    REVIEW_DRAFT_SAVED: "DRAFT_SAVED",
    REVIEW_SUBMITTED: "SUBMITTED",
  } as Record<string, string>)[input.action];

  if (reviewAction) {
    const employee = personSnapshot(metadata.employee);
    const reviewer = personSnapshot(metadata.reviewer);
    await prisma.reviewEvent.create({
      data: {
        actorId,
        reviewId: entityId,
        cycleId: asNumber(metadata.cycleId),
        employeeId: asNumber(employee.id),
        reviewerId: asNumber(reviewer.id),
        action: reviewAction as any,
        status: enumValue(metadata.status, ["DRAFT", "SUBMITTED"] as const),
        ratingCount: asNumber(metadata.ratingCount) ?? 0,
        hasDoWellComment: Boolean(metadata.hasDoWellComment),
        hasImproveComment: Boolean(metadata.hasImproveComment),
        hasAttentionComment: Boolean(metadata.hasAttentionComment),
        wouldPickForTeam: asBoolean(metadata.wouldPickForTeam),
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  }
}
