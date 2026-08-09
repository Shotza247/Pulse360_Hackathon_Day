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
}

export function personAuditSnapshot(person: {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  jobTitle?: string | null;
  department?: { name: string } | null;
}) {
  return {
    id: person.id,
    name: `${person.firstName} ${person.lastName}`,
    email: person.email ?? null,
    jobTitle: person.jobTitle ?? null,
    department: person.department?.name ?? null,
  };
}
