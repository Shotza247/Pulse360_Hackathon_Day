import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;
  if (!["HR_ADMIN", "LINE_MANAGER"].includes(user.role)) redirect("/dashboard");

  const managerId = Number(user.id);

  const cycle = await prisma.reviewCycle.findFirst({ where: { phase: { in: ["APPROVE", "NOMINATE"] } } });

  const pendingNominations = cycle
    ? await prisma.nomination.findMany({
        where: {
          cycleId: cycle.id,
          approvalStatus: "PENDING",
          ...(user.role === "LINE_MANAGER" ? { employee: { managerId } } : {}),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } },
          reviewer: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Group by employee
  const byEmployee: Record<number, typeof pendingNominations> = {};
  for (const nom of pendingNominations) {
    if (!byEmployee[nom.employeeId]) byEmployee[nom.employeeId] = [];
    byEmployee[nom.employeeId].push(nom);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nomination Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          {cycle ? `Cycle: ${cycle.name} · Phase: ${cycle.phase}` : "No active cycle in approval phase"}
        </p>
      </div>

      {!cycle || pendingNominations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(byEmployee).map((noms) => {
            const emp = noms[0].employee;
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold">
                    {emp.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
                    <p className="text-sm text-gray-500">{emp.jobTitle ?? emp.department.name}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-400">{noms.length} pending</span>
                </div>
                <div className="space-y-2">
                  {noms.map((nom) => (
                    <div key={nom.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {nom.reviewer.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{nom.reviewer.firstName} {nom.reviewer.lastName}</p>
                          <p className="text-xs text-gray-500">{nom.reviewer.department.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <form action={`/api/approvals/${nom.id}/approve`} method="POST">
                          <button type="submit" className="text-xs font-semibold rounded-lg bg-green-600 text-white px-3 py-1.5 hover:bg-green-700 transition">
                            Approve
                          </button>
                        </form>
                        <form action={`/api/approvals/${nom.id}/reject`} method="POST">
                          <button type="submit" className="text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 hover:bg-red-100 transition">
                            Reject
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
