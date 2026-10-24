export type AnalyticsRange = "7d" | "30d" | "90d" | "custom";
export type AnalyticsGrain = "day" | "week";
export type DashboardTab = "overview" | "adoption" | "governance" | "ai";
export type DepartmentSelection = { mode: "all"; ids: [] } | { mode: "selected"; ids: number[] };

export type DateWindow = {
  preset: AnalyticsRange;
  from: Date;
  toExclusive: Date;
  previousFrom: Date;
  previousToExclusive: Date;
  durationDays: number;
  grain: AnalyticsGrain;
};

export type TrendBucket = { start: Date; value: number };
export type MetricComparison = { current: number; previous: number; delta: number; percentChange: number | null };

type QueryValue = string | string[] | undefined;

export function parseDashboardTab(value: QueryValue): DashboardTab {
  const tab = firstValue(value);
  return tab === "adoption" || tab === "governance" || tab === "ai" ? tab : "overview";
}

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function parseDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  const parsed = new Date(timestamp);
  return parsed.toISOString().slice(0, 10) === value ? timestamp : null;
}

export function resolveDateWindow(
  query: { range?: QueryValue; from?: QueryValue; to?: QueryValue },
  now = new Date(),
): DateWindow {
  const requestedRange = firstValue(query.range);
  const preset: AnalyticsRange = requestedRange === "7d" || requestedRange === "90d" || requestedRange === "custom"
    ? requestedRange
    : "30d";

  let fromTimestamp: number;
  let toExclusiveTimestamp: number;

  if (preset === "custom") {
    const fromDate = parseDate(firstValue(query.from));
    const toDate = parseDate(firstValue(query.to));
    if (fromDate === null || toDate === null || toDate < fromDate) {
      throw new RangeError("Custom date range must contain valid dates with the start on or before the end.");
    }
    fromTimestamp = fromDate;
    toExclusiveTimestamp = toDate + 86_400_000;
  } else {
    const durationDays = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    toExclusiveTimestamp = utcDay(now) + 86_400_000;
    fromTimestamp = toExclusiveTimestamp - durationDays * 86_400_000;
  }

  const durationDays = (toExclusiveTimestamp - fromTimestamp) / 86_400_000;
  const previousFromTimestamp = fromTimestamp - durationDays * 86_400_000;
  const grain: AnalyticsGrain = preset === "7d" || (preset === "custom" && durationDays <= 14) ? "day" : "week";

  return {
    preset,
    from: new Date(fromTimestamp),
    toExclusive: new Date(toExclusiveTimestamp),
    previousFrom: new Date(previousFromTimestamp),
    previousToExclusive: new Date(fromTimestamp),
    durationDays,
    grain,
  };
}

export function parseDepartmentSelection(value: QueryValue): DepartmentSelection {
  const rawValues = (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((part) => part.split(","))
    .map((part) => part.trim());

  if (rawValues.length === 0 || rawValues.some((part) => part.toLowerCase() === "all")) {
    return { mode: "all", ids: [] };
  }

  const ids = Array.from(new Set(rawValues
    .map((part) => Number(part))
    .filter((id) => Number.isSafeInteger(id) && id > 0)));

  return ids.length > 0 ? { mode: "selected", ids } : { mode: "all", ids: [] };
}

export function shouldSuppressCohort(employeeCount: number) {
  return !Number.isFinite(employeeCount) || employeeCount < 10;
}

export function shouldSuppressSelectedDepartments(populations: number[]) {
  return populations.some(shouldSuppressCohort);
}

export function isOverdueApproval(
  nomination: { submissionStatus: string; approvalStatus: string; createdAt: Date },
  cutoff: Date,
) {
  return nomination.submissionStatus === "SUBMITTED"
    && nomination.approvalStatus === "PENDING"
    && nomination.createdAt.getTime() <= cutoff.getTime();
}

export function aggregateTrend<T extends { createdAt: Date }>(
  events: T[],
  from: Date,
  toExclusive: Date,
  grain: AnalyticsGrain,
  valueFor: (event: T) => number = () => 1,
  uniqueKeyFor?: (event: T) => string | null,
): TrendBucket[] {
  const bucketDays = grain === "day" ? 1 : 7;
  const bucketMilliseconds = bucketDays * 86_400_000;
  const durationMilliseconds = toExclusive.getTime() - from.getTime();
  if (durationMilliseconds <= 0) return [];

  const bucketCount = Math.ceil(durationMilliseconds / bucketMilliseconds);
  const values = Array.from({ length: bucketCount }, () => 0);
  const uniqueValues = uniqueKeyFor ? Array.from({ length: bucketCount }, () => new Set<string>()) : null;

  for (const event of events) {
    const timestamp = event.createdAt.getTime();
    if (!Number.isFinite(timestamp) || timestamp < from.getTime() || timestamp >= toExclusive.getTime()) continue;
    const index = Math.floor((timestamp - from.getTime()) / bucketMilliseconds);

    if (uniqueValues && uniqueKeyFor) {
      const key = uniqueKeyFor(event);
      if (key) uniqueValues[index].add(key);
    } else {
      const value = valueFor(event);
      if (Number.isFinite(value)) values[index] += value;
    }
  }

  return values.map((_, index) => ({
    start: new Date(from.getTime() + index * bucketMilliseconds),
    value: uniqueValues ? uniqueValues[index].size : values[index],
  }));
}

export function compareMetric(current: number, previous: number): MetricComparison {
  const delta = current - previous;
  return {
    current,
    previous,
    delta,
    percentChange: previous === 0 ? null : Math.round((delta / previous) * 100),
  };
}

export function formatTrendLabel(start: Date, grain: AnalyticsGrain) {
  const format = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" });
  if (grain === "day") return format.format(start);

  const end = new Date(start.getTime() + 6 * 86_400_000);
  const startParts = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" }).formatToParts(start);
  const endParts = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" }).formatToParts(end);
  const part = (parts: Intl.DateTimeFormatPart[], type: "day" | "month") => parts.find((item) => item.type === type)?.value ?? "";
  const startDay = part(startParts, "day");
  const startMonth = part(startParts, "month");
  const endDay = part(endParts, "day");
  const endMonth = part(endParts, "month");
  return startMonth === endMonth ? `${startDay}-${endDay} ${startMonth}` : `${startDay} ${startMonth}-${endDay} ${endMonth}`;
}

export function scaleTrendSeries(series: number[][], width: number, height: number) {
  const maxValue = Math.max(1, ...series.flat().filter(Number.isFinite));
  const pointCount = Math.max(0, ...series.map((values) => values.length));
  const points = series.map((values) => values.map((value, index) => ({
    x: pointCount <= 1 ? width / 2 : (index / (pointCount - 1)) * width,
    y: height - (Math.max(0, Number.isFinite(value) ? value : 0) / maxValue) * height,
  })));
  return { maxValue, points };
}
