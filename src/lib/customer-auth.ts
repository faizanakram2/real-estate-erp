import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export interface CustomerSession {
  customerId: string;
  organizationId: string;
  phone: string;
  name: string;
}

/**
 * Verify customer portal JWT token from Authorization header
 */
export function getCustomerSession(request: NextRequest): CustomerSession | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";

  try {
    const decoded = jwt.verify(token, secret) as any;
    if (decoded.type !== "customer_portal") return null;
    return {
      customerId: decoded.customerId,
      organizationId: decoded.organizationId,
      phone: decoded.phone,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

export function customerUnauthorized() {
  return NextResponse.json({ error: "Unauthorized. Please login to customer portal." }, { status: 401 });
}
