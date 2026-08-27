import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/cash-flow?months=6
 * Monthly cash flow breakdown (inflows vs outflows)
 */

/**
 * @swagger
 * /api/reports/cash-flow:
 *   get:
 *     summary: Get cash flow report
 *     description: >
 *       Returns a monthly cash flow breakdown showing confirmed payment
 *       inflows, expense and payroll outflows, and the resulting net cash flow.
 *       The report can be generated for a configurable number of previous
 *       months.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         required: false
 *         description: Number of months to include in the cash flow report
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 6
 *           example: 6
 *     responses:
 *       200:
 *         description: Cash flow report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalInflow:
 *                       type: number
 *                       description: Total confirmed payment inflow for the selected period
 *                       example: 15000000
 *                     totalOutflow:
 *                       type: number
 *                       description: Total expenses and paid payroll for the selected period
 *                       example: 8500000
 *                     netCashFlow:
 *                       type: number
 *                       description: Total inflow minus total outflow
 *                       example: 6500000
 *                 monthly:
 *                   type: array
 *                   description: Monthly cash flow breakdown
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         description: Month label
 *                         example: "Aug 2026"
 *                       inflow:
 *                         type: number
 *                         description: Confirmed payment inflow for the month
 *                         example: 3000000
 *                       outflow:
 *                         type: number
 *                         description: Expense and payroll outflow for the month
 *                         example: 1700000
 *                       net:
 *                         type: number
 *                         description: Monthly net cash flow
 *                         example: 1300000
 *                       paymentsReceived:
 *                         type: integer
 *                         description: Number of confirmed payments received during the month
 *                         example: 24
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const orgId = session.user.organizationId;
    const months = parseInt(request.nextUrl.searchParams.get("months") || "6");
    const now = new Date();
    const monthlyData = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = monthStart.toLocaleString("default", { month: "short", year: "numeric" });

      const [inflow, outflow, payrollOut] = await Promise.all([
        prisma.paymentRecord.aggregate({
          where: {
            status: "CONFIRMED",
            paymentDate: { gte: monthStart, lte: monthEnd },
            booking: { plot: { project: { organizationId: orgId } } },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: {
            type: "EXPENSE",
            date: { gte: monthStart, lte: monthEnd },
            OR: [
              { project: { organizationId: orgId } },
              { vendor: { organizationId: orgId } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.payroll.aggregate({
          where: {
            status: "PAID",
            employee: { organizationId: orgId },
            paidDate: { gte: monthStart, lte: monthEnd },
          },
          _sum: { netSalary: true },
        }),
      ]);

      const totalInflow = Number(inflow._sum.amount || 0);
      const totalOutflow = Number(outflow._sum.amount || 0) + Number(payrollOut._sum.netSalary || 0);

      monthlyData.push({
        month: label,
        inflow: totalInflow,
        outflow: totalOutflow,
        net: totalInflow - totalOutflow,
        paymentsReceived: inflow._count,
      });
    }

    const totalInflow = monthlyData.reduce((s, m) => s + m.inflow, 0);
    const totalOutflow = monthlyData.reduce((s, m) => s + m.outflow, 0);

    return NextResponse.json({
      summary: { totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow },
      monthly: monthlyData,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
