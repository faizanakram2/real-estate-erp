import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const waiveSchema = z.object({
  waiveAmount: z.number().positive("Waive amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
});

/**
 * PATCH /api/installments/:id/waive-penalty
 * Waive (fully or partially) the late penalty on an installment
 */

/**
 * @swagger
 * /api/installments/{id}/waive-penalty:
 *   patch:
 *     summary: Waive installment penalty
 *     description: |
 *       Waives all or part of the late-payment penalty applied to an installment.
 *
 *       The requested waive amount cannot exceed the installment's current
 *       late penalty. If the requested amount is greater than the current
 *       penalty, the entire remaining penalty is waived.
 *
 *       The waived amount is added to waivedPenalty and the remaining amount
 *       stays in latePenalty.
 *
 *       The waiver operation is also recorded in the audit log.
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
 *         description: ID of the installment whose penalty should be waived.
 *         example: "clx123abc456"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - waiveAmount
 *               - reason
 *             properties:
 *               waiveAmount:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 example: 2500
 *                 description: Amount of the late penalty to waive.
 *
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 example: "Customer requested penalty waiver due to delayed possession."
 *                 description: Reason for waiving the penalty.
 *
 *     responses:
 *       200:
 *         description: Installment penalty waived successfully.
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
 *                   example: "2026-07-01T00:00:00.000Z"
 *
 *                 status:
 *                   type: string
 *                   example: "OVERDUE"
 *
 *                 paidAmount:
 *                   type: number
 *                   format: double
 *                   example: 10000
 *
 *                 balanceAmount:
 *                   type: number
 *                   format: double
 *                   example: 40000
 *
 *                 latePenalty:
 *                   type: number
 *                   format: double
 *                   example: 2500
 *                   description: Remaining late penalty after the waiver.
 *
 *                 waivedPenalty:
 *                   type: number
 *                   format: double
 *                   example: 2500
 *                   description: Total penalty waived for this installment.
 *
 *                 notes:
 *                   type: string
 *                   nullable: true
 *                   example: "Penalty waived: PKR 2500 — Reason: Customer requested penalty waiver due to delayed possession."
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-01T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error. Waive amount must be positive and a reason is required.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the installments:waive permission.
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
    const auth = await authorize("installments:waive");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = waiveSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const installment = await prisma.installment.findFirst({
      where: {
        id: params.id,
        booking: { plot: { project: { organizationId: session.user.organizationId } } },
      },
    });
    if (!installment) return notFoundResponse("Installment");

    const currentPenalty = Number(installment.latePenalty);
    const waiveAmount = Math.min(parsed.data.waiveAmount, currentPenalty);
    const newWaived = Number(installment.waivedPenalty) + waiveAmount;

    const updated = await prisma.installment.update({
      where: { id: params.id },
      data: {
        latePenalty: currentPenalty - waiveAmount,
        waivedPenalty: newWaived,
        notes: `Penalty waived: PKR ${waiveAmount} — Reason: ${parsed.data.reason}`,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "WAIVE",
      entity: "Installment",
      entityId: params.id,
      changes: { waiveAmount, reason: parsed.data.reason, remainingPenalty: currentPenalty - waiveAmount },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
