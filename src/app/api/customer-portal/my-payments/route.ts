import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-payments
 * Customer sees their payment history with downloadable receipts
 */

/**
 * @swagger
 * /api/customer-portal/my-payments:
 *   get:
 *     summary: Get customer payment history
 *     description: |
 *       Returns the authenticated customer's payment history.
 *       Optionally filter payments by booking ID.
 *       The response includes payment details, booking information,
 *       plot/project information, and installment information.
 *     tags:
 *       - Customer Portal
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter payments by booking ID.
 *         example: "booking_123"
 *
 *     responses:
 *       200:
 *         description: Customer payment history retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   receiptNumber:
 *                     type: string
 *                     nullable: true
 *                     description: Payment receipt number.
 *                     example: "REC-2026-0001"
 *
 *                   amount:
 *                     type: number
 *                     format: double
 *                     description: Payment amount.
 *                     example: 50000
 *
 *                   paymentMethod:
 *                     type: string
 *                     nullable: true
 *                     description: Method used for the payment.
 *                     example: "BANK_TRANSFER"
 *
 *                   paymentDate:
 *                     type: string
 *                     format: date-time
 *                     description: Date and time when the payment was made.
 *                     example: "2026-08-25T10:30:00.000Z"
 *
 *                   status:
 *                     type: string
 *                     description: Payment status.
 *                     example: "PAID"
 *
 *                   referenceNumber:
 *                     type: string
 *                     nullable: true
 *                     description: External payment reference number.
 *                     example: "TXN-987654"
 *
 *                   booking:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       bookingNumber:
 *                         type: string
 *                         example: "BK-2026-00125"
 *
 *                       plot:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           plotNumber:
 *                             type: string
 *                             example: "P-101"
 *
 *                           project:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Green Valley Housing Society"
 *
 *                   installment:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       installmentNo:
 *                         type: integer
 *                         example: 3
 *
 *                       type:
 *                         type: string
 *                         example: "MONTHLY"
 *
 *       401:
 *         description: Unauthorized. Customer authentication is required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

export async function GET(request: NextRequest) {
  try {
    const customer = getCustomerSession(request);
    if (!customer) return customerUnauthorized();

    const bookingId = request.nextUrl.searchParams.get("bookingId");

    const where: any = { customerId: customer.customerId };
    if (bookingId) where.bookingId = bookingId;

    const payments = await prisma.paymentRecord.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
        installment: { select: { installmentNo: true, type: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    const formatted = payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      status: p.status,
      referenceNumber: p.referenceNumber,
      booking: p.booking,
      installment: p.installment,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
