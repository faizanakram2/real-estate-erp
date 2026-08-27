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

/**
 * @swagger
 * /api/installments/{id}/reschedule:
 *   patch:
 *     summary: Reschedule an installment
 *     description: |
 *       Reschedules an installment to a new due date.
 *
 *       Only installments with PENDING, PARTIAL, or OVERDUE status can be
 *       rescheduled.
 *
 *       If the new due date is in the future, the installment status will
 *       automatically be changed to PENDING.
 *
 *       The rescheduling operation is recorded in the audit log.
 *     tags:
 *       - Installments
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Installment ID.
 *         example: "clx123abc456"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newDueDate
 *               - reason
 *             properties:
 *               newDueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-09-15T00:00:00.000Z"
 *                 description: New due date for the installment.
 *
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 example: "Customer requested a payment date extension."
 *                 description: Reason for rescheduling the installment.
 *
 *     responses:
 *       200:
 *         description: Installment rescheduled successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 bookingId:
 *                   type: string
 *                   example: "booking_123"
 *
 *                 installmentNo:
 *                   type: integer
 *                   example: 5
 *
 *                 type:
 *                   type: string
 *                   example: "MONTHLY"
 *
 *                 amount:
 *                   type: number
 *                   format: double
 *                   example: 50000
 *
 *                 dueDate:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-15T00:00:00.000Z"
 *
 *                 status:
 *                   type: string
 *                   enum:
 *                     - PENDING
 *                     - PARTIAL
 *                     - OVERDUE
 *                   example: "PENDING"
 *
 *                 paidAmount:
 *                   type: number
 *                   format: double
 *                   example: 10000
 *
 *                 paidDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: null
 *
 *                 latePenalty:
 *                   type: number
 *                   format: double
 *                   example: 1000
 *
 *                 balanceAmount:
 *                   type: number
 *                   format: double
 *                   example: 40000
 *
 *                 notes:
 *                   type: string
 *                   nullable: true
 *                   example: "Rescheduled from 2026-08-01 — Reason: Customer requested a payment date extension."
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-07-01T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error. The new due date or reason is invalid.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the installments:write permission.
 *
 *       404:
 *         description: Installment not found or does not belong to the user's organization.
 *
 *       500:
 *         description: Internal server error.
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
