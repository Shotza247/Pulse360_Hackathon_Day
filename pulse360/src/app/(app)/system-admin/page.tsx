import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatDate(value: Date) {
  return value.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetricCard({ label, value, sub, tone = "navy" }: { label: string; value: string | number; sub: string; tone?: "navy" | "green" | "amber" | "purple" }) {
  const bars = {
    navy: "bg-[#0f1f3d]",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={`h-1 ${bars[tone]}`} />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = pct(value, total);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="text-gray-500">{value}/{total} ({percent}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-[#0f1f3d]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-950">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{sub}</p>
      </div>
      {children}
    </section>
  );
}

export default async function SystemAdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as any).role !== "SYSTEM_ADMIN") redirect("/dashboard");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) ?? await prisma.reviewCycle.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const cycleWhere = cycle ? { cycleId: cycle.id } : {};

  const [employees, nominations, reviews, auditLogs, authEvents, aiUsageEvents, aiDecisionEvents] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, role: { not: "SYSTEM_ADMIN" } },
      select: { id: true, department: { select: { name: true } }, jobGrade: true, gender: true, employmentType: true, conversionHireStatus: true },
    }),
    prisma.nomination.findMany({
      where: cycleWhere,
      include: {
        employee: { select: { department: { select: { name: true } }, managerId: true } },
        reviewer: { select: { id: true, department: { select: { name: true } }, jobGrade: true } },
      },
    }),
    prisma.review.findMany({
      where: cycleWhere,
      select: {
        status: true,
        submittedAt: true,
        doWellComment: true,
        improveComment: true,
        attentionComment: true,
        wouldPickForTeam: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since }, NOT: { action: { startsWith: "NOTIFY:" } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.authEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.aiUsageEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.aiHitlDecision.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const loginEvents = authEvents.filter((row) => row.status === "SUCCESS");
  const uniqueLoginUsers = new Set(loginEvents.map((row) => row.actorId).filter(Boolean)).size;
  const submittedNominations = nominations.filter((row) => row.submissionStatus === "SUBMITTED").length;
  const pendingApprovals = nominations.filter((row) => row.approvalStatus === "PENDING").length;
  const rejectedApprovals = nominations.filter((row) => row.approvalStatus === "REJECTED").length;
  const submittedReviews = reviews.filter((row) => row.status === "SUBMITTED").length;
  const draftReviews = reviews.filter((row) => row.status === "DRAFT").length;
  const missingCommentReviews = reviews.filter((row) =>
    row.status === "SUBMITTED" && (!row.doWellComment || !row.improveComment)
  ).length;
  const aiGenerationLogs = aiUsageEvents;
  const aiSuccesses = aiGenerationLogs.filter((row) => row.status === "SUCCESS").length;
  const aiStubbed = aiGenerationLogs.filter((row) => row.stub).length;
  const aiTokens = aiGenerationLogs.reduce((sum, row) => sum + row.totalTokens, 0);
  const aiInputTokens = aiGenerationLogs.reduce((sum, row) => sum + row.inputTokens, 0);
  const aiOutputTokens = aiGenerationLogs.reduce((sum, row) => sum + row.outputTokens, 0);
  const aiAccepted = aiDecisionEvents.filter((row) => row.decision === "ACCEPTED").length;
  const aiEdited = aiDecisionEvents.filter((row) => row.decision === "EDITED").length;
  const aiDiscarded = aiDecisionEvents.filter((row) => row.decision === "DISCARDED").length;

  const departmentCounts = employees.reduce<Record<string, number>>((acc, employee) => {
    const dept = employee.department.name;
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {});

  const genderCounts = employees.reduce<Record<string, number>>((acc, employee) => {
    const label = ({
      WOMAN: "Female",
      MAN: "Male",
      NON_BINARY: "Non-binary",
      OTHER: "Other",
      PREFER_NOT_TO_SAY: "Prefer not to say",
    } as Record<string, string>)[employee.gender ?? ""] ?? "Not captured";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const employmentTypeCounts = employees.reduce<Record<string, number>>((acc, employee) => {
    const label = employee.employmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const nominationFlows = new Map<string, { subjectDept: string; reviewerDept: string; count: number }>();
  const reviewerMap = new Map<number, { count: number; department: string; jobGrade: string | null; sourceDepartments: Set<string> }>();
  const pendingBySubjectDept = new Map<string, number>();

  for (const nomination of nominations) {
    const subjectDept = nomination.employee.department.name;
    const reviewerDept = nomination.reviewer.department.name;
    const flowKey = `${subjectDept}::${reviewerDept}`;
    const flow = nominationFlows.get(flowKey);
    if (flow) flow.count += 1;
    else nominationFlows.set(flowKey, { subjectDept, reviewerDept, count: 1 });

    const reviewer = reviewerMap.get(nomination.reviewer.id);
    if (reviewer) {
      reviewer.count += 1;
      reviewer.sourceDepartments.add(subjectDept);
    } else {
      reviewerMap.set(nomination.reviewer.id, {
        count: 1,
        department: reviewerDept,
        jobGrade: nomination.reviewer.jobGrade,
        sourceDepartments: new Set([subjectDept]),
      });
    }

    if (nomination.approvalStatus === "PENDING") {
      pendingBySubjectDept.set(subjectDept, (pendingBySubjectDept.get(subjectDept) ?? 0) + 1);
    }
  }

  const flowRows = Array.from(nominationFlows.values())
    .sort((a, b) => b.count - a.count || a.subjectDept.localeCompare(b.subjectDept))
    .slice(0, 8);

  const trustedPeerRows = Array.from(reviewerMap.values())
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department))
    .slice(0, 8);

  const pendingDeptRows = Array.from(pendingBySubjectDept.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department))
    .slice(0, 8);

  const actionCounts = auditLogs.reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] ?? 0) + 1;
    return acc;
  }, {});
  const actionRows = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const latestEvents = auditLogs.slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0f1f3d] p-7 text-white">
        <p className="text-sm font-semibold text-blue-200">System Administrator</p>
        <h1 className="mt-1 text-2xl font-black">Platform Behaviour and Adoption</h1>
        <p className="mt-2 max-w-3xl text-sm text-blue-100">
          Privacy-preserving operational analytics for platform uptake, nomination flow, review completion, governance events, and AI feature usage.
        </p>
        <p className="mt-4 text-xs font-semibold text-blue-200">
          {cycle ? `Current scope: ${cycle.name} (${cycle.phase})` : "No review cycle has been created yet"} | Last 30 days for event telemetry
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Active users" value={employees.length} sub={`${uniqueLoginUsers} logged in during the last 30 days`} />
        <MetricCard label="Nominations submitted" value={`${submittedNominations}/${nominations.length}`} sub={`${pct(submittedNominations, nominations.length)}% nomination submission rate`} tone="green" />
        <MetricCard label="Reviews submitted" value={`${submittedReviews}/${reviews.length}`} sub={`${draftReviews} reviews still saved as drafts`} tone="purple" />
        <MetricCard label="AI generations" value={aiGenerationLogs.length} sub={`${aiTokens.toLocaleString("en-ZA")} tracked tokens`} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Platform Adoption" sub="Tracks usage and completion without exposing review content.">
          <div className="space-y-4">
            <ProgressRow label="30-day login coverage" value={uniqueLoginUsers} total={employees.length} />
            <ProgressRow label="Nomination submission coverage" value={submittedNominations} total={nominations.length} />
            <ProgressRow label="Review completion coverage" value={submittedReviews} total={reviews.length} />
            <ProgressRow label="AI successful generation rate" value={aiSuccesses} total={aiGenerationLogs.length} />
          </div>
        </Section>

        <Section title="Approval Health" sub="Surfaces bottlenecks by department, not by individual manager.">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Pending</p>
              <p className="text-2xl font-black text-amber-900">{pendingApprovals}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700">Approved</p>
              <p className="text-2xl font-black text-emerald-900">{nominations.filter((row) => row.approvalStatus === "APPROVED").length}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Rejected</p>
              <p className="text-2xl font-black text-red-900">{rejectedApprovals}</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingDeptRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No approval bottlenecks currently visible.</p>
            ) : pendingDeptRows.map((row) => (
              <div key={row.department} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">{row.department}</span>
                <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">{row.count}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Behavioural Network" sub="Aggregated cross-department nominations show collaboration and exposure patterns.">
          <div className="space-y-2">
            {flowRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No nomination flow data yet.</p>
            ) : flowRows.map((row) => (
              <div key={`${row.subjectDept}-${row.reviewerDept}`} className="rounded-lg border border-gray-100 p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-gray-950">{row.subjectDept} to {row.reviewerDept}</p>
                  <span className="text-xs font-bold text-gray-500">{row.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-purple-500" style={{ width: `${pct(row.count, nominations.length)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Trusted Peer Signals" sub="Anonymized high-nomination reviewers, useful for influence and internal mobility analysis.">
          <div className="space-y-2">
            {trustedPeerRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No trusted-peer signal yet.</p>
            ) : trustedPeerRows.map((row, index) => (
              <div key={`${row.department}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-950">Trusted peer cluster #{index + 1}</p>
                  <p className="truncate text-xs text-gray-500">
                    {row.department}{row.jobGrade ? ` | ${row.jobGrade}` : ""} | nominated from {row.sourceDepartments.size} department{row.sourceDepartments.size === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-2xl font-black text-gray-950">{row.count}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Review Quality Metadata" sub="Operational quality checks only; no review comments or scores are displayed.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Submitted reviews missing required comment metadata</p>
              <p className="mt-2 text-3xl font-black text-gray-950">{missingCommentReviews}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Would-pick-for-team response rate</p>
              <p className="mt-2 text-3xl font-black text-gray-950">
                {pct(reviews.filter((row) => row.wouldPickForTeam !== null).length, reviews.length)}%
              </p>
            </div>
          </div>
        </Section>

        <Section title="AI Adoption" sub="Tracks feature usage and token metadata for governance and cost monitoring.">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="text-xs font-semibold text-purple-700">Calls</p>
              <p className="text-2xl font-black text-purple-900">{aiGenerationLogs.length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700">Success</p>
              <p className="text-2xl font-black text-emerald-900">{aiSuccesses}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Demo/stub</p>
              <p className="text-2xl font-black text-amber-900">{aiStubbed}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Input tokens</p>
              <p className="text-2xl font-black text-slate-950">{aiInputTokens.toLocaleString("en-ZA")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Output tokens</p>
              <p className="text-2xl font-black text-slate-950">{aiOutputTokens.toLocaleString("en-ZA")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Total tokens</p>
              <p className="text-2xl font-black text-slate-950">{aiTokens.toLocaleString("en-ZA")}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Token counts depend on OpenAI usage metadata being returned by the model call.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Accepted</p>
              <p className="text-2xl font-black text-gray-950">{aiAccepted}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Edited</p>
              <p className="text-2xl font-black text-gray-950">{aiEdited}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Discarded</p>
              <p className="text-2xl font-black text-gray-950">{aiDiscarded}</p>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Event Mix" sub="Most common platform transactions in the last 30 days.">
          <div className="space-y-2">
            {actionRows.map(([action, count]) => (
              <div key={action} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{action.replace(/_/g, " ")}</span>
                <span className="text-sm font-black text-gray-950">{count}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Recent Governance Events" sub="Metadata-only event feed for platform monitoring.">
          <div className="divide-y divide-gray-100">
            {latestEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No recent events.</p>
            ) : latestEvents.map((row) => (
              <div key={row.id.toString()} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-gray-950">{row.action.replace(/_/g, " ")}</p>
                  <span className="shrink-0 text-xs text-gray-500">{formatDate(row.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-400">Actor present: {row.actorId ? "yes" : "no"} | Entity: {row.entityType}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Department Coverage" sub="Active employee distribution used as context for adoption and engagement rates.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(departmentCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([department, count]) => (
              <div key={department} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">{department}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{count}</span>
              </div>
            ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Gender Adoption Context" sub="Aggregated employee distribution for adoption and inclusivity monitoring.">
          <div className="space-y-2">
            {Object.entries(genderCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([gender, count]) => (
                <div key={gender} className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-800">{gender}</span>
                    <span className="text-xs font-bold text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct(count, employees.length)}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </Section>

        <Section title="Employment Mix" sub="Workforce composition used to compare adoption across contract, permanent, internship, and learnership groups.">
          <div className="space-y-2">
            {Object.entries(employmentTypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="rounded-lg border border-gray-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-800">{type}</span>
                    <span className="text-xs font-bold text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-[#0f1f3d]" style={{ width: `${pct(count, employees.length)}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
