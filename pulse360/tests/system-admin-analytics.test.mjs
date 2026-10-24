import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDepartmentSelection,
  parseDashboardTab,
  aggregateTrend,
  compareMetric,
  formatTrendLabel,
  isOverdueApproval,
  resolveDateWindow,
  scaleTrendSeries,
  shouldSuppressCohort,
  shouldSuppressSelectedDepartments,
} from "../src/lib/system-admin-analytics.ts";

const fixedNow = new Date("2026-10-24T12:30:00.000Z");

test("defaults to a 30-day weekly window with an equal previous period", () => {
  const window = resolveDateWindow({}, fixedNow);

  assert.equal(window.preset, "30d");
  assert.equal(window.grain, "week");
  assert.equal(window.from.toISOString(), "2026-09-25T00:00:00.000Z");
  assert.equal(window.toExclusive.toISOString(), "2026-10-25T00:00:00.000Z");
  assert.equal(window.previousFrom.toISOString(), "2026-08-26T00:00:00.000Z");
  assert.equal(window.previousToExclusive.toISOString(), window.from.toISOString());
});

test("uses daily buckets for seven-day presets", () => {
  const window = resolveDateWindow({ range: "7d" }, fixedNow);

  assert.equal(window.grain, "day");
  assert.equal(window.from.toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(window.previousFrom.toISOString(), "2026-10-11T00:00:00.000Z");
});

test("custom ranges use daily grain through 14 days and weekly after", () => {
  const short = resolveDateWindow({ range: "custom", from: "2026-10-01", to: "2026-10-14" }, fixedNow);
  const long = resolveDateWindow({ range: "custom", from: "2026-09-01", to: "2026-09-15" }, fixedNow);

  assert.equal(short.grain, "day");
  assert.equal(long.grain, "week");
  assert.equal(short.previousFrom.toISOString(), "2026-09-17T00:00:00.000Z");
  assert.equal(long.previousToExclusive.toISOString(), long.from.toISOString());
});

test("rejects malformed and reversed custom date ranges", () => {
  assert.throws(() => resolveDateWindow({ range: "custom", from: "not-a-date", to: "2026-10-14" }, fixedNow), RangeError);
  assert.throws(() => resolveDateWindow({ range: "custom", from: "2026-10-15", to: "2026-10-14" }, fixedNow), RangeError);
});

test("parses and deduplicates selected departments, with all as the default", () => {
  assert.deepEqual(parseDepartmentSelection(undefined), { mode: "all", ids: [] });
  assert.deepEqual(parseDepartmentSelection(["4", "6", "4"]), { mode: "selected", ids: [4, 6] });
  assert.deepEqual(parseDepartmentSelection(["all", "4"]), { mode: "all", ids: [] });
  assert.deepEqual(parseDepartmentSelection(["-1", "abc", "0"]), { mode: "all", ids: [] });
});

test("suppresses cohorts below ten people", () => {
  assert.equal(shouldSuppressCohort(9), true);
  assert.equal(shouldSuppressCohort(10), false);
  assert.equal(shouldSuppressCohort(0), true);
});

test("suppresses a selected department comparison if any selected cohort is below ten", () => {
  assert.equal(shouldSuppressSelectedDepartments([]), false);
  assert.equal(shouldSuppressSelectedDepartments([10, 24]), false);
  assert.equal(shouldSuppressSelectedDepartments([10, 9]), true);
});

test("marks only submitted pending nominations at least seven days old as overdue", () => {
  const cutoff = new Date("2026-10-17T00:00:00.000Z");
  const pendingAtCutoff = { submissionStatus: "SUBMITTED", approvalStatus: "PENDING", createdAt: cutoff };
  assert.equal(isOverdueApproval(pendingAtCutoff, cutoff), true);
  assert.equal(isOverdueApproval({ ...pendingAtCutoff, createdAt: new Date(cutoff.getTime() + 1) }, cutoff), false);
  assert.equal(isOverdueApproval({ ...pendingAtCutoff, submissionStatus: "DRAFT" }, cutoff), false);
  assert.equal(isOverdueApproval({ ...pendingAtCutoff, approvalStatus: "APPROVED" }, cutoff), false);
});

test("accepts known dashboard tabs and falls back safely to overview", () => {
  assert.equal(parseDashboardTab("adoption"), "adoption");
  assert.equal(parseDashboardTab("governance"), "governance");
  assert.equal(parseDashboardTab("ai"), "ai");
  assert.equal(parseDashboardTab("unexpected"), "overview");
});

test("aggregates event values into inclusive-start, exclusive-end daily buckets", () => {
  const window = resolveDateWindow({ range: "7d" }, fixedNow);
  const events = [
    { createdAt: new Date("2026-10-18T00:00:00.000Z"), value: 2 },
    { createdAt: new Date("2026-10-18T23:59:59.000Z"), value: 3 },
    { createdAt: new Date("2026-10-19T10:00:00.000Z"), value: 4 },
    { createdAt: window.toExclusive, value: 99 },
  ];

  const buckets = aggregateTrend(events, window.from, window.toExclusive, "day", (event) => event.value);

  assert.equal(buckets.length, 7);
  assert.deepEqual(buckets.slice(0, 2).map((bucket) => bucket.value), [5, 4]);
  assert.equal(buckets.reduce((total, bucket) => total + bucket.value, 0), 9);
});

test("weekly buckets start at the selected range start and deduplicate actors", () => {
  const window = resolveDateWindow({ range: "30d" }, fixedNow);
  const events = [0, 0, 6, 7, 29].map((offset, index) => ({
    createdAt: new Date(window.from.getTime() + offset * 86_400_000),
    actor: index < 2 ? "employee-a" : `employee-${index}`,
  }));

  const buckets = aggregateTrend(events, window.from, window.toExclusive, "week", () => 1, (event) => event.actor);

  assert.equal(buckets.length, 5);
  assert.deepEqual(buckets.map((bucket) => bucket.value), [2, 1, 0, 0, 1]);
});

test("compares equal periods and avoids a percent when the previous value is zero", () => {
  assert.deepEqual(compareMetric(120, 100), { current: 120, previous: 100, delta: 20, percentChange: 20 });
  assert.deepEqual(compareMetric(4, 0), { current: 4, previous: 0, delta: 4, percentChange: null });
});

test("formats daily and weekly trend labels consistently in UTC", () => {
  assert.equal(formatTrendLabel(new Date("2026-10-18T00:00:00.000Z"), "day"), "18 Oct");
  assert.equal(formatTrendLabel(new Date("2026-10-18T00:00:00.000Z"), "week"), "18-24 Oct");
});

test("scales all chart series against one shared axis and handles zero-only values", () => {
  const scaled = scaleTrendSeries([[0, 5], [10, 0]], 100, 50);
  assert.equal(scaled.maxValue, 10);
  assert.deepEqual(scaled.points, [
    [{ x: 0, y: 50 }, { x: 100, y: 25 }],
    [{ x: 0, y: 0 }, { x: 100, y: 50 }],
  ]);
  assert.deepEqual(scaleTrendSeries([[0, 0]], 100, 50).points, [[{ x: 0, y: 50 }, { x: 100, y: 50 }]]);
});
