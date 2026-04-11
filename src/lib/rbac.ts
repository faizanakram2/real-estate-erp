import { NextResponse } from "next/server";
import { AuthSession, getAuthSession } from "./api-utils";

// Role hierarchy: higher index = more permissions
const ROLE_HIERARCHY: Record<string, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  SITE_ENGINEER: 2,
  SALES_AGENT: 2,
  ACCOUNTANT: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

// Endpoint permission map: which roles can access what
const PERMISSIONS: Record<string, string[]> = {
  // User management
  "users:read": ["ADMIN", "SUPER_ADMIN", "MANAGER"],
  "users:write": ["ADMIN", "SUPER_ADMIN"],

  // Projects
  "projects:read": ["STAFF", "SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "SITE_ENGINEER", "ACCOUNTANT"],
  "projects:write": ["MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Plots
  "plots:read": ["STAFF", "SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "SITE_ENGINEER"],
  "plots:write": ["MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Customers
  "customers:read": ["SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT"],
  "customers:write": ["SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Bookings
  "bookings:read": ["SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT"],
  "bookings:write": ["SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"],
  "bookings:cancel": ["MANAGER", "ADMIN", "SUPER_ADMIN"],
  "bookings:transfer": ["MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Payments
  "payments:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN", "SALES_AGENT"],
  "payments:write": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN", "SALES_AGENT"],
  "payments:verify": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Installments
  "installments:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN", "SALES_AGENT"],
  "installments:write": ["MANAGER", "ADMIN", "SUPER_ADMIN"],
  "installments:waive": ["MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Employees / HR
  "employees:read": ["MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT"],
  "employees:write": ["MANAGER", "ADMIN", "SUPER_ADMIN"],
  "payroll:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],
  "payroll:write": ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"],

  // Construction
  "construction:read": ["SITE_ENGINEER", "MANAGER", "ADMIN", "SUPER_ADMIN"],
  "construction:write": ["SITE_ENGINEER", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Vendors
  "vendors:read": ["MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "SITE_ENGINEER"],
  "vendors:write": ["MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Financial
  "ledger:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],
  "ledger:write": ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"],
  "transactions:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],
  "transactions:write": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Documents
  "documents:read": ["STAFF", "SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "SITE_ENGINEER"],
  "documents:write": ["SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Maintenance
  "maintenance:read": ["SITE_ENGINEER", "MANAGER", "ADMIN", "SUPER_ADMIN", "STAFF"],
  "maintenance:write": ["SITE_ENGINEER", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Organization
  "organization:read": ["MANAGER", "ADMIN", "SUPER_ADMIN"],
  "organization:write": ["ADMIN", "SUPER_ADMIN"],

  // Reports
  "reports:read": ["ACCOUNTANT", "MANAGER", "ADMIN", "SUPER_ADMIN"],

  // Audit
  "audit:read": ["ADMIN", "SUPER_ADMIN"],

  // Notifications
  "notifications:read": ["STAFF", "SALES_AGENT", "MANAGER", "ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "SITE_ENGINEER"],
};

export function hasPermission(role: string, permission: string): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

export function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

/**
 * Check auth + permission in one call. Returns session if authorized, or a Response if not.
 */
export async function authorize(
  permission: string
): Promise<{ session: AuthSession } | NextResponse> {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, permission)) {
    return NextResponse.json(
      { error: "Forbidden", message: `Role '${session.user.role}' does not have '${permission}' permission` },
      { status: 403 }
    );
  }
  return { session };
}

/**
 * Type guard to check if authorize result is an error response
 */
export function isErrorResponse(
  result: { session: AuthSession } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
