import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/ai/suggest-comments
// Body: { employeeName, criteriaRatings: [{ criterionName, avgRating }] }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { employeeName, criteriaRatings } = await req.json();

  if (!employeeName || !criteriaRatings?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/\s+/g, "");

  function stubResponse() {
    return NextResponse.json({
      doWell: `${employeeName} consistently demonstrates strong performance across key competencies. Their dedication and collaborative spirit stand out noticeably to the team.`,
      improve: `${employeeName} could benefit from focusing on areas rated below 3. Building more targeted development goals around these areas would support continued growth.`,
      stub: true,
    });
  }

  if (!apiKey) return stubResponse();

  const openai = new OpenAI({ apiKey });

  const ratingSummary = criteriaRatings
    .map((c: { criterionName: string; avgRating: number }) =>
      `- ${c.criterionName}: ${c.avgRating}/5`
    )
    .join("\n");

  const prompt = `You are an HR performance review assistant. Based on the following 360° peer ratings for ${employeeName}, write two concise, constructive, and professional feedback comments (each 1–2 sentences, minimum 25 words).

Ratings given:
${ratingSummary}

Respond ONLY with valid JSON in this exact format:
{
  "doWell": "...",
  "improve": "..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json({
      doWell: parsed.doWell ?? "",
      improve: parsed.improve ?? "",
    });
  } catch (err) {
    console.error("OpenAI suggest-comments error:", err);
    return stubResponse();
  }
}
