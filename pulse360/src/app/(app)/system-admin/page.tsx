import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HorizontalBarChart, TrendChart } from "@/components/system-admin/AnalyticsCharts";
import {
  aggregateTrend,
  compareMetric,
  formatTrendLabel,
  isOverdueApproval,
  parseDashboardTab,
  parseDepartmentSelection,
  resolveDateWindow,
  shouldSuppressCohort,
  shouldSuppressSelectedDepartments,
} from "@/lib/system-admin-analytics";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;
type SearchParams = Record<string, QueryValue>;
type MetricTone = "navy" | "green" | "amber" | "purple";

function valueOf(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function MetricCard({ label, value, sub, tone = "navy" }: { label: string; value: string | number; sub: string; tone?: MetricTone }) {
  const bars: Record<MetricTone, string> = {
    navy: "bg-[#0f1f3d]",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    purple: "bg-purple-500",
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className={`h-1 ${bars[tone]}`} />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{sub}</p>
      </div>
    </section>
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

function CountRows({ rows, empty }: { rows: Array<{ label: string; value: number }>; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-sm text-gray-500">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-gray-800">{row.label}</span>
            <span className="tabular-nums text-gray-600">{row.value.toLocaleString("en-ZA")}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function compareLabel(current: number, previous: number) {
  const comparison = compareMetric(current, previous);
  if (comparison.percentChange === null) return `${comparison.delta >= 0 ? "+" : ""}${comparison.delta} vs previous period; no percentage baseline`;
  return `${comparison.percentChange >= 0 ? "+" : ""}${comparison.percentChange}% vs previous period`;
}

function tabHref(tab: string, params: SearchParams, departmentIds: number[], cycleValue: string) {
  const query = new URLSearchParams();
  query.set("tab", tab);
  const range = valueOf(params.range);
  if (range) query.set("range", range);
  if (range === "custom") {
    const from = valueOf(params.from);
    const to = valueOf(params.to);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
  }
  for (const id of departmentIds) query.append("departments", String(id));
  query.set("cycle", cycleValue);
  return `/system-admin?${query.toString()}`;
}

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function trendLines(currentLabel: string, currentColor: string, current: number[], previous: number[]) {
  return [
    { label: `${currentLabel} · selected`, color: currentColor, values: current },
    { label: `${currentLabel} · previous`, color: "#94a3b8", values: previous, dashed: true },
  ];
}

export default async function SystemAdminDashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as { role?: string }).role !== "SYSTEM_ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const tab = parseDashboardTab(params.tab);
  let dateWindow;
  let invalidCustomRange = false;
  try {
    dateWindow = resolveDateWindow(params);
  } catch {
    invalidCustomRange = true;
    dateWindow = resolveDateWindow({ range: "30d" });
  }

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const requestedDepartments = parseDepartmentSelection(params.departments);
  const validDepartmentIds = requestedDepartments.mode === "selected"
    ? requestedDepartments.ids.filter((id) => departments.some((department) => department.id === id))
    : [];
  const selectedDepartmentSet = new Set(validDepartmentIds);
  const selectionIsAll = validDepartmentIds.length === 0;
  const employeeDepartmentWhere = selectionIsAll ? {} : { departmentId: { in: validDepartmentIds } };
  const [cycleList, departmentPopulations] = await Promise.all([
    prisma.reviewCycle.findMany({ orderBy: [{ startDate: "desc" }, { id: "desc" }], select: { id: true, name: true, phase: true } }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { isActive: true, role: { not: "SYSTEM_ADMIN" } },
      _count: { _all: true },
    }),
  ]);
  const departmentPopulationCounts = new Map(departmentPopulations.map((item) => [item.departmentId, item._count._all]));
  const selectedDepartmentsSuppressed = shouldSuppressSelectedDepartments(
    validDepartmentIds.map((id) => departmentPopulationCounts.get(id) ?? 0),
  );
  const currentCycle = cycleList.find((item) => item.phase !== "CLOSED") ?? cycleList[0] ?? null;
  const requestedCycle = valueOf(params.cycle);
  const selectedCycle = requestedCycle === "all"
    ? null
    : cycleList.find((item) => String(item.id) === requestedCycle) ?? currentCycle;
  const cycleValue = requestedCycle === "all" ? "all" : selectedCycle ? String(selectedCycle.id) : "all";
  const cycleWhere = selectedCycle ? { cycleId: selectedCycle.id } : {};
  const employeeWhere = { isActive: true, role: { not: "SYSTEM_ADMIN" as const }, ...employeeDepartmentWhere };
  const selectedDepartmentName = validDepartmentIds.length === 1
    ? departments.find((item) => item.id === validDepartmentIds[0])?.name ?? "Selected department"
    : validDepartmentIds.length > 1
      ? `${validDepartmentIds.length} departments selected`
      : "All departments";

  const period = (from: Date, to: Date) => ({ createdAt: { gte: from, lt: to } });
  const authEventWhere = (from: Date, to: Date) => ({
    ...period(from, to),
    status: "SUCCESS" as const,
    role: { not: "SYSTEM_ADMIN" as const },
    ...(selectionIsAll ? {} : { departmentId: { in: validDepartmentIds } }),
  });
  const aiActorWhere = selectionIsAll
    ? { is: { role: { not: "SYSTEM_ADMIN" as const } } }
    : { is: { role: { not: "SYSTEM_ADMIN" as const }, departmentId: { in: validDepartmentIds } } };
  const aiEventWhere = (from: Date, to: Date) => ({ ...period(from, to), actor: aiActorWhere });
  const nominationEventWhere = (from: Date, to: Date) => ({
    ...period(from, to),
    action: "SUBMITTED" as const,
    ...(selectionIsAll ? {} : { employeeDepartmentId: { in: validDepartmentIds } }),
  });
  const reviewEventWhere = (from: Date, to: Date) => ({
    ...period(from, to),
    action: "SUBMITTED" as const,
    ...(selectionIsAll ? {} : { employee: { is: { departmentId: { in: validDepartmentIds } } } }),
  });

  const [employees, nominations, reviews, missingReviewMetadata, loginEvents, previousLoginEvents, nominationEvents, previousNominationEvents, reviewEvents, previousReviewEvents, aiEvents, previousAiEvents, aiDecisions] = await Promise.all([
    prisma.employee.findMany({ where: employeeWhere, select: { id: true, gender: true, employmentType: true, departmentId: true, department: { select: { name: true } } } }),
    prisma.nomination.findMany({
      where: { ...cycleWhere, ...(selectionIsAll ? {} : { employee: { departmentId: { in: validDepartmentIds } } }) },
      select: { approvalStatus: true, submissionStatus: true, createdAt: true, employee: { select: { departmentId: true, department: { select: { name: true } } } }, reviewer: { select: { department: { select: { name: true } } } } },
    }),
    prisma.review.findMany({
      where: { ...cycleWhere, ...(selectionIsAll ? {} : { employee: { departmentId: { in: validDepartmentIds } } }) },
      select: { status: true },
    }),
    prisma.review.count({
      where: {
        ...cycleWhere,
        status: "SUBMITTED",
        ...(selectionIsAll ? {} : { employee: { departmentId: { in: validDepartmentIds } } }),
        OR: [
          { doWellComment: null },
          { doWellComment: "" },
          { improveComment: null },
          { improveComment: "" },
        ],
      },
    }),
    prisma.authEvent.findMany({ where: authEventWhere(dateWindow.from, dateWindow.toExclusive), select: { actorId: true, createdAt: true } }),
    prisma.authEvent.findMany({ where: authEventWhere(dateWindow.previousFrom, dateWindow.previousToExclusive), select: { actorId: true, createdAt: true } }),
    prisma.nominationEvent.findMany({ where: nominationEventWhere(dateWindow.from, dateWindow.toExclusive), select: { createdAt: true } }),
    prisma.nominationEvent.findMany({ where: nominationEventWhere(dateWindow.previousFrom, dateWindow.previousToExclusive), select: { createdAt: true } }),
    prisma.reviewEvent.findMany({ where: reviewEventWhere(dateWindow.from, dateWindow.toExclusive), select: { createdAt: true } }),
    prisma.reviewEvent.findMany({ where: reviewEventWhere(dateWindow.previousFrom, dateWindow.previousToExclusive), select: { createdAt: true } }),
    prisma.aiUsageEvent.findMany({ where: aiEventWhere(dateWindow.from, dateWindow.toExclusive), select: { createdAt: true, inputTokens: true, outputTokens: true, status: true, feature: true } }),
    prisma.aiUsageEvent.findMany({ where: aiEventWhere(dateWindow.previousFrom, dateWindow.previousToExclusive), select: { createdAt: true, inputTokens: true, outputTokens: true, status: true, feature: true } }),
    prisma.aiHitlDecision.findMany({ where: aiEventWhere(dateWindow.from, dateWindow.toExclusive), select: { decision: true } }),
  ]);

  const activeUserTrend = aggregateTrend(loginEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain, () => 1, (row) => row.actorId === null ? null : String(row.actorId));
  const previousActiveUserTrend = aggregateTrend(previousLoginEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain, () => 1, (row) => row.actorId === null ? null : String(row.actorId));
  const nominationTrend = aggregateTrend(nominationEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain);
  const previousNominationTrend = aggregateTrend(previousNominationEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain);
  const reviewTrend = aggregateTrend(reviewEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain);
  const previousReviewTrend = aggregateTrend(previousReviewEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain);
  const aiTrend = aggregateTrend(aiEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain);
  const previousAiTrend = aggregateTrend(previousAiEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain);
  const inputTokenTrend = aggregateTrend(aiEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain, (row) => row.inputTokens);
  const previousInputTokenTrend = aggregateTrend(previousAiEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain, (row) => row.inputTokens);
  const outputTokenTrend = aggregateTrend(aiEvents, dateWindow.from, dateWindow.toExclusive, dateWindow.grain, (row) => row.outputTokens);
  const previousOutputTokenTrend = aggregateTrend(previousAiEvents, dateWindow.previousFrom, dateWindow.previousToExclusive, dateWindow.grain, (row) => row.outputTokens);
  const trendLabels = activeUserTrend.map((bucket) => formatTrendLabel(bucket.start, dateWindow.grain));

  const activeUserCount = new Set(loginEvents.map((row) => row.actorId).filter((id): id is number => id !== null)).size;
  const previousActiveUserCount = new Set(previousLoginEvents.map((row) => row.actorId).filter((id): id is number => id !== null)).size;
  const nominationSubmissions = nominationEvents.length;
  const reviewSubmissions = reviewEvents.length;
  const aiCalls = aiEvents.length;
  const previousNominationSubmissions = previousNominationEvents.length;
  const previousReviewSubmissions = previousReviewEvents.length;
  const previousAiCalls = previousAiEvents.length;
  const submittedNominations = nominations.filter((item) => item.submissionStatus === "SUBMITTED");
  const pending = submittedNominations.filter((item) => item.approvalStatus === "PENDING");
  const overdueCutoff = new Date(new Date().getTime() - 7 * 86_400_000);
  const overdue = pending.filter((item) => isOverdueApproval(item, overdueCutoff)).length;
  const approved = submittedNominations.filter((item) => item.approvalStatus === "APPROVED").length;
  const rejected = submittedNominations.filter((item) => item.approvalStatus === "REJECTED").length;
  const submittedReviews = reviews.filter((item) => item.status === "SUBMITTED").length;
  const draftReviews = reviews.filter((item) => item.status === "DRAFT").length;
  const totalInputTokens = aiEvents.reduce((sum, item) => sum + item.inputTokens, 0);
  const totalOutputTokens = aiEvents.reduce((sum, item) => sum + item.outputTokens, 0);
  const aiSuccesses = aiEvents.filter((item) => item.status === "SUCCESS").length;
  const aiErrors = aiEvents.length - aiSuccesses;
  const aiDecisionCounts = {
    ACCEPTED: aiDecisions.filter((item) => item.decision === "ACCEPTED").length,
    EDITED: aiDecisions.filter((item) => item.decision === "EDITED").length,
    DISCARDED: aiDecisions.filter((item) => item.decision === "DISCARDED").length,
  };

  const pendingByDepartment = new Map<string, number>();
  const departmentIdByName = new Map(departments.map((item) => [item.name, item.id]));
  for (const item of pending) {
    const name = item.employee.department.name;
    pendingByDepartment.set(name, (pendingByDepartment.get(name) ?? 0) + 1);
  }
  const departmentCounts = new Map<string, { id: number; count: number }>();
  for (const employee of employees) {
    const row = departmentCounts.get(employee.department.name);
    departmentCounts.set(employee.department.name, { id: employee.departmentId, count: (row?.count ?? 0) + 1 });
  }
  const visiblePendingDepartments = Array.from(pendingByDepartment.entries())
    .filter(([name]) => !shouldSuppressCohort(departmentPopulationCounts.get(departmentIdByName.get(name) ?? -1) ?? 0))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const loginActorIds = new Set(loginEvents.map((row) => row.actorId).filter((id): id is number => id !== null));
  const genderAdoption = new Map<string, { people: number; active: number }>();
  const employmentAdoption = new Map<string, { people: number; active: number }>();
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const activeUsersByDepartment = new Map<number, Set<number>>();
  for (const event of loginEvents) {
    if (event.actorId === null) continue;
    const employee = employeeById.get(event.actorId);
    if (!employee) continue;
    if (!activeUsersByDepartment.has(employee.departmentId)) activeUsersByDepartment.set(employee.departmentId, new Set());
    activeUsersByDepartment.get(employee.departmentId)?.add(event.actorId);
  }
  for (const employee of employees) {
    const gender = ({ WOMAN: "Female", MAN: "Male", NON_BINARY: "Non-binary", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say" } as Record<string, string>)[employee.gender ?? ""] ?? "Not captured";
    const employment = employee.employmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    const isActive = loginActorIds.has(employee.id) ? 1 : 0;
    const genderGroup = genderAdoption.get(gender) ?? { people: 0, active: 0 };
    genderGroup.people += 1;
    genderGroup.active += isActive;
    genderAdoption.set(gender, genderGroup);
    const employmentGroup = employmentAdoption.get(employment) ?? { people: 0, active: 0 };
    employmentGroup.people += 1;
    employmentGroup.active += isActive;
    employmentAdoption.set(employment, employmentGroup);
  }
  const genderAdoptionRows = Array.from(genderAdoption.entries())
    .filter(([, group]) => !shouldSuppressCohort(group.people))
    .map(([label, group]) => ({ label, value: Math.round((group.active / group.people) * 100), displayValue: `${Math.round((group.active / group.people) * 100)}%` }))
    .sort((a, b) => b.value - a.value);
  const employmentAdoptionRows = Array.from(employmentAdoption.entries())
    .filter(([, group]) => !shouldSuppressCohort(group.people))
    .map(([label, group]) => ({ label, value: Math.round((group.active / group.people) * 100), displayValue: `${Math.round((group.active / group.people) * 100)}%` }))
    .sort((a, b) => b.value - a.value);
  const departmentLoginRows = Array.from(departmentCounts.entries())
    .filter(([, group]) => !shouldSuppressCohort(group.count))
    .map(([label, group]) => {
      const active = activeUsersByDepartment.get(group.id)?.size ?? 0;
      const rate = Math.round((active / group.count) * 100);
      return { label, value: rate, displayValue: `${rate}%` };
    })
    .sort((a, b) => b.value - a.value);
  const crossDepartmentCounts = new Map<string, { from: string; to: string; value: number }>();
  for (const nomination of submittedNominations) {
    const from = nomination.employee.department.name;
    const to = nomination.reviewer.department.name;
    if (from === to) continue;
    const key = `${nomination.employee.departmentId}:${to}`;
    const flow = crossDepartmentCounts.get(key);
    if (flow) flow.value += 1;
    else crossDepartmentCounts.set(key, { from, to, value: 1 });
  }
  const crossDepartmentRows = Array.from(crossDepartmentCounts.entries())
    .filter(([, flow]) => {
      const fromId = departmentIdByName.get(flow.from) ?? -1;
      const toId = departmentIdByName.get(flow.to) ?? -1;
      return !shouldSuppressCohort(departmentPopulationCounts.get(fromId) ?? 0)
        && !shouldSuppressCohort(departmentPopulationCounts.get(toId) ?? 0);
    })
    .map(([, flow]) => ({ label: `${flow.from} to ${flow.to}`, value: flow.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const aiFeatures = new Map<string, number>();
  for (const event of aiEvents) {
    const label = event.feature.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    aiFeatures.set(label, (aiFeatures.get(label) ?? 0) + 1);
  }
  const aiFeatureRows = Array.from(aiFeatures.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const tabItems = [
    { id: "overview", label: "Overview" },
    { id: "adoption", label: "Adoption & Engagement" },
    { id: "governance", label: "Governance & Approvals" },
    { id: "ai", label: "AI Usage" },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-[#0f1f3d] p-7 text-white">
        <p className="text-sm font-semibold text-cyan-200">System Administrator</p>
        <h1 className="mt-1 text-2xl font-black">Platform insights</h1>
        <p className="mt-2 max-w-3xl text-sm text-blue-100">
          Monitor platform adoption, workflow health, and AI usage through aggregated operational data.
        </p>
        <p className="mt-4 text-xs font-semibold text-blue-200">
          {dateLabel(dateWindow.from)} – {dateLabel(new Date(dateWindow.toExclusive.getTime() - 1))} · {selectedDepartmentName} · {selectedCycle ? selectedCycle.name : "All cycles"}
        </p>
      </header>

      {invalidCustomRange && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">The custom date range was invalid. Showing the last 30 days.</p>}

      <form action="/system-admin" method="get" className="rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="tab" value={tab} />
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr_auto] xl:items-end">
          <label className="block text-xs font-semibold text-gray-700">
            Date range
            <select name="range" defaultValue={dateWindow.preset} className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <fieldset className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-gray-700">Custom start<input type="date" name="from" defaultValue={dateWindow.from.toISOString().slice(0, 10)} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" /></label>
            <label className="block text-xs font-semibold text-gray-700">Custom end<input type="date" name="to" defaultValue={new Date(dateWindow.toExclusive.getTime() - 86_400_000).toISOString().slice(0, 10)} className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900" /></label>
          </fieldset>
          <label className="block text-xs font-semibold text-gray-700">
            Review cycle
            <select name="cycle" defaultValue={cycleValue} className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900">
              {selectedCycle && <option value={selectedCycle.id}>{selectedCycle.name} · current</option>}
              <option value="all">All cycles</option>
              {cycleList.filter((item) => item.id !== selectedCycle?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-md bg-[#0f1f3d] px-5 text-sm font-semibold text-white hover:bg-[#1b3158]">Apply filters</button>
        </div>
        <details className="mt-4 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray-800">Departments: {selectedDepartmentName}</summary>
          <p className="mt-2 text-xs text-gray-500">Choose one or more departments to focus or compare. Clear all selections to include every department.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {departments.map((department) => (
              <label key={department.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800">
                <input type="checkbox" name="departments" value={department.id} defaultChecked={selectedDepartmentSet.has(department.id)} className="accent-teal-700" />
                {department.name}
              </label>
            ))}
          </div>
        </details>
      </form>

      <nav aria-label="Platform analytics" className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabItems.map((item) => (
          <a key={item.id} href={tabHref(item.id, params, validDepartmentIds, cycleValue)} aria-current={tab === item.id ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? "border-teal-600 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
            {item.label}
          </a>
        ))}
      </nav>

      {selectedDepartmentsSuppressed ? (
        <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-950">Insights hidden for privacy</h2>
          <p className="mt-1 text-sm text-amber-900">One or more selected departments has fewer than 10 active employees. Clear the selection or choose only departments with at least 10 active employees to view aggregated analytics.</p>
        </section>
      ) : <>
      {tab === "overview" && <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active users" value={activeUserCount} sub={compareLabel(activeUserCount, previousActiveUserCount)} />
          <MetricCard label="Nomination submission actions" value={nominationSubmissions} sub={compareLabel(nominationSubmissions, previousNominationSubmissions)} tone="green" />
          <MetricCard label="Reviews submitted" value={reviewSubmissions} sub={compareLabel(reviewSubmissions, previousReviewSubmissions)} tone="purple" />
          <MetricCard label="AI generations" value={aiCalls} sub={compareLabel(aiCalls, previousAiCalls)} tone="amber" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="Platform activity" sub="Activity volume during the selected period; compare relative movement through the KPI cards above.">
            <TrendChart title="Activity trend" description={`Daily/weekly buckets · ${dateWindow.grain === "day" ? "daily" : "weekly"}`} labels={trendLabels} series={[
              { label: "Active users", color: "#0f766e", values: activeUserTrend.map((bucket) => bucket.value) },
              { label: "Nomination submissions", color: "#2563eb", values: nominationTrend.map((bucket) => bucket.value) },
              { label: "Reviews submitted", color: "#c2410c", values: reviewTrend.map((bucket) => bucket.value) },
              { label: "AI generations", color: "#7c3aed", values: aiTrend.map((bucket) => bucket.value) },
            ]} />
          </Section>
          <Section title="Selected cycle snapshot" sub="Operational status for the chosen cycle scope; date filters do not change these current-state counts.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[{ label: "Pending", value: pending.length }, { label: "Overdue 7+ days", value: overdue }, { label: "Approved", value: approved }, { label: "Rejected", value: rejected }].map((item) => <div key={item.label} className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-medium text-gray-600">{item.label}</p><p className="mt-1 text-2xl font-black text-gray-950">{item.value}</p></div>)}
            </div>
          </Section>
          <Section title="Review progress" sub="Submitted and draft review records for the selected cycle scope.">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">Submitted</p><p className="mt-1 text-3xl font-black text-emerald-950">{submittedReviews}</p></div>
              <div className="rounded-lg bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-800">Draft</p><p className="mt-1 text-3xl font-black text-amber-950">{draftReviews}</p></div>
            </div>
          </Section>
        </div>
        <Section title="How to read these metrics" sub="Scope and privacy">
          <p className="text-sm leading-6 text-gray-700">Period KPIs compare the selected date range with the immediately preceding range of equal length. Cycle status cards show the current state of records in the selected cycle scope. Employee and department detail is aggregated; cohorts smaller than 10 employees are suppressed. Review text and scores are not shown.</p>
        </Section>
      </>}

      {tab === "adoption" && <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Active users" value={activeUserCount} sub={compareLabel(activeUserCount, previousActiveUserCount)} />
          <MetricCard label="Nomination submission actions" value={nominationSubmissions} sub={compareLabel(nominationSubmissions, previousNominationSubmissions)} tone="green" />
          <MetricCard label="Reviews submitted" value={reviewSubmissions} sub={compareLabel(reviewSubmissions, previousReviewSubmissions)} tone="purple" />
        </div>
        <Section title="Engagement trends" sub="Selected period compared with the previous equal-length period.">
          <TrendChart title="Activity by week/day" description="Unique active users and submission activity" labels={trendLabels} series={[
            ...trendLines("Active users", "#0f766e", activeUserTrend.map((bucket) => bucket.value), previousActiveUserTrend.map((bucket) => bucket.value)),
            ...trendLines("Nomination submissions", "#2563eb", nominationTrend.map((bucket) => bucket.value), previousNominationTrend.map((bucket) => bucket.value)),
            ...trendLines("Reviews submitted", "#c2410c", reviewTrend.map((bucket) => bucket.value), previousReviewTrend.map((bucket) => bucket.value)),
          ]} />
        </Section>
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="Department employee coverage" sub="Active employee population available for the selected department scope.">
            <HorizontalBarChart title="Login adoption by department" description="Unique users who logged in divided by current active employees" rows={departmentLoginRows} maxValue={100} color="#0f766e" />
            <p className="mt-3 text-xs text-gray-500">Departments with fewer than 10 active employees are hidden.</p>
          </Section>
          <Section title="Gender adoption context" sub="Aggregated workforce segments; no individual employee data is displayed.">
            <HorizontalBarChart title="Login adoption by gender" description="Unique users who logged in divided by active employees in each segment" rows={genderAdoptionRows} maxValue={100} color="#7c3aed" />
            <p className="mt-3 text-xs text-gray-500">Segments with fewer than 10 employees are hidden.</p>
          </Section>
          <Section title="Employment type" sub="Aggregated active employee distribution.">
            <HorizontalBarChart title="Login adoption by employment type" description="Unique users who logged in divided by active employees in each segment" rows={employmentAdoptionRows} maxValue={100} color="#c2410c" />
            <p className="mt-3 text-xs text-gray-500">Segments with fewer than 10 employees are hidden.</p>
          </Section>
          <Section title="Cross-department nominations" sub="Aggregated nomination relationships for the selected cycle scope; department pairs only.">
            <HorizontalBarChart title="Department-to-department flows" description="Nominations across department boundaries" rows={crossDepartmentRows} color="#2563eb" />
          </Section>
          <Section title="Cycle participation" sub="Current nomination and review progress for the selected cycle scope.">
            <CountRows rows={[
              { label: "Nominations submitted", value: submittedNominations.length },
              { label: "Nomination records", value: nominations.length },
              { label: "Reviews submitted", value: submittedReviews },
              { label: "Review records", value: reviews.length },
            ]} empty="No cycle participation data in this scope." />
          </Section>
        </div>
      </>}

      {tab === "governance" && <>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard label="Pending approvals" value={pending.length} sub={`${selectedCycle ? selectedCycle.name : "All cycles"} · current snapshot`} tone="amber" />
          <MetricCard label="Overdue 7+ days" value={overdue} sub="Pending for at least seven days" tone="purple" />
          <MetricCard label="Approved" value={approved} sub="Current state in selected cycle scope" tone="green" />
          <MetricCard label="Rejected" value={rejected} sub="Current state in selected cycle scope" tone="navy" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="Pending workload by department" sub="Grouped by the department of the employee whose nomination is awaiting approval.">
            <HorizontalBarChart title="Pending approvals" description="Current snapshot, grouped by affected employee department" rows={visiblePendingDepartments} color="#d97706" />
            <p className="mt-3 text-xs text-gray-500">Departments with fewer than 10 active employees are suppressed.</p>
          </Section>
          <Section title="Approval status" sub="Current-state nomination totals in the selected cycle scope.">
            <HorizontalBarChart title="Nomination approval status" description="Pending, approved, and rejected" rows={[
              { label: "Pending", value: pending.length },
              { label: "Approved", value: approved },
              { label: "Rejected", value: rejected },
            ]} color="#0f766e" />
          </Section>
          <Section title="Review quality metadata" sub="Operational completeness only. Review comments and scores are excluded.">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-4"><p className="text-xs text-gray-600">Draft reviews</p><p className="mt-1 text-3xl font-black text-gray-950">{draftReviews}</p></div>
              <div className="rounded-lg bg-gray-50 p-4"><p className="text-xs text-gray-600">Submitted with missing comment metadata</p><p className="mt-1 text-3xl font-black text-gray-950">{missingReviewMetadata}</p></div>
            </div>
          </Section>
        </div>
      </>}

      {tab === "ai" && <>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard label="AI generations" value={aiCalls} sub={compareLabel(aiCalls, previousAiCalls)} tone="purple" />
          <MetricCard label="Successful" value={aiSuccesses} sub={`${aiCalls ? Math.round((aiSuccesses / aiCalls) * 100) : 0}% of recorded generations`} tone="green" />
          <MetricCard label="Input tokens" value={totalInputTokens.toLocaleString("en-ZA")} sub="Selected date and department scope" />
          <MetricCard label="Output tokens" value={totalOutputTokens.toLocaleString("en-ZA")} sub="Selected date and department scope" tone="amber" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title="AI generation trend" sub="Calls in the selected period versus the previous equal-length period.">
            <TrendChart title="Generation volume" description="Recorded calls by daily or weekly bucket" labels={trendLabels} series={trendLines("Selected period", "#7c3aed", aiTrend.map((bucket) => bucket.value), previousAiTrend.map((bucket) => bucket.value))} />
          </Section>
          <Section title="Token usage trend" sub="Input and output tokens are separate series; totals depend on provider usage metadata.">
            <TrendChart title="Token volume" description="Current and previous equal-length periods" labels={trendLabels} series={[
              ...trendLines("Input tokens", "#0f766e", inputTokenTrend.map((bucket) => bucket.value), previousInputTokenTrend.map((bucket) => bucket.value)),
              ...trendLines("Output tokens", "#c2410c", outputTokenTrend.map((bucket) => bucket.value), previousOutputTokenTrend.map((bucket) => bucket.value)),
            ]} />
          </Section>
          <Section title="AI feature adoption" sub="Generation calls by feature.">
            <HorizontalBarChart title="Calls by feature" description="Selected date and department scope" rows={aiFeatureRows} color="#7c3aed" />
          </Section>
          <Section title="Human review decisions" sub="Decisions are shown as totals, not as a conversion rate, because they are not yet reliably linked to individual generations.">
            <HorizontalBarChart title="Human review decisions" description="Accepted, edited, or discarded AI output" rows={[
              { label: "Accepted", value: aiDecisionCounts.ACCEPTED },
              { label: "Edited", value: aiDecisionCounts.EDITED },
              { label: "Discarded", value: aiDecisionCounts.DISCARDED },
            ]} color="#0f766e" />
          </Section>
          <Section title="Generation status" sub="Recorded calls in the selected date and department scope.">
            <CountRows rows={[{ label: "Successful", value: aiSuccesses }, { label: "Errors", value: aiErrors }]} empty="No AI calls in this period." />
            <p className="mt-3 text-xs text-gray-500">Usage totals depend on token metadata being returned by the model provider.</p>
          </Section>
        </div>
      </>}
      </>}
    </div>
  );
}
