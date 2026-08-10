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
  const [jobGrade, setJobGrade] = useState("");
  const [employmentType, setEmploymentType] = useState("PERMANENT");
  const [conversionHireStatus, setConversionHireStatus] = useState("NO");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
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
          setJobGrade(emp.jobGrade ?? "");
          setEmploymentType(emp.employmentType ?? "PERMANENT");
          setConversionHireStatus(emp.conversionHireStatus ?? "NO");
          setGender(emp.gender ?? "");
          setEthnicity(emp.ethnicity ?? "");
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
      firstName,
      lastName,
      email,
      jobTitle,
      jobGrade,
      employmentType,
      conversionHireStatus,
      gender: gender || null,
      ethnicity: ethnicity || null,
      role,
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

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-[#0f1f3d] focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20";

  return (
    <div className="max-w-4xl mx-auto">
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
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name *</label>
              <input required value={lastName} onChange={e => setLastName(e.target.value)}
                className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Grade</label>
              <input value={jobGrade} onChange={e => setJobGrade(e.target.value)}
                placeholder="Example: C3, Manager, Executive"
                className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role *</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className={inputClass}>
                <option value="EMPLOYEE">Employee</option>
                <option value="LINE_MANAGER">Line Manager</option>
                <option value="HR_ADMIN">HR Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Department *</label>
              <select required value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                className={inputClass}>
                <option value="">Select department…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment Type</label>
              <select value={employmentType} onChange={e => setEmploymentType(e.target.value)}
                className={inputClass}>
                <option value="PERMANENT">Permanent</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="LEARNERSHIP">Learnership</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Conversion Hire</label>
              <select value={conversionHireStatus} onChange={e => setConversionHireStatus(e.target.value)}
                className={inputClass}>
                <option value="NO">No</option>
                <option value="YES">Yes</option>
                <option value="PENDING_DECISION">Pending decision</option>
                <option value="REVIEWED">Reviewed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className={inputClass}>
                <option value="">Not captured</option>
                <option value="WOMAN">Female</option>
                <option value="MAN">Male</option>
                <option value="NON_BINARY">Non-binary</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ethnicity</label>
              <select value={ethnicity} onChange={e => setEthnicity(e.target.value)}
                className={inputClass}>
                <option value="">Not captured</option>
                <option value="BLACK">Black</option>
                <option value="WHITE">White</option>
                <option value="COLOURED">Coloured</option>
                <option value="ASIAN">Asian</option>
                <option value="INDIAN">Indian</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Line Manager</label>
            <select value={managerId} onChange={e => setManagerId(e.target.value)}
              className={inputClass}>
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
