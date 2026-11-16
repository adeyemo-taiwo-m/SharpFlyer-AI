import { NextResponse, type NextRequest } from "next/server";

import { evaluateRouteProtection } from "@/server/auth";

export const AUTH_ACCESS_COOKIE = "sb-access-token";
export const AUTH_ADMIN_COOKIE = "sf-admin-session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(AUTH_ACCESS_COOKIE)?.value);
  // Note: Admin routes also run server-side `requireAdmin()` against the DB profile on every request.
  const hasAdminFlag = request.cookies.get(AUTH_ADMIN_COOKIE)?.value === "1";

  const decision = evaluateRouteProtection({
    pathname,
    isAuthenticated: hasSessionCookie,
    isAdmin: hasAdminFlag,
  });

  if (!decision.allowed && decision.redirectTo) {
    const destination = new URL(decision.redirectTo, request.url);
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
