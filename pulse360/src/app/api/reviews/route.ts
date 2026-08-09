import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personAuditSnapshot, writeAuditEvent } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reviewerId = Number((session.user as any).id);

  const { employeeId, doWell, improve, attention, wouldPick, ratings, submit } = await req.json();

  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  if (submit && (doWell?.length < 20 || improve?.length < 20)) {
    return NextResponse.json({ error: "Comments must be at least 20 characters" }, { status: 400 });
  }

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: "REVIEW" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!cycle) return NextResponse.json({ error: "No cycle in review phase" }, { status: 400 });

  // Verify nomination exists and is approved
  const nomination = await prisma.nomination.findUnique({
    where: { cycleId_employeeId_reviewerId: { cycleId: cycle.id, employeeId, reviewerId } },
  });
  if (!nomination || nomination.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "No approved nomination found" }, { status: 403 });
  }

  // Get criteria/questions for lookups
  const questions = await prisma.pulseQuestion.findMany({
    where: { isActive: true },
    include: { criterion: true },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const existing = await prisma.review.findUnique({
    where: { cycleId_reviewerId_employeeId: { cycleId: cycle.id, reviewerId, employeeId } },
  });

  if (existing?.status === "SUBMITTED") {
    return NextResponse.json({ error: "Review already submitted and locked" }, { status: 400 });
  }

  const ratingData = (ratings as { questionId: number; value: number | string }[]).map((r) => {
    const q = qMap.get(r.questionId);
    return {
      questionId: r.questionId,
      criterionId: q?.criterionId ?? 0,
      score: q?.answerType === "RATING" ? Number(r.value) : null,
      textAnswer: q?.answerType !== "RATING" ? String(r.value) : null,
    };
  });

  const review = await prisma.review.upsert({
    where: { cycleId_reviewerId_employeeId: { cycleId: cycle.id, reviewerId, employeeId } },
    create: {
      cycleId: cycle.id, reviewerId, employeeId,
      doWellComment: doWell, improveComment: improve, attentionComment: attention, wouldPickForTeam: wouldPick,
      status: submit ? "SUBMITTED" : "DRAFT",
      submittedAt: submit ? new Date() : null,
      ratings: { create: ratingData },
    },
    update: {
      doWellComment: doWell, improveComment: improve, attentionComment: attention, wouldPickForTeam: wouldPick,
      status: submit ? "SUBMITTED" : "DRAFT",
      submittedAt: submit ? new Date() : null,
      ratings: {
        deleteMany: {},
        create: ratingData,
      },
    },
    include: {
      employee: { include: { department: true } },
      reviewer: { include: { department: true } },
      ratings: true,
    },
  });

  await writeAuditEvent({
    actorId: reviewerId,
    action: submit ? "REVIEW_SUBMITTED" : "REVIEW_DRAFT_SAVED",
    entityType: "review",
    entityId: review.id,
    metadata: {
      cycleId: cycle.id,
      cycleName: cycle.name,
      employee: personAuditSnapshot(review.employee),
      reviewer: personAuditSnapshot(review.reviewer),
      status: review.status,
      submittedAt: review.submittedAt?.toISOString() ?? null,
      ratingCount: review.ratings.length,
      hasDoWellComment: Boolean(review.doWellComment),
      hasImproveComment: Boolean(review.improveComment),
      hasAttentionComment: Boolean(review.attentionComment),
      wouldPickForTeam: review.wouldPickForTeam,
      wasExistingReview: Boolean(existing),
    },
  });

  return NextResponse.json(review);
}
