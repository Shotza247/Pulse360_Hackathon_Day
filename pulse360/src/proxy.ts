import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROLE_PATHS: Record<string, string[]> = {
  HR_ADMIN:     ["/dashboard", "/admin", "/employees", "/cycles", "/results", "/criteria", "/nominations", "/reviews", "/my-results", "/approvals"],
  LINE_MANAGER: ["/dashboard", "/manager", "/approvals", "/results", "/nominations", "/reviews", "/my-results"],
  EMPLOYEE:     ["/dashboard", "/nominations", "/reviews", "/my-results"],
  SYSTEM_ADMIN: ["/dashboard", "/system-admin", "/profile"],
};

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Not logged in → send to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;
  const { pathname } = req.nextUrl;

  // Role not recognised → back to login
  if (!role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const allowed = ROLE_PATHS[role] ?? [];
  const canAccess = allowed.some((prefix) => pathname.startsWith(prefix));

  // Role doesn't have access to this path → back to dashboard
  if (!canAccess) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/employees/:path*",
    "/cycles/:path*",
    "/results/:path*",
    "/criteria/:path*",
    "/manager/:path*",
    "/system-admin/:path*",
    "/approvals/:path*",
    "/nominations/:path*",
    "/reviews/:path*",
    "/my-results/:path*",
  ],
};
