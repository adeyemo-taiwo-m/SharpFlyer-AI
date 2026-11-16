export function evaluateRouteProtection(input: {
  pathname: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}): { allowed: boolean; redirectTo?: string; status?: 401 | 403 } {
  const { pathname, isAuthenticated, isAdmin } = input;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAuthenticated) {
      return { allowed: false, redirectTo: `/auth?next=${encodeURIComponent(pathname)}`, status: 401 };
    }
    if (!isAdmin) {
      return { allowed: false, redirectTo: "/app", status: 403 };
    }
    return { allowed: true };
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (!isAuthenticated) {
      return { allowed: false, redirectTo: `/auth?next=${encodeURIComponent(pathname)}`, status: 401 };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
