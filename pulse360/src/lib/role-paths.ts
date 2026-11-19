export const ROLE_PATHS: Record<string, string[]> = {
  HR_ADMIN:     ["/dashboard", "/admin", "/employees", "/cycles", "/results", "/criteria", "/nominations", "/reviews", "/my-results", "/approvals"],
  LINE_MANAGER: ["/dashboard", "/manager", "/approvals", "/results", "/nominations", "/reviews", "/my-results"],
  EMPLOYEE:     ["/dashboard", "/nominations", "/reviews", "/my-results"],
  SYSTEM_ADMIN: ["/dashboard", "/system-admin", "/profile"],
};

// Exact pages (and their subpaths) a role may open outside its prefix list.
// Never a prefix like "/system-admin": that would open every System Admin page to HR Admin.
const EXACT_PATH_EXCEPTIONS: Record<string, string[]> = {
  HR_ADMIN: ["/system-admin/rag"],
};

export function canRoleAccessPath(role: string, pathname: string): boolean {
  const allowed = ROLE_PATHS[role] ?? [];
  if (allowed.some((prefix) => pathname.startsWith(prefix))) return true;

  const exceptions = EXACT_PATH_EXCEPTIONS[role] ?? [];
  return exceptions.some((path) => pathname === path || pathname.startsWith(path + "/"));
}
