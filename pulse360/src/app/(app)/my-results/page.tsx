import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AISummaryPanel } from "@/components/AISummaryPanel";

export const dynamic = "force-dynamic";

export default async function MyResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = Number((session.user as any).id);

  // Employees can only see results once cycle reaches ACCEPT or later
  const cycles = await prisma.reviewCycle.findMany({
    where: { phase: { in: ["ACCEPT", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
  });

  // Check if stuck in CONSULTATION (manager hasn't released yet)
  const consultationCycle = await prisma.reviewCycle.findFirst({
    where: { phase: "CONSULTATION" },
    orderBy: { createdAt: "desc" },
  });

  if (cycles.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">My Results</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {consultationCycle ? (
            <>
              <p className="text-3xl mb-3">🔒</p>
              <p className="text-gray-700 text-sm font-semibold mb-1">Results are being reviewed by your manager</p>
              <p className="text-gray-400 text-xs">Your results will be available once HR releases them.</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Results are not available yet. Please wait for the cycle to reach the results phase.</p>
          )}
        </div>
      </div>
    );
  }

  const cycle = cycles[0];

  const results = await prisma.reviewResult.findMany({
    where: { cycleId: cycle.id, employeeId: userId },
    include: { criterion: true },
    orderBy: { criterion: { sortOrder: "asc" } },
  });

  const reviews = await prisma.review.findMany({
    where: { cycleId: cycle.id, employeeId: userId, status: "SUBMITTED" },
    select: { doWellComment: true, improveComment: true, attentionComment: true },
  });

  const overallResult = results.find((r) => r.criterionId === null);
  const criterionResults = results.filter((r) => r.criterionId !== null);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
        <p className="text-sm text-gray-500 mt-1">Cycle: <strong>{cycle.name}</strong></p>
      </div>

      {results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No results calculated yet for this cycle.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall score */}
          {overallResult && (
            <div className="bg-[#0f1f3d] rounded-xl p-6 text-white">
              <p className="text-sm text-blue-200 mb-1">Overall Score</p>
              <div className="text-5xl font-black">{Number(overallResult.avgScore).toFixed(2)}</div>
              <p className="text-blue-200 text-sm mt-1">Based on {overallResult.reviewCount} reviews · Scale 1–5</p>
            </div>
          )}

          {/* Per-criterion breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Score by Criterion</h2>
            <div className="space-y-4">
              {criterionResults.map((r) => {
                const score = Number(r.avgScore);
                const pct = (score / 5) * 100;
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-gray-800">{r.criterion?.name}</span>
                      <span className="font-bold text-gray-900">{score.toFixed(2)}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0f1f3d] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Theme Summary */}
          <AISummaryPanel
            employeeId={userId}
            cycleId={cycle.id}
            employeeName="you"
          />

          {/* Anonymous comments */}
          {reviews.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Feedback Comments (anonymised)</h2>
              <div className="space-y-5">
                {reviews.some(r => r.doWellComment) && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">What you do well</p>
                    <ul className="space-y-2">
                      {reviews.filter(r => r.doWellComment).map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 bg-green-50 rounded-lg px-4 py-3 border-l-2 border-green-400">
                          {r.doWellComment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {reviews.some(r => r.improveComment) && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Areas to improve</p>
                    <ul className="space-y-2">
                      {reviews.filter(r => r.improveComment).map((r, i) => (
                        <li key={i} className="text-sm text-gray-700 bg-amber-50 rounded-lg px-4 py-3 border-l-2 border-amber-400">
                          {r.improveComment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
