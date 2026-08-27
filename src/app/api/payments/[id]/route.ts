import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { verifyPaymentSchema } from "@/lib/validators/payment";

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment details
 *     description: |
 *       Retrieves detailed information for a specific payment record.
 *
 *       The payment must belong to the authenticated user's organization.
 *       The response includes customer, booking, plot, project, block,
 *       installment, and verification details.
 *     tags:
 *       - Payments
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment record ID.
 *         example: "clxpayment123"
 *
 *     responses:
 *       200:
 *         description: Payment details returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clxpayment123"
 *
 *                 receiptNumber:
 *                   type: string
 *                   example: "REC-2026-00001"
 *
 *                 customerId:
 *                   type: string
 *
 *                 bookingId:
 *                   type: string
 *
 *                 installmentId:
 *                   type: string
 *                   nullable: true
 *
 *                 amount:
 *                   type: number
 *                   example: 500000
 *
 *                 paymentMethod:
 *                   type: string
 *                   example: "BANK_TRANSFER"
 *
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *
 *                 paymentDate:
 *                   type: string
 *                   format: date-time
 *
 *                 referenceNumber:
 *                   type: string
 *                   nullable: true
 *
 *                 bankName:
 *                   type: string
 *                   nullable: true
 *
 *                 chequeNumber:
 *                   type: string
 *                   nullable: true
 *
 *                 chequeDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 chequeStatus:
 *                   type: string
 *                   nullable: true
 *
 *                 rejectionReason:
 *                   type: string
 *                   nullable: true
 *
 *                 verifiedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                       example: "Ahmed"
 *                     lastName:
 *                       type: string
 *                       example: "Khan"
 *                     phone:
 *                       type: string
 *                       example: "+923001234567"
 *
 *                 booking:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     bookingNumber:
 *                       type: string
 *                       example: "BK-2026-00001"
 *                     plot:
 *                       type: object
 *                       properties:
 *                         plotNumber:
 *                           type: string
 *                           example: "A-101"
 *                         project:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                               example: "Green Valley"
 *                         block:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                               example: "Block A"
 *
 *                 installment:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     installmentNo:
 *                       type: integer
 *                       example: 1
 *                     amount:
 *                       type: number
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *
 *                 verifiedBy:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                       example: "Admin User"
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       404:
 *         description: Payment not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const payment = await prisma.paymentRecord.findFirst({
      where: {
        id: params.id,
        booking: {
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
      include: {
        customer: true,
        booking: {
          include: {
            plot: { include: { project: true, block: true } },
          },
        },
        installment: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    });

    if (!payment) return notFoundResponse("Payment");
    return NextResponse.json(payment);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/payments/{id}:
 *   patch:
 *     summary: Verify, confirm, or reject a payment
 *     description: |
 *       Updates the verification status of a payment.
 *
 *       When the payment status is CONFIRMED and the payment is linked
 *       to an installment, the installment paid amount and balance are
 *       automatically updated.
 *
 *       If the installment is fully paid, its status becomes PAID.
 *       Otherwise, its status becomes PARTIAL.
 *     tags:
 *       - Payments
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment record ID.
 *         example: "clxpayment123"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New verification status for the payment.
 *                 enum:
 *                   - CONFIRMED
 *                   - REJECTED
 *                 example: CONFIRMED
 *
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejecting the payment. Required when status is REJECTED.
 *                 example: "Bank transaction could not be verified."
 *
 *           examples:
 *             confirmPayment:
 *               summary: Confirm a payment
 *               value:
 *                 status: CONFIRMED
 *
 *             rejectPayment:
 *               summary: Reject a payment
 *               value:
 *                 status: REJECTED
 *                 rejectionReason: "Bank transaction could not be verified."
 *
 *     responses:
 *       200:
 *         description: Payment verification status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clxpayment123"
 *
 *                 receiptNumber:
 *                   type: string
 *                   example: "REC-2026-00001"
 *
 *                 customerId:
 *                   type: string
 *
 *                 bookingId:
 *                   type: string
 *
 *                 installmentId:
 *                   type: string
 *                   nullable: true
 *
 *                 amount:
 *                   type: number
 *                   example: 500000
 *
 *                 paymentMethod:
 *                   type: string
 *                   example: "BANK_TRANSFER"
 *
 *                 status:
 *                   type: string
 *                   example: "CONFIRMED"
 *
 *                 verifiedById:
 *                   type: string
 *                   description: ID of the user who verified the payment.
 *
 *                 verifiedAt:
 *                   type: string
 *                   format: date-time
 *
 *                 rejectionReason:
 *                   type: string
 *                   nullable: true
 *
 *                 paymentDate:
 *                   type: string
 *                   format: date-time
 *
 *       400:
 *         description: Validation error or invalid payment verification data.
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       404:
 *         description: Payment not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = verifyPaymentSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const payment = await prisma.paymentRecord.findFirst({
      where: {
        id: params.id,
        booking: {
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
    });
    if (!payment) return notFoundResponse("Payment");

    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.paymentRecord.update({
        where: { id: params.id },
        data: {
          status: data.status,
          verifiedById: session.user.id,
          verifiedAt: new Date(),
          rejectionReason: data.rejectionReason,
        },
      });

      // If confirmed, update the installment status
      if (data.status === "CONFIRMED" && payment.installmentId) {
        const installment = await tx.installment.findUnique({
          where: { id: payment.installmentId },
        });

        if (installment) {
          const newPaidAmount =
            Number(installment.paidAmount) + Number(payment.amount);
          const newBalance = Number(installment.amount) - newPaidAmount;

          await tx.installment.update({
            where: { id: payment.installmentId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: Math.max(0, newBalance),
              paidDate: newBalance <= 0 ? new Date() : undefined,
              status: newBalance <= 0 ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      return updatedPayment;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
