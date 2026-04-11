import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/commissions/:id
 * Update commission status (approve, pay, cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("payments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const commission = await prisma.commission.findFirst({
      where: { id: params.id, agent: { organizationId: session.user.organizationId } },
    });
    if (!commission) return notFoundResponse("Commission");

    const { status, notes } = await request.json();

    const updated = await prisma.commission.update({
      where: { id: params.id },
      data: {
        status,
        paidDate: status === "PAID" ? new Date() : undefined,
        notes,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Commission",
      entityId: params.id,
      changes: { status, notes },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
