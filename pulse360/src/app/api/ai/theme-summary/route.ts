import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/ai/theme-summary
// Body: { employeeId, cycleId }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actorId = Number((session.user as any).id);

  const { employeeId, cycleId } = await req.json();
  if (!employeeId || !cycleId) {
    return NextResponse.json({ error: "Missing employeeId or cycleId" }, { status: 400 });
  }

  // Fetch the employee name
  const employee = await prisma.employee.findUnique({
    where: { id: Number(employeeId) },
    select: { firstName: true, lastName: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Fetch all submitted reviews for this employee in this cycle
  const reviews = await prisma.review.findMany({
    where: {
      cycleId: Number(cycleId),
      employeeId: Number(employeeId),
      status: "SUBMITTED",
    },
    select: { doWellComment: true, improveComment: true, attentionComment: true },
  });

  if (reviews.length === 0) {
    return NextResponse.json({ error: "No reviews found for this employee" }, { status: 404 });
  }

  const doWellComments = reviews.map(r => r.doWellComment).filter(Boolean).join("\n- ");
  const improveComments = reviews.map(r => r.improveComment).filter(Boolean).join("\n- ");

  const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/\s+/g, "");

  function stubResponse(logEvent = true) {
    if (logEvent) {
      writeAuditEvent({
        actorId,
        action: "AI_THEME_SUMMARY",
        entityType: "ai_interaction",
        entityId: Number(employeeId),
        metadata: { feature: "theme_summary", cycleId: Number(cycleId), status: "success", stub: true, totalTokens: 0 },
      }).catch(() => {});
    }

    return NextResponse.json({
      strengths: [
        "Demonstrates consistent commitment and reliability across assignments",
        "Collaborates effectively and contributes positively to team dynamics",
        "Shows initiative and takes ownership of deliverables",
      ],
      improvements: [
        "Could strengthen communication clarity in high-stakes situations",
        "Benefit from more proactive stakeholder engagement on complex projects",
        "Developing deeper domain expertise would accelerate impact",
      ],
      sentiment: "Positive — peer reviewers recognise strong core performance with targeted areas for growth.",
      stub: true,
    });
  }

  if (!apiKey) return stubResponse();

  const openai = new OpenAI({ apiKey });

  const prompt = `You are an HR analytics assistant summarising 360° peer feedback for ${employee.firstName} ${employee.lastName}.

"What they do well" comments:
- ${doWellComments || "(none)"}

"Areas to improve" comments:
- ${improveComments || "(none)"}

Identify the top 3 recurring themes in strengths and top 3 in improvement areas. Also provide a one-sentence overall sentiment summary.

Respond ONLY with valid JSON in this exact format:
{
  "strengths": ["theme1", "theme2", "theme3"],
  "improvements": ["theme1", "theme2", "theme3"],
  "sentiment": "..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    await writeAuditEvent({
      actorId,
      action: "AI_THEME_SUMMARY",
      entityType: "ai_interaction",
      entityId: Number(employeeId),
      metadata: {
        feature: "theme_summary",
        cycleId: Number(cycleId),
        status: "success",
        stub: false,
        model: "gpt-4o",
        totalTokens: completion.usage?.total_tokens ?? 0,
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      },
    }).catch(() => {});

    return NextResponse.json({
      strengths: parsed.strengths ?? [],
      improvements: parsed.improvements ?? [],
      sentiment: parsed.sentiment ?? "",
    });
  } catch (err) {
    console.error("OpenAI theme-summary error:", err);
    await writeAuditEvent({
      actorId,
      action: "AI_THEME_SUMMARY",
      entityType: "ai_interaction",
      entityId: Number(employeeId),
      metadata: { feature: "theme_summary", cycleId: Number(cycleId), status: "error", stub: false, totalTokens: 0 },
    }).catch(() => {});
    return stubResponse(false);
  }
}
