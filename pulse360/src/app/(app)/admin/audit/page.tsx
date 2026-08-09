import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: { name: string };
};

function fullName(person: Pick<Person, "firstName" | "lastName">) {
  return `${person.firstName} ${person.lastName}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
    DRAFT: "bg-gray-100 text-gray-700",
    SUBMITTED: "bg-blue-100 text-blue-800",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors[value] ?? "bg-gray-100 text-gray-700"}`}>
      {value}
    </span>
  );
}

function actionLabel(action: string) {
  return action
    .replace(/^NOMINATION_/, "Nomination ")
    .replace(/^NOMINATIONS_/, "Nominations ")
    .replace(/^REVIEW_/, "Review ")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function auditSummary(action: string, metadata: any) {
  const employee = metadata?.employee?.name;
  const reviewer = metadata?.reviewer?.name;

  if (action.startsWith("NOMINATION") && employee && reviewer) {
    return `${employee} nominated ${reviewer}`;
  }

  if (action.startsWith("REVIEW") && employee && reviewer) {
    return `${reviewer} reviewed ${employee}`;
  }

  if (Array.isArray(metadata?.reviewers) && metadata?.employee?.name) {
    return `${metadata.employee.name} submitted ${metadata.reviewers.length} reviewer nominations`;
  }

  return metadata?.cycleName ? `Cycle: ${metadata.cycleName}` : "System transaction";
}

export default async function SystemAuditPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as any).role !== "HR_ADMIN") redirect("/dashboard");

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: { not: "CLOSED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  }) ?? await prisma.reviewCycle.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const cycleWhere = cycle ? { cycleId: cycle.id } : {};

  const [nominations, reviews, auditLogs] = await Promise.all([
    prisma.nomination.findMany({
      where: cycleWhere,
      include: {
        employee: { include: { department: true } },
        reviewer: { include: { department: true } },
        cycle: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.review.findMany({
      where: cycleWhere,
      include: {
        employee: { include: { department: true } },
        reviewer: { include: { department: true } },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    }),
    prisma.auditLog.findMany({
      where: { NOT: { action: { startsWith: "NOTIFY:" } } },
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const approvalCounts = nominations.reduce<Record<string, number>>((acc, nomination) => {
    acc[nomination.approvalStatus] = (acc[nomination.approvalStatus] ?? 0) + 1;
    return acc;
  }, {});

  const reviewCounts = reviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.status] = (acc[review.status] ?? 0) + 1;
    return acc;
  }, {});

  const topReviewerMap = new Map<number, { reviewer: Person; count: number; employeeDepartments: Set<string> }>();
  for (const nomination of nominations) {
    const existing = topReviewerMap.get(nomination.reviewerId);
    if (existing) {
      existing.count += 1;
      existing.employeeDepartments.add(nomination.employee.department.name);
    } else {
      topReviewerMap.set(nomination.reviewerId, {
        reviewer: nomination.reviewer,
        count: 1,
        employeeDepartments: new Set([nomination.employee.department.name]),
      });
    }
  }

  const topReviewers = Array.from(topReviewerMap.values())
    .sort((a, b) => b.count - a.count || fullName(a.reviewer).localeCompare(fullName(b.reviewer)))
    .slice(0, 8);

  const flowMap = new Map<string, { subjectDept: string; reviewerDept: string; count: number }>();
  for (const nomination of nominations) {
    const subjectDept = nomination.employee.department.name;
    const reviewerDept = nomination.reviewer.department.name;
    const key = `${subjectDept}::${reviewerDept}`;
    const existing = flowMap.get(key);
    if (existing) existing.count += 1;
    else flowMap.set(key, { subjectDept, reviewerDept, count: 1 });
  }

  const departmentFlows = Array.from(flowMap.values())
    .sort((a, b) => b.count - a.count || a.subjectDept.localeCompare(b.subjectDept))
    .slice(0, 10);

  const recentNominations = nominations.slice(0, 30);
  const recentReviews = reviews.slice(0, 20);
  const pickYes = reviews.filter((review) => review.wouldPickForTeam === true).length;
  const pickNo = reviews.filter((review) => review.wouldPickForTeam === false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">System Administration</p>
          <h1 className="text-2xl font-black text-gray-950">Audit and Interaction Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">
            {cycle ? `Monitoring ${cycle.name} (${cycle.phase})` : "No review cycle found yet"}
          </p>
        </div>
        <Link
          href="/analytics"
          className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
        >
          View HR analytics
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Nominations" value={nominations.length} sub="nomination records in scope" />
        <MetricCard label="Pending approvals" value={approvalCounts.PENDING ?? 0} sub="line-manager or HR action needed" />
        <MetricCard label="Reviews submitted" value={reviewCounts.SUBMITTED ?? 0} sub={`${reviewCounts.DRAFT ?? 0} saved as draft`} />
        <MetricCard label="Team reaction" value={`${pickYes}/${pickYes + pickNo || 0}`} sub="would pick for team responses" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-950">Most Nominated Reviewers</h2>
            <span className="text-xs font-semibold text-gray-400">Top {topReviewers.length}</span>
          </div>
          <div className="space-y-3">
            {topReviewers.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No nominations have been captured yet.</p>
            ) : topReviewers.map((item) => (
              <div key={item.reviewer.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-gray-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-950">{fullName(item.reviewer)}</p>
                  <p className="truncate text-xs text-gray-500">{item.reviewer.department.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    Nominated by employees from {Array.from(item.employeeDepartments).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-950">{item.count}</p>
                  <p className="text-xs text-gray-400">nominations</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-950">Department Nomination Flow</h2>
            <span className="text-xs font-semibold text-gray-400">Subject to reviewer</span>
          </div>
          <div className="space-y-2">
            {departmentFlows.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No department flow data yet.</p>
            ) : departmentFlows.map((flow) => (
              <div key={`${flow.subjectDept}-${flow.reviewerDept}`} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{flow.subjectDept}</p>
                  <p className="truncate text-xs text-gray-500">nominated reviewers in {flow.reviewerDept}</p>
                </div>
                <span className="rounded-full bg-[#0f1f3d] px-2.5 py-1 text-xs font-bold text-white">{flow.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-950">Who Nominated Who</h2>
          <p className="mt-1 text-xs text-gray-500">Shows the employee being reviewed, the nominated reviewer, both departments, and the approval state.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Employee being reviewed</th>
                <th className="px-5 py-3">Employee department</th>
                <th className="px-5 py-3">Nominated reviewer</th>
                <th className="px-5 py-3">Reviewer department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentNominations.map((nomination) => (
                <tr key={nomination.id}>
                  <td className="px-5 py-3 font-semibold text-gray-950">{fullName(nomination.employee)}</td>
                  <td className="px-5 py-3 text-gray-600">{nomination.employee.department.name}</td>
                  <td className="px-5 py-3 font-semibold text-gray-950">{fullName(nomination.reviewer)}</td>
                  <td className="px-5 py-3 text-gray-600">{nomination.reviewer.department.name}</td>
                  <td className="px-5 py-3"><StatusBadge value={nomination.approvalStatus} /></td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(nomination.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-950">Review Activity</h2>
            <p className="mt-1 text-xs text-gray-500">Tracks review assignment status without exposing written feedback in the audit table.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {recentReviews.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">No review activity yet.</p>
            ) : recentReviews.map((review) => (
              <div key={review.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm font-semibold text-gray-950">{fullName(review.reviewer)} reviewed {fullName(review.employee)}</p>
                  <p className="text-xs text-gray-500">
                    {review.reviewer.department.name} to {review.employee.department.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <StatusBadge value={review.status} />
                  <span className="text-xs text-gray-500">{formatDate(review.submittedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-950">Transaction Audit Log</h2>
            <p className="mt-1 text-xs text-gray-500">New nomination, approval, rejection, and review events appear here as they happen.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {auditLogs.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">No auditable transactions have been captured yet.</p>
            ) : auditLogs.map((row) => {
              const metadata = row.metadata as any;
              return (
                <div key={row.id.toString()} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-950">{actionLabel(row.action)}</p>
                      <p className="truncate text-xs text-gray-500">{auditSummary(row.action, metadata)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Actor: {row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : "System"}{row.actor?.department ? `, ${row.actor.department.name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{formatDate(row.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
