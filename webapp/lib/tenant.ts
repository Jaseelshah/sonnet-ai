import { verifyToken, COOKIE_NAME } from "./auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Validates tenant access for the current request.
 * - Admins (or users with no DASHBOARD_TENANT set) can access any tenant.
 * - Non-admin users are restricted to their assigned DASHBOARD_TENANT.
 *
 * Returns the validated tenant string (may be empty string for "all tenants"),
 * or a 403 NextResponse if access is denied.
 */
export async function validateTenantAccess(
  request: NextRequest
): Promise<{ tenant: string } | NextResponse> {
  const requestedTenant = request.nextUrl.searchParams.get("tenant") || "";

  // Get user role from JWT
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    // No token — auth middleware handles this; pass through without restricting.
    return { tenant: requestedTenant };
  }

  const user = await verifyToken(token);
  if (!user) {
    // Invalid token — auth middleware handles this; pass through without restricting.
    return { tenant: requestedTenant };
  }

  // Admins can access any tenant without restriction.
  if (user.role === "admin") {
    return { tenant: requestedTenant };
  }

  // Non-admin users are restricted to their assigned tenant.
  const assignedTenant = process.env.DASHBOARD_TENANT || "";

  if (!assignedTenant) {
    // No tenant restriction configured — allow access to all tenants.
    return { tenant: requestedTenant };
  }

  if (requestedTenant && requestedTenant !== assignedTenant) {
    return NextResponse.json(
      { error: "Forbidden: access denied to this tenant" },
      { status: 403 }
    );
  }

  // Force the response to use only the assigned tenant.
  return { tenant: assignedTenant };
}
