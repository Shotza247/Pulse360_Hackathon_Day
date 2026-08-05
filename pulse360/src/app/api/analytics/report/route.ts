import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/analytics/report
// Body: { cycleId }
// Returns an AI-generated narrative report as HTML string for review before PDF export
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "HR_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { cycleId } = await req.json();
  if (!cycleId) return NextResponse.json({ error: "cycleId required" }, { status: 400 });

  const cycleRecord = await prisma.reviewCycle.findUnique({ where: { id: Number(cycleId) } });
  if (!cycleRecord) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  const cycle = cycleRecord;

  const [criteria, departments, results] = await Promise.all([
    prisma.pulseCriterion.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.reviewResult.findMany({
      where: { cycleId: Number(cycleId), criterionId: { not: null } },
      include: { employee: { select: { departmentId: true } }, criterion: true },
    }),
  ]);

  // Build dept × criterion averages
  const scoreMap: Record<number, Record<number, number[]>> = {};
  for (const r of results) {
    const dId = r.employee.departmentId;
    const cId = r.criterionId!;
    if (!scoreMap[dId]) scoreMap[dId] = {};
    if (!scoreMap[dId][cId]) scoreMap[dId][cId] = [];
    scoreMap[dId][cId].push(Number(r.avgScore));
  }
  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  const deptSummaries = departments.map((d) => {
    const critAvgs = criteria.map((c) => ({ crit: c.name, avg: avg(scoreMap[d.id]?.[c.id] ?? []) }));
    const overall = avg(critAvgs.flatMap((x) => (x.avg !== null ? [x.avg] : [])));
    return { dept: d.name, critAvgs, overall };
  }).filter((d) => d.overall !== null);

  const orgOverall = avg(deptSummaries.flatMap((d) => (d.overall !== null ? [d.overall] : [])));

  // Build prompt data string
  const summaryText = deptSummaries.map((d) =>
    `${d.dept} (overall: ${d.overall?.toFixed(2)}): ${d.critAvgs.map((c) => `${c.crit}=${c.avg?.toFixed(2) ?? "N/A"}`).join(", ")}`
  ).join("\n");

  const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/\s+/g, "");

  function stubReport() {
    const rows = deptSummaries.map((d) =>
      `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">${d.dept}</td>${criteria.map((c) => {
        const s = d.critAvgs.find((x) => x.crit === c.name)?.avg;
        return `<td style="text-align:center;padding:6px 10px;border:1px solid #e5e7eb">${s?.toFixed(2) ?? "—"}</td>`;
      }).join("")}<td style="text-align:center;font-weight:bold;padding:6px 10px;border:1px solid #e5e7eb">${d.overall?.toFixed(2) ?? "—"}</td></tr>`
    ).join("");

    return `<div style="font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:32px">
<h1 style="font-size:22px;font-weight:700;color:#0f1f3d;margin-bottom:4px">Performance Review Report</h1>
<p style="color:#57606a;font-size:13px;margin-bottom:24px">Cycle: <strong>${cycle.name}</strong> &nbsp;·&nbsp; ${new Date(cycle.startDate).toLocaleDateString()} – ${new Date(cycle.endDate).toLocaleDateString()}&nbsp;·&nbsp; Phase: ${cycle.phase}</p>

<h2 style="font-size:15px;font-weight:600;color:#0f1f3d;margin-bottom:8px">Executive Summary</h2>
<p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:20px">
This review cycle captured 360° peer feedback across all active departments. The organisation achieved an overall average score of <strong>${orgOverall?.toFixed(2) ?? "N/A"}/5.0</strong>. Performance was broadly positive with consistent strengths observed in collaborative competencies. Targeted development opportunities exist in areas rated below 3.0.
</p>

<h2 style="font-size:15px;font-weight:600;color:#0f1f3d;margin-bottom:8px">Department Scorecard</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
<thead><tr style="background:#0f1f3d;color:#fff">
<th style="text-align:left;padding:8px 10px">Department</th>
${criteria.map((c) => `<th style="text-align:center;padding:8px 10px">${c.name}</th>`).join("")}
<th style="text-align:center;padding:8px 10px">Overall</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>

<p style="font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:8px">
⚠️ Demo mode — add OPENAI_API_KEY to enable AI-generated narrative. This report was pre-filled with computed scores.
</p></div>`;
  }

  if (!apiKey || deptSummaries.length === 0) {
    return NextResponse.json({ html: stubReport(), stub: !apiKey });
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `You are an HR analytics specialist. Write a professional 360° performance review report for cycle "${cycle.name}" in clean HTML (no <html>/<body> tags, just inner content starting with a <div>).

Org overall average: ${orgOverall?.toFixed(2)}/5.0
Department breakdowns (criterion averages out of 5):
${summaryText}

The report must include:
1. An executive summary paragraph (highlight top performer, growth opportunities, overall sentiment)
2. A department scorecard HTML table with all departments and criteria (use inline styles, no external CSS)
3. Key insights section: 3 bullet points of org-wide observations
4. Recommendations section: 3 actionable recommendations for HR

Style: professional, concise, data-driven. Use inline CSS only. Colour palette: #0f1f3d (headings), #374151 (body), #e5e7eb (borders). Font: system-ui.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_completion_tokens: 1800,
    });
    const html = completion.choices[0]?.message?.content ?? stubReport();
    return NextResponse.json({ html, stub: false });
  } catch (err) {
    console.error("OpenAI report error:", err);
    return NextResponse.json({ html: stubReport(), stub: true });
  }
}
