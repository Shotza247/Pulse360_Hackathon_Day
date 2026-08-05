#!/usr/bin/env node
/**
 * Pulse360 MCP Server
 *
 * Tools:
 *   write_csv          — Writes a self-improvement plan to a CSV file on disk.
 *                        Called only after the user has reviewed and approved the plan.
 *   generate_pdf_report — Writes an approved HTML report to disk as an .html file ready
 *                         for browser print-to-PDF. Called only after human review.
 *
 * Both tools are human-in-the-loop: the Next.js app shows the AI draft first; these
 * tools are invoked only after the user explicitly approves/edits the content.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
const server = new McpServer({ name: "pulse360-mcp", version: "0.1.0" });
// ── Tool 1: write_csv ─────────────────────────────────────────────────────────
server.registerTool("write_csv", {
    description: "Writes a self-improvement plan as a CSV file to the user's downloads or a specified path. " +
        "Invoke ONLY after the user has reviewed and approved the improvement plan in the Pulse360 UI.",
    inputSchema: z.object({
        outputPath: z
            .string()
            .describe("Absolute file path where the CSV should be written, e.g. C:/Users/romeo/Downloads/improvement-plan.csv"),
        employeeName: z.string().describe("Full name of the employee this plan belongs to"),
        cycleName: z.string().describe("Name of the review cycle"),
        plan: z
            .array(z.object({
            criterion: z.string(),
            peerScore: z.number(),
            selfScore: z.number().nullable(),
            gap: z.number().nullable(),
            gapLabel: z.string(),
            weeklyAction: z.string(),
            monthlyGoal: z.string(),
            successMetric: z.string(),
        }))
            .describe("The approved improvement plan rows"),
    }),
}, async ({ outputPath, employeeName, cycleName, plan }) => {
    try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const header = [
            "Employee",
            "Cycle",
            "Criterion",
            "Peer Score",
            "Self Score",
            "Gap",
            "Gap Label",
            "Weekly Action",
            "Monthly Goal",
            "Success Metric",
        ];
        const escape = (v) => {
            if (v === null || v === undefined)
                return "";
            const s = String(v);
            return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const rows = plan.map((row) => [
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
        ].join(","));
        const csv = [header.join(","), ...rows].join("\n");
        fs.writeFileSync(outputPath, csv, "utf-8");
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Self-improvement plan written to:\n${outputPath}\n\nRows: ${plan.length} criteria\nEmployee: ${employeeName}\nCycle: ${cycleName}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to write CSV: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});
// ── Tool 2: generate_pdf_report ───────────────────────────────────────────────
server.registerTool("generate_pdf_report", {
    description: "Saves an approved HTML performance report to disk as an .html file. The user can open it " +
        "in a browser and use Print → Save as PDF. Invoke ONLY after the user has reviewed and " +
        "optionally edited the report content in the Pulse360 UI.",
    inputSchema: z.object({
        outputPath: z
            .string()
            .describe("Absolute file path where the HTML report should be written, e.g. C:/Users/romeo/Downloads/report.html"),
        htmlContent: z.string().describe("The full approved HTML report content (as reviewed by the user)"),
        reportTitle: z.string().describe("Title for the report, used in the <title> tag"),
    }),
}, async ({ outputPath, htmlContent, reportTitle }) => {
    try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle.replace(/</g, "&lt;")}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #1f2328; background: #fff; }
  </style>
</head>
<body>
<div class="no-print" style="background:#0f1f3d;color:#fff;padding:10px 20px;font-size:13px">
  📄 Pulse360 Report — <strong>${reportTitle.replace(/</g, "&lt;")}</strong> &nbsp;·&nbsp;
  <a href="javascript:window.print()" style="color:#93c5fd;text-decoration:underline">Print / Save as PDF</a>
</div>
${htmlContent}
<div style="border-top:1px solid #e5e7eb;padding:12px 20px;margin-top:24px;font-size:11px;color:#9ca3af;text-align:center">
  Generated by Pulse360 · Human-reviewed before export
</div>
</body>
</html>`;
        fs.writeFileSync(outputPath, fullHtml, "utf-8");
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Report saved to:\n${outputPath}\n\nOpen in a browser and use File → Print → Save as PDF to generate the PDF.\nReport: ${reportTitle}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to write report: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});
// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Pulse360 MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
