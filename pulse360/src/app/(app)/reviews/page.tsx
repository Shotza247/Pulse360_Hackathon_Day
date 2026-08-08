import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = Number((session.user as any).id);

  const cycle = await prisma.reviewCycle.findFirst({
    where: { phase: "REVIEW" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const pendingReviews = cycle
    ? await prisma.nomination.findMany({
        where: { cycleId: cycle.id, reviewerId: userId, approvalStatus: "APPROVED" },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } } },
        },
      })
    : [];

  // Get review status for each
  const reviewStatuses = cycle
    ? await prisma.review.findMany({
        where: { cycleId: cycle.id, reviewerId: userId },
        select: { employeeId: true, status: true, id: true },
      })
    : [];

  const statusMap = new Map(reviewStatuses.map((r) => [r.employeeId, r]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Reviews</h1>
        <p className="text-sm text-gray-500 mt-1">
          {cycle ? `Cycle: ${cycle.name}` : "No active review cycle"}
        </p>
      </div>

      {!cycle || pendingReviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {!cycle ? "The review phase has not started yet." : "No reviews assigned to you."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingReviews.map(({ employee }) => {
            const reviewStatus = statusMap.get(employee.id);
            const isSubmitted = reviewStatus?.status === "SUBMITTED";
            return (
              <div key={employee.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center font-bold">
                    {employee.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
                    <p className="text-sm text-gray-500">{employee.jobTitle ?? employee.department.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isSubmitted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {isSubmitted ? "Submitted" : reviewStatus ? "In Progress" : "Not Started"}
                  </span>
                  {!isSubmitted && (
                    <Link href={`/reviews/${employee.id}`}
                      className="text-xs font-semibold rounded-lg bg-[#0f1f3d] text-white px-3 py-1.5 hover:bg-[#1a3160] transition">
                      {reviewStatus ? "Continue →" : "Start →"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
