import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Role → allowed path prefixes
const ROLE_PATHS: Record<string, string[]> = {
  HR_ADMIN:     ["/dashboard", "/admin", "/employees", "/cycles", "/results", "/criteria"],
  LINE_MANAGER: ["/dashboard", "/manager", "/approvals", "/results"],
  EMPLOYEE:     ["/dashboard", "/nominations", "/reviews", "/my-results"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Redirect authenticated users away from login
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Allow public routes
  if (pathname === "/login" || pathname === "/") {
    return NextResponse.next();
  }

  // Not logged in → send to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user.role;
  const allowed = ROLE_PATHS[role] ?? [];
  const canAccess = allowed.some((prefix) => pathname.startsWith(prefix));

  if (!canAccess) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
