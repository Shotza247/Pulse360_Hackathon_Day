import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// POST /api/mcp/write-csv
// Writes an approved self-improvement plan to a CSV file.
// This is the server-side implementation of the MCP write_csv tool.
// Invoked ONLY after the user has reviewed and approved the plan (human-in-the-loop).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outputPath, employeeName, cycleName, plan } = await req.json();
  if (!outputPath || !employeeName || !plan?.length) {
    return NextResponse.json({ error: "outputPath, employeeName, and plan required" }, { status: 400 });
  }

  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const escape = (v: string | number | null | undefined): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = [
      "Employee", "Cycle", "Criterion",
      "Peer Score", "Self Score", "Gap", "Gap Label",
      "Weekly Action", "Monthly Goal", "Success Metric",
    ];

    const rows = (plan as any[]).map((row) =>
      [
        escape(employeeName),
        escape(cycleName),
        escape(row.criterion),
        escape(row.peerScore),
        escape(row.selfScore),
        escape(row.gap),
        escape(row.gapLabel),
        escape(row.weeklyAction),
        escape(row.monthlyGoal),
        escape(row.successMetric),
      ].join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    fs.writeFileSync(outputPath, csv, "utf-8");

    return NextResponse.json({ ok: true, path: outputPath, rows: plan.length });
  } catch (err) {
    console.error("write-csv error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
