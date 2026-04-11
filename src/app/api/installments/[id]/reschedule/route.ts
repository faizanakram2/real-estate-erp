import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const rescheduleSchema = z.object({
  newDueDate: z.string().datetime(),
  reason: z.string().min(1, "Reason is required"),
});

/**
 * PATCH /api/installments/:id/reschedule
 * Reschedule an installment to a new due date
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("installments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const installment = await prisma.installment.findFirst({
      where: {
        id: params.id,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        booking: { plot: { project: { organizationId: session.user.organizationId } } },
      },
    });
    if (!installment) return notFoundResponse("Installment");

    const oldDueDate = installment.dueDate;
    const updated = await prisma.installment.update({
      where: { id: params.id },
      data: {
        dueDate: new Date(parsed.data.newDueDate),
        status: new Date(parsed.data.newDueDate) > new Date() ? "PENDING" : installment.status,
        notes: `Rescheduled from ${oldDueDate.toISOString().split("T")[0]} — Reason: ${parsed.data.reason}`,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Installment",
      entityId: params.id,
      changes: { oldDueDate, newDueDate: parsed.data.newDueDate, reason: parsed.data.reason },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
