import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_PATHS: Record<string, string[]> = {
  HR_ADMIN:     ["/dashboard", "/admin", "/employees", "/cycles", "/results", "/criteria"],
  LINE_MANAGER: ["/dashboard", "/manager", "/approvals", "/results"],
  EMPLOYEE:     ["/dashboard", "/nominations", "/reviews", "/my-results"],
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = (req.nextauth.token as any)?.role as string | undefined;

    if (!role) return NextResponse.redirect(new URL("/login", req.url));

    const allowed = ROLE_PATHS[role] ?? [];
    const canAccess = allowed.some((prefix) => pathname.startsWith(prefix));

    if (!canAccess) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/employees/:path*",
    "/cycles/:path*",
    "/results/:path*",
    "/criteria/:path*",
    "/manager/:path*",
    "/approvals/:path*",
    "/nominations/:path*",
    "/reviews/:path*",
    "/my-results/:path*",
  ],
};
