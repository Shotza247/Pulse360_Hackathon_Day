import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/ai/improvement-plan
// Body: { cycleId, selfRatings: { criterionId: number, selfScore: number }[] }
// Compares peer scores vs self-scores, identifies gaps, generates a structured improvement plan
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as any).id);

  const { cycleId, selfRatings } = await req.json();
  if (!cycleId || !selfRatings?.length) {
    return NextResponse.json({ error: "cycleId and selfRatings required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, jobTitle: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Fetch peer results for this cycle
  const peerResults = await prisma.reviewResult.findMany({
    where: { cycleId: Number(cycleId), employeeId: userId, criterionId: { not: null } },
    include: { criterion: true },
  });

  if (peerResults.length === 0) {
    return NextResponse.json({ error: "No peer results found for this cycle" }, { status: 404 });
  }

  // Build gap analysis
  const gaps = peerResults.map((r) => {
    const selfEntry = (selfRatings as { criterionId: number; selfScore: number }[])
      .find((s) => s.criterionId === r.criterionId);
    const peerScore = Number(r.avgScore);
    const selfScore = selfEntry?.selfScore ?? null;
    const gap = selfScore !== null ? Math.round((selfScore - peerScore) * 100) / 100 : null;
    return {
      criterion: r.criterion?.name ?? "Unknown",
      criterionId: r.criterionId,
      peerScore,
      selfScore,
      gap, // positive = overrating, negative = underrating
      reviewCount: r.reviewCount,
    };
  });

  const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/\s+/g, "");

  const empName = `${employee!.firstName} ${employee!.lastName}`;
  const empTitle = employee!.jobTitle ?? "employee";

  function stubPlan() {
    const plan = gaps.map((g) => ({
      criterion: g.criterion,
      peerScore: g.peerScore,
      selfScore: g.selfScore,
      gap: g.gap,
      gapLabel: g.gap === null ? "N/A" : g.gap > 0.5 ? "Overrating" : g.gap < -0.5 ? "Underrating" : "Aligned",
      weeklyAction: `Review feedback for ${g.criterion}. Identify one specific behaviour to improve or maintain. Set a weekly check-in goal.`,
      monthlyGoal: `Complete one learning resource related to ${g.criterion}. Discuss progress with your manager.`,
      successMetric: `Peer score for ${g.criterion} improves by 0.3+ in the next cycle.`,
    }));
    return NextResponse.json({
      employeeName: empName,
      cycleName: "Current Cycle",
      gaps,
      plan,
      narrative: `${employee!.firstName}, your self-assessment shows some alignment with peer feedback. Focus on the areas with the largest gaps between your self-rating and peer scores. Consistent small improvements in daily behaviours compound into significant growth over a review cycle.`,
      stub: true,
    });
  }

  if (!apiKey) return stubPlan();

  const openai = new OpenAI({ apiKey });

  const gapSummary = gaps.map((g) =>
    `${g.criterion}: peer=${g.peerScore.toFixed(2)}, self=${g.selfScore?.toFixed(2) ?? "not rated"}, gap=${g.gap?.toFixed(2) ?? "N/A"}`
  ).join("\n");

  const prompt = `You are an executive coach helping ${empName} (${empTitle}) build a personalised self-improvement plan based on their 360° peer review results and self-assessment.

Gap analysis (peer score vs self-score, gap = self - peer):
${gapSummary}

For each criterion, provide:
1. A brief interpretation of the gap
2. One concrete weekly action (specific, behavioural, achievable in 1 week)
3. One monthly goal (skill-building or relationship-focused)
4. A measurable success metric for the next review cycle

Also write a 2-sentence motivational narrative personalised to ${employee!.firstName}.

Respond ONLY with valid JSON:
{
  "narrative": "...",
  "plan": [
    {
      "criterion": "...",
      "gapLabel": "Overrating|Underrating|Aligned",
      "weeklyAction": "...",
      "monthlyGoal": "...",
      "successMetric": "..."
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const cycle = await prisma.reviewCycle.findUnique({ where: { id: Number(cycleId) }, select: { name: true } });
    return NextResponse.json({
      employeeName: `${employee.firstName} ${employee.lastName}`,
      cycleName: cycle?.name ?? "",
      gaps,
      plan: parsed.plan ?? [],
      narrative: parsed.narrative ?? "",
      stub: false,
    });
  } catch (err) {
    console.error("OpenAI improvement-plan error:", err);
    return stubPlan();
  }
}
