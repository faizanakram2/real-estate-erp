import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  taxId: z.string().optional(),
  logo: z.string().optional(),
});

/**
 * GET /api/organization
 * Get current user's organization details
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await authorize("organization:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        bankAccounts: { where: { isActive: true }, orderBy: { bankName: "asc" } },
        _count: {
          select: { users: true, projects: true, customers: true, vendors: true, employees: true },
        },
      },
    });

    return NextResponse.json(org);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * PATCH /api/organization
 * Update organization profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize("organization:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const org = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: parsed.data,
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Organization",
      entityId: session.user.organizationId,
      changes: parsed.data,
    });

    return NextResponse.json(org);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
