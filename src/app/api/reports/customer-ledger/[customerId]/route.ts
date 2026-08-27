import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/customer-ledger/:customerId
 * Complete payment history and ledger for a customer
 */

/**
 * @swagger
 * /api/reports/customer-ledger/{customerId}:
 *   get:
 *     summary: Get customer ledger
 *     description: |
 *       Returns the complete payment history, installment schedule,
 *       outstanding balance, penalties, and booking information for a customer.
 *       The customer must belong to the authenticated user's organization.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *         example: "c8a7b6d5-e4f3-4a21-9876-123456789abc"
 *     responses:
 *       200:
 *         description: Customer ledger retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "c8a7b6d5-e4f3-4a21-9876-123456789abc"
 *                     firstName:
 *                       type: string
 *                       example: "Ahmed"
 *                     lastName:
 *                       type: string
 *                       example: "Raza"
 *                     phone:
 *                       type: string
 *                       example: "+923001234567"
 *                     cnic:
 *                       type: string
 *                       example: "35202-1234567-1"
 *
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalBookings:
 *                       type: integer
 *                       example: 2
 *                     grandTotal:
 *                       type: number
 *                       format: double
 *                       example: 5000000
 *                     grandPaid:
 *                       type: number
 *                       format: double
 *                       example: 1750000
 *                     grandDue:
 *                       type: number
 *                       format: double
 *                       example: 3250000
 *
 *                 ledger:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bookingNumber:
 *                         type: string
 *                         example: "BK-2026-0001"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *                       plot:
 *                         type: object
 *                         properties:
 *                           plotNumber:
 *                             type: string
 *                             example: "A-101"
 *                           size:
 *                             type: number
 *                             format: double
 *                             example: 5
 *                           sizeUnit:
 *                             type: string
 *                             example: "MARLA"
 *                           project:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Green Valley Housing"
 *                           block:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Block A"
 *
 *                       netAmount:
 *                         type: number
 *                         format: double
 *                         example: 2500000
 *                       totalPaid:
 *                         type: number
 *                         format: double
 *                         example: 1000000
 *                       totalDue:
 *                         type: number
 *                         format: double
 *                         example: 1500000
 *                       totalPenalty:
 *                         type: number
 *                         format: double
 *                         example: 25000
 *
 *                       installmentsSummary:
 *                         type: object
 *                         properties:
 *                           total:
 *                             type: integer
 *                             example: 12
 *                           paid:
 *                             type: integer
 *                             example: 5
 *                           overdue:
 *                             type: integer
 *                             example: 1
 *                           pending:
 *                             type: integer
 *                             example: 6
 *
 *                       installments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             no:
 *                               type: integer
 *                               example: 1
 *                             type:
 *                               type: string
 *                               example: "MONTHLY"
 *                             amount:
 *                               type: number
 *                               format: double
 *                               example: 125000
 *                             dueDate:
 *                               type: string
 *                               format: date-time
 *                               example: "2026-09-01T00:00:00.000Z"
 *                             status:
 *                               type: string
 *                               example: "PAID"
 *                             paidAmount:
 *                               type: number
 *                               format: double
 *                               example: 125000
 *                             paidDate:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                               example: "2026-08-28T10:30:00.000Z"
 *                             penalty:
 *                               type: number
 *                               format: double
 *                               example: 0
 *                             balance:
 *                               type: number
 *                               format: double
 *                               example: 0
 *
 *                       payments:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             receiptNumber:
 *                               type: string
 *                               example: "REC-2026-00001"
 *                             amount:
 *                               type: number
 *                               format: double
 *                               example: 125000
 *                             method:
 *                               type: string
 *                               example: "BANK_TRANSFER"
 *                             date:
 *                               type: string
 *                               format: date-time
 *                               example: "2026-08-28T10:30:00.000Z"
 *                             status:
 *                               type: string
 *                               example: "CONFIRMED"
 *                             reference:
 *                               type: string
 *                               nullable: true
 *                               example: "TXN-123456"
 *
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Customer not found"
 *
 *       500:
 *         description: Internal server error
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, organizationId: session.user.organizationId },
      select: { id: true, firstName: true, lastName: true, phone: true, cnic: true },
    });
    if (!customer) return notFoundResponse("Customer");

    const bookings = await prisma.booking.findMany({
      where: { customerId: params.customerId },
      include: {
        plot: {
          select: { plotNumber: true, size: true, sizeUnit: true, project: { select: { name: true } }, block: { select: { name: true } } },
        },
        installments: { orderBy: { dueDate: "asc" } },
        paymentRecords: { orderBy: { paymentDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const ledger = bookings.map((b) => {
      const totalPaid = b.paymentRecords
        .filter((p) => p.status === "CONFIRMED")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalDue = Number(b.netAmount) - totalPaid;
      const paidInstallments = b.installments.filter((i) => i.status === "PAID").length;
      const overdueInstallments = b.installments.filter((i) => ["OVERDUE"].includes(i.status)).length;
      const totalPenalty = b.installments.reduce((sum, i) => sum + Number(i.latePenalty), 0);

      return {
        bookingNumber: b.bookingNumber,
        status: b.status,
        plot: b.plot,
        netAmount: Number(b.netAmount),
        totalPaid,
        totalDue,
        totalPenalty,
        installmentsSummary: {
          total: b.installments.length,
          paid: paidInstallments,
          overdue: overdueInstallments,
          pending: b.installments.filter((i) => i.status === "PENDING").length,
        },
        installments: b.installments.map((i) => ({
          no: i.installmentNo,
          type: i.type,
          amount: Number(i.amount),
          dueDate: i.dueDate,
          status: i.status,
          paidAmount: Number(i.paidAmount),
          paidDate: i.paidDate,
          penalty: Number(i.latePenalty),
          balance: Number(i.balanceAmount),
        })),
        payments: b.paymentRecords.map((p) => ({
          receiptNumber: p.receiptNumber,
          amount: Number(p.amount),
          method: p.paymentMethod,
          date: p.paymentDate,
          status: p.status,
          reference: p.referenceNumber,
        })),
      };
    });

    const grandTotal = ledger.reduce((sum, l) => sum + l.netAmount, 0);
    const grandPaid = ledger.reduce((sum, l) => sum + l.totalPaid, 0);
    const grandDue = ledger.reduce((sum, l) => sum + l.totalDue, 0);

    return NextResponse.json({
      customer,
      summary: { totalBookings: ledger.length, grandTotal, grandPaid, grandDue },
      ledger,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
