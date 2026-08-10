import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; role?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userSession = session?.user as any;
  if (!session || userSession?.role !== "HR_ADMIN") redirect("/dashboard");

  const params     = await searchParams;
  const q          = params.q    ?? "";
  const deptFilter = params.dept ?? "";
  const roleFilter = params.role ?? "";
  const page       = Number(params.page ?? "1");
  const pageSize   = 20;

  const [employees, total, departments] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isActive: true,
        role: { not: "SYSTEM_ADMIN" },
        ...(q ? { OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
          { email:     { contains: q, mode: "insensitive" } },
          { jobTitle:  { contains: q, mode: "insensitive" } },
        ]} : {}),
        ...(deptFilter ? { department: { name: deptFilter } } : {}),
        ...(roleFilter ? { role: roleFilter as any } : {}),
      },
      include: { department: true, manager: { select: { firstName: true, lastName: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where: { isActive: true, role: { not: "SYSTEM_ADMIN" } } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const ROLE_BADGE: Record<string, string> = {
    HR_ADMIN:     "bg-amber-100 text-amber-800",
    LINE_MANAGER: "bg-blue-100 text-blue-800",
    EMPLOYEE:     "bg-green-100 text-green-800",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">{total} active employees</p>
        </div>
        <Link href="/employees/new" className="inline-flex items-center gap-2 rounded-lg bg-[#0f1f3d] text-white text-sm font-medium px-4 py-2.5 hover:bg-[#1a3160] transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Add Employee
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <input name="q" defaultValue={q} placeholder="Search name, email, title…"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20 w-64"/>
        <select name="dept" defaultValue={deptFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select name="role" defaultValue={roleFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20">
          <option value="">All Roles</option>
          <option value="HR_ADMIN">HR Admin</option>
          <option value="LINE_MANAGER">Line Manager</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <button type="submit" className="rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 transition">Filter</button>
        <Link href="/employees" className="rounded-lg text-gray-500 hover:text-gray-800 text-sm px-3 py-2">Clear</Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Manager</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0f1f3d] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {emp.firstName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{emp.department.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${ROLE_BADGE[emp.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {emp.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{emp.jobGrade ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/employees/${emp.id}`} className="text-xs font-medium text-[#0f1f3d] hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No employees found.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/employees?page=${page - 1}&q=${q}&dept=${deptFilter}&role=${roleFilter}`}
                  className="text-xs text-[#0f1f3d] hover:underline font-medium">← Prev</Link>
              )}
              {page < totalPages && (
                <Link href={`/employees?page=${page + 1}&q=${q}&dept=${deptFilter}&role=${roleFilter}`}
                  className="text-xs text-[#0f1f3d] hover:underline font-medium">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
