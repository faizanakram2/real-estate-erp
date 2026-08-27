import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-installments
 * Customer sees their installment schedule with payment status
 */

/**
 * @swagger
 * /api/customer-portal/my-installments:
 *   get:
 *     tags:
 *       - Customer Portal
 *     summary: Get customer installment schedule
 *     description: >
 *       Returns the authenticated customer's installment schedule and payment summary.
 *       The customer can optionally filter installments by a specific booking ID.
 *       Only installments belonging to the authenticated customer are returned.
 *     security:
 *       - CustomerPortalAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         required: false
 *         description: Filter installments by a specific booking ID
 *         schema:
 *           type: string
 *         example: "booking-id-here"
 *
 *     responses:
 *       200:
 *         description: Installments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of installments
 *                       example: 36
 *
 *                     paid:
 *                       type: integer
 *                       description: Number of paid installments
 *                       example: 10
 *
 *                     pending:
 *                       type: integer
 *                       description: Number of pending installments
 *                       example: 20
 *
 *                     overdue:
 *                       type: integer
 *                       description: Number of overdue installments
 *                       example: 2
 *
 *                     totalAmount:
 *                       type: number
 *                       example: 5000000
 *
 *                     totalPaid:
 *                       type: number
 *                       example: 1500000
 *
 *                     totalBalance:
 *                       type: number
 *                       example: 3500000
 *
 *                     totalPenalty:
 *                       type: number
 *                       example: 25000
 *
 *                     nextDue:
 *                       type: object
 *                       nullable: true
 *                       description: Next pending or partially paid installment
 *
 *                 installments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "installment-id-here"
 *
 *                       installmentNo:
 *                         type: integer
 *                         example: 1
 *
 *                       type:
 *                         type: string
 *                         example: "MONTHLY"
 *
 *                       amount:
 *                         type: number
 *                         example: 138889
 *
 *                       paidAmount:
 *                         type: number
 *                         example: 50000
 *
 *                       balanceAmount:
 *                         type: number
 *                         example: 88889
 *
 *                       latePenalty:
 *                         type: number
 *                         example: 5000
 *
 *                       status:
 *                         type: string
 *                         enum:
 *                           - PENDING
 *                           - PARTIAL
 *                           - PAID
 *                           - OVERDUE
 *                           - WAIVED
 *                         example: "PENDING"
 *
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-09-01T00:00:00.000Z"
 *
 *                       paidDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *
 *                       booking:
 *                         type: object
 *                         properties:
 *                           bookingNumber:
 *                             type: string
 *                             example: "BK-2026-0001"
 *
 *                           plot:
 *                             type: object
 *                             properties:
 *                               plotNumber:
 *                                 type: string
 *                                 example: "A-101"
 *
 *                               project:
 *                                 type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Green Valley Housing Society"
 *
 *       401:
 *         description: Unauthorized - Customer portal authentication token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

export async function GET(request: NextRequest) {
  try {
    const customer = getCustomerSession(request);
    if (!customer) return customerUnauthorized();

    const bookingId = request.nextUrl.searchParams.get("bookingId");

    const where: any = {
      booking: { customerId: customer.customerId },
    };
    if (bookingId) where.bookingId = bookingId;

    const installments = await prisma.installment.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const summary = {
      total: installments.length,
      paid: installments.filter((i) => i.status === "PAID").length,
      pending: installments.filter((i) => i.status === "PENDING").length,
      overdue: installments.filter((i) => i.status === "OVERDUE").length,
      totalAmount: installments.reduce((sum, i) => sum + Number(i.amount), 0),
      totalPaid: installments.reduce((sum, i) => sum + Number(i.paidAmount), 0),
      totalBalance: installments.reduce((sum, i) => sum + Number(i.balanceAmount), 0),
      totalPenalty: installments.reduce((sum, i) => sum + Number(i.latePenalty), 0),
      nextDue: installments.find((i) => ["PENDING", "PARTIAL"].includes(i.status)),
    };

    return NextResponse.json({ summary, installments });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
