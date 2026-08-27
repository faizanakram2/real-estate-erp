import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/commissions/:id
 * Update commission status (approve, pay, cancel)
 */

/**
 * @swagger
 * /api/commissions/{id}:
 *   patch:
 *     tags:
 *       - Commissions
 *     summary: Update commission status
 *     description: >
 *       Updates the status and optional notes of a commission.
 *       This endpoint can be used to approve, mark as paid, or cancel
 *       a commission. When the status is set to PAID, the paid date
 *       is automatically recorded.
 *       Requires the `payments:write` permission.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Commission ID.
 *         schema:
 *           type: string
 *         example: "commission-id-here"
 *
 *     requestBody:
 *       required: true
 *       description: Commission status update details.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the commission.
 *                 example: "PAID"
 *
 *               notes:
 *                 type: string
 *                 description: Optional notes related to the commission update.
 *                 example: "Commission payment transferred successfully"
 *
 *           examples:
 *             approveCommission:
 *               summary: Approve commission
 *               value:
 *                 status: "APPROVED"
 *                 notes: "Commission approved by finance department"
 *
 *             payCommission:
 *               summary: Mark commission as paid
 *               value:
 *                 status: "PAID"
 *                 notes: "Payment transferred to agent"
 *
 *             cancelCommission:
 *               summary: Cancel commission
 *               value:
 *                 status: "CANCELLED"
 *                 notes: "Commission cancelled due to booking cancellation"
 *
 *     responses:
 *       200:
 *         description: Commission updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "commission-id"
 *
 *                 bookingId:
 *                   type: string
 *                   example: "booking-id"
 *
 *                 agentId:
 *                   type: string
 *                   example: "agent-id"
 *
 *                 commissionType:
 *                   type: string
 *                   example: "PERCENTAGE"
 *
 *                 rate:
 *                   type: number
 *                   example: 5
 *
 *                 baseAmount:
 *                   type: number
 *                   example: 5000000
 *
 *                 commissionAmount:
 *                   type: number
 *                   example: 250000
 *
 *                 status:
 *                   type: string
 *                   example: "PAID"
 *
 *                 paidDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 notes:
 *                   type: string
 *                   nullable: true
 *                   example: "Payment transferred to agent"
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       403:
 *         description: Forbidden - User does not have the `payments:write` permission.
 *
 *       404:
 *         description: Commission not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Commission not found"
 *
 *       500:
 *         description: Internal server error.
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
