"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
  roles: string[];
  badge?: number;
}

interface SidebarProps {
  role:       string;
  name:       string;
  department: string;
  badgeCounts?: { approvals?: number; reviews?: number; nominations?: number };
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",   roles: ["HR_ADMIN","LINE_MANAGER","EMPLOYEE"], icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/> },
  { label: "Platform",     href: "/system-admin", roles: ["SYSTEM_ADMIN"],                      icon: <Icon d="M3 7h18M3 12h18M3 17h18"/> },
  { label: "Employees",    href: "/employees",   roles: ["HR_ADMIN"],                           icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/> },
  { label: "Review Cycles", href: "/cycles",     roles: ["HR_ADMIN"],                           icon: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/> },
  { label: "Criteria",     href: "/criteria",    roles: ["HR_ADMIN"],                           icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/> },
  { label: "All Results",  href: "/results",     roles: ["HR_ADMIN"],                           icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/> },
  { label: "Analytics",    href: "/analytics",   roles: ["HR_ADMIN"],                           icon: <Icon d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/> },
  { label: "Approvals",    href: "/approvals",   roles: ["HR_ADMIN","LINE_MANAGER"],             icon: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/> },
  { label: "Team Results", href: "/manager/results", roles: ["LINE_MANAGER"],                   icon: <Icon d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/> },
  { label: "Nominations",  href: "/nominations", roles: ["EMPLOYEE","LINE_MANAGER"],            icon: <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/> },
  { label: "My Reviews",   href: "/reviews",     roles: ["EMPLOYEE","LINE_MANAGER"],            icon: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/> },
  { label: "My Results",   href: "/my-results",  roles: ["EMPLOYEE","LINE_MANAGER"],            icon: <Icon d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/> },
  { label: "My Profile",   href: "/profile",     roles: ["HR_ADMIN","LINE_MANAGER","EMPLOYEE","SYSTEM_ADMIN"], icon: <Icon d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l9.475-9.475a2.5 2.5 0 10-3.536-3.536L5.757 16.172a1 1 0 00-.293.707V20z"/> },
];

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  HR_ADMIN:     "HR Administrator",
  LINE_MANAGER: "Line Manager",
  EMPLOYEE:     "Employee",
};

const ROLE_COLOR: Record<string, string> = {
  SYSTEM_ADMIN: "bg-slate-100 text-slate-800",
  HR_ADMIN:     "bg-amber-100 text-amber-800",
  LINE_MANAGER: "bg-blue-100 text-blue-800",
  EMPLOYEE:     "bg-green-100 text-green-800",
};

export function Sidebar({ role, name, department, badgeCounts = {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleNav = NAV.filter((item) => item.roles.includes(role));

  function getBadge(href: string) {
    if (href === "/approvals")   return badgeCounts.approvals;
    if (href === "/reviews")     return badgeCounts.reviews;
    if (href === "/nominations") return badgeCounts.nominations;
    return undefined;
  }

  return (
    <aside className="w-64 min-h-screen bg-[#0f1f3d] flex flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <span className="text-base font-black text-[#0f1f3d]">P</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Pulse360</p>
          <p className="text-blue-300 text-xs">Performance Review</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge  = getBadge(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-white/15 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {badge != null && badge > 0 && (
                <span className="rounded-full bg-red-500 text-white text-xs font-bold px-2 py-0.5 min-w-[20px] text-center">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{name}</p>
            <p className="text-blue-300 text-xs truncate">{department}</p>
          </div>
        </div>
        <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 mb-3 ${ROLE_COLOR[role] ?? "bg-gray-100 text-gray-700"}`}>
          {ROLE_LABEL[role] ?? role}
        </span>
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            router.replace("/login");
          }}
          className="w-full flex items-center gap-2 text-blue-300 hover:text-white text-xs font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
