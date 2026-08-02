import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CycleList } from "@/components/CycleList";

export const dynamic = "force-dynamic";

export default async function CyclesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as any;
  if (user.role !== "HR_ADMIN") redirect("/dashboard");

  const cycles = await prisma.reviewCycle.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Cycles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage semi-annual performance review cycles</p>
        </div>
        <Link href="/cycles/new"
          className="rounded-lg bg-[#0f1f3d] text-white text-sm font-semibold px-4 py-2.5 hover:bg-[#1a3160] transition">
          + New Cycle
        </Link>
      </div>

      {cycles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No review cycles yet</p>
          <Link href="/cycles/new"
            className="rounded-lg bg-[#0f1f3d] text-white text-sm font-semibold px-4 py-2 hover:bg-[#1a3160] transition">
            Create first cycle
          </Link>
        </div>
      ) : (
        <CycleList initialCycles={cycles as any} />
      )}
    </div>
  );
}
