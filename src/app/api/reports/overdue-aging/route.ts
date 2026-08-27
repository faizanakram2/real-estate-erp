import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/overdue-aging
 * Overdue aging report: 30/60/90+ day buckets
 */

/**
 * @swagger
 * /api/reports/overdue-aging:
 *   get:
 *     summary: Get overdue aging report
 *     description: |
 *       Returns an overdue installment aging report grouped into
 *       1-30, 31-60, 61-90, and 90+ day buckets.
 *       Includes overdue count, outstanding balance, late penalties,
 *       customer information, booking information, and plot details.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue aging report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       description: Total number of overdue installments
 *                       example: 18
 *                     totalOverdue:
 *                       type: number
 *                       format: double
 *                       description: Total outstanding overdue balance
 *                       example: 2350000
 *                     totalPenalty:
 *                       type: number
 *                       format: double
 *                       description: Total late penalty
 *                       example: 125000
 *
 *                 buckets:
 *                   type: object
 *                   properties:
 *                     1-30:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 8
 *                         amount:
 *                           type: number
 *                           format: double
 *                           example: 850000
 *                         penalty:
 *                           type: number
 *                           format: double
 *                           example: 25000
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/OverdueAgingItem'
 *
 *                     31-60:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 5
 *                         amount:
 *                           type: number
 *                           format: double
 *                           example: 625000
 *                         penalty:
 *                           type: number
 *                           format: double
 *                           example: 35000
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/OverdueAgingItem'
 *
 *                     61-90:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 3
 *                         amount:
 *                           type: number
 *                           format: double
 *                           example: 450000
 *                         penalty:
 *                           type: number
 *                           format: double
 *                           example: 30000
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/OverdueAgingItem'
 *
 *                     90+:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 2
 *                         amount:
 *                           type: number
 *                           format: double
 *                           example: 425000
 *                         penalty:
 *                           type: number
 *                           format: double
 *                           example: 35000
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/OverdueAgingItem'
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
 *       500:
 *         description: Internal server error
 *
 * components:
 *   schemas:
 *     OverdueAgingItem:
 *       type: object
 *       properties:
 *         installmentId:
 *           type: string
 *           description: Installment ID
 *           example: "8f7c6d5e-4a3b-2c1d-9876-123456789abc"
 *         daysOverdue:
 *           type: integer
 *           description: Number of days the installment is overdue
 *           example: 45
 *         amount:
 *           type: number
 *           format: double
 *           description: Outstanding installment balance
 *           example: 125000
 *         penalty:
 *           type: number
 *           format: double
 *           description: Late penalty amount
 *           example: 5000
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Original installment due date
 *           example: "2026-07-15T00:00:00.000Z"
 *         bookingNumber:
 *           type: string
 *           example: "BK-2026-00125"
 *         customer:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "c8a7b6d5-e4f3-4a21-9876-123456789abc"
 *             firstName:
 *               type: string
 *               example: "Ahmed"
 *             lastName:
 *               type: string
 *               example: "Raza"
 *             phone:
 *               type: string
 *               example: "+923001234567"
 *         plot:
 *           type: object
 *           properties:
 *             plotNumber:
 *               type: string
 *               example: "A-101"
 *             project:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "Green Valley Housing"
 */

export async function GET(_request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const now = new Date();
    const overdues = await prisma.installment.findMany({
      where: {
        status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
        dueDate: { lt: now },
        booking: {
          status: { in: ["BOOKED", "CONFIRMED", "ACTIVE", "DEFAULTER"] },
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
      include: {
        booking: {
          select: {
            bookingNumber: true,
            customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
      },
    });

    const buckets = {
      "1-30": { count: 0, amount: 0, penalty: 0, items: [] as any[] },
      "31-60": { count: 0, amount: 0, penalty: 0, items: [] as any[] },
      "61-90": { count: 0, amount: 0, penalty: 0, items: [] as any[] },
      "90+": { count: 0, amount: 0, penalty: 0, items: [] as any[] },
    };

    for (const inst of overdues) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inst.dueDate).getTime()) / 86400000);
      const balance = Number(inst.balanceAmount);
      const penalty = Number(inst.latePenalty);
      const item = {
        installmentId: inst.id,
        daysOverdue,
        amount: balance,
        penalty,
        dueDate: inst.dueDate,
        ...inst.booking,
      };

      if (daysOverdue <= 30) { buckets["1-30"].count++; buckets["1-30"].amount += balance; buckets["1-30"].penalty += penalty; buckets["1-30"].items.push(item); }
      else if (daysOverdue <= 60) { buckets["31-60"].count++; buckets["31-60"].amount += balance; buckets["31-60"].penalty += penalty; buckets["31-60"].items.push(item); }
      else if (daysOverdue <= 90) { buckets["61-90"].count++; buckets["61-90"].amount += balance; buckets["61-90"].penalty += penalty; buckets["61-90"].items.push(item); }
      else { buckets["90+"].count++; buckets["90+"].amount += balance; buckets["90+"].penalty += penalty; buckets["90+"].items.push(item); }
    }

    const totalOverdue = overdues.reduce((sum, i) => sum + Number(i.balanceAmount), 0);
    const totalPenalty = overdues.reduce((sum, i) => sum + Number(i.latePenalty), 0);

    return NextResponse.json({
      summary: { totalCount: overdues.length, totalOverdue, totalPenalty },
      buckets,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
