import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;

  // All roles can access, but HR sees everyone, managers see team, employees see only self
  const isAdmin = user.role === "HR_ADMIN";
  const isManager = user.role === "LINE_MANAGER";
  const userId = Number(user.id);

  const latestCycle = await prisma.reviewCycle.findFirst({
    where: { phase: { in: ["CONSULTATION", "ACCEPT", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!latestCycle) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Results</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No results available yet.</p>
        </div>
      </div>
    );
  }

  const employeeFilter = isAdmin
    ? {}
    : isManager
    ? { employee: { managerId: userId } }
    : { employeeId: userId };

  const results = await prisma.reviewResult.findMany({
    where: { cycleId: latestCycle.id, criterionId: null, ...employeeFilter },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
      },
    },
    orderBy: { avgScore: "desc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? "All Results" : isManager ? "Team Results" : "My Results"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Cycle: <strong>{latestCycle.name}</strong></p>
      </div>

      {results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No results calculated yet for this cycle.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Employee</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Department</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Reviewers</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Overall Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => {
                const score = Number(r.avgScore);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-xs font-bold">
                          {r.employee.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{r.employee.firstName} {r.employee.lastName}</p>
                          <p className="text-xs text-gray-500">{r.employee.jobTitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{r.employee.department.name}</td>
                    <td className="px-5 py-4 text-center text-gray-700">{r.reviewCount}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-block font-bold text-base px-3 py-0.5 rounded-lg ${
                        score >= 4 ? "bg-green-100 text-green-700" :
                        score >= 3 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {score.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
