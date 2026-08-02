"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EmployeeFormPage() {
  const router = useRouter();
  const params = useParams();
  const isEdit = !!params?.id && params.id !== "new";
  const employeeId = isEdit ? Number(params.id) : null;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [dRes, mRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/employees/managers"),
      ]);
      if (dRes.ok) setDepartments(await dRes.json());
      if (mRes.ok) setManagers(await mRes.json());

      if (isEdit && employeeId) {
        const eRes = await fetch(`/api/employees/${employeeId}`);
        if (eRes.ok) {
          const emp = await eRes.json();
          setFirstName(emp.firstName ?? ""); setLastName(emp.lastName ?? "");
          setEmail(emp.email ?? ""); setJobTitle(emp.jobTitle ?? "");
          setRole(emp.role ?? "EMPLOYEE"); setDepartmentId(String(emp.departmentId ?? ""));
          setManagerId(String(emp.managerId ?? "")); setIsActive(emp.isActive ?? true);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const body = {
      firstName, lastName, email, jobTitle, role,
      departmentId: Number(departmentId),
      managerId: managerId ? Number(managerId) : null,
      isActive,
    };
    const url = isEdit ? `/api/employees/${employeeId}` : "/api/employees";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Save failed"); setSaving(false); return; }
    router.push("/employees");
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? "Edit Employee" : "Add Employee"}</h1>
        <p className="text-sm text-gray-500 mt-1">{isEdit ? "Update employee details" : "Create a new employee account"}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name *</label>
              <input required value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name *</label>
              <input required value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20">
                <option value="EMPLOYEE">Employee</option>
                <option value="LINE_MANAGER">Line Manager</option>
                <option value="HR_ADMIN">HR Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Department *</label>
              <select required value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20">
                <option value="">Select department…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Line Manager</label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20">
              <option value="">No manager assigned</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </select>
          </div>
          {isEdit && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0f1f3d]" />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active employee</label>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-[#0f1f3d] text-white py-2.5 text-sm font-semibold hover:bg-[#1a3160] disabled:opacity-60 transition">
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
