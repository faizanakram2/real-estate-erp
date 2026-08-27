import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/profit-loss?startDate=&endDate=
 * Profit & Loss statement
 */

/**
 * @swagger
 * /api/reports/profit-loss:
 *   get:
 *     summary: Get profit and loss report
 *     description: >
 *       Returns a Profit & Loss statement for the authenticated user's
 *       organization. The report includes confirmed payment income,
 *       income grouped by payment method, operational expenses,
 *       payroll expenses, commission expenses, expenses grouped by category,
 *       net profit, and profit margin.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date of the reporting period. Defaults to January 1 of the current year.
 *         example: "2026-01-01T00:00:00.000Z"
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date of the reporting period. Defaults to the current date and time.
 *         example: "2026-08-27T23:59:59.000Z"
 *     responses:
 *       200:
 *         description: Profit and loss report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                   properties:
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-01-01T00:00:00.000Z"
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-08-27T23:59:59.000Z"
 *                 income:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       format: double
 *                       example: 12500000
 *                     transactionCount:
 *                       type: integer
 *                       example: 145
 *                     byMethod:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           method:
 *                             type: string
 *                             example: "BANK_TRANSFER"
 *                           amount:
 *                             type: number
 *                             format: double
 *                             example: 7500000
 *                           count:
 *                             type: integer
 *                             example: 85
 *                 expenses:
 *                   type: object
 *                   properties:
 *                     operational:
 *                       type: number
 *                       format: double
 *                       example: 2500000
 *                     payroll:
 *                       type: number
 *                       format: double
 *                       example: 1800000
 *                     commissions:
 *                       type: number
 *                       format: double
 *                       example: 900000
 *                     total:
 *                       type: number
 *                       format: double
 *                       example: 5200000
 *                     byCategory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             example: "CONSTRUCTION"
 *                           amount:
 *                             type: number
 *                             format: double
 *                             example: 1500000
 *                           count:
 *                             type: integer
 *                             example: 25
 *                 netProfit:
 *                   type: number
 *                   format: double
 *                   example: 7300000
 *                 profitMargin:
 *                   type: number
 *                   format: double
 *                   example: 58
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const orgId = session.user.organizationId;
    const startDate = request.nextUrl.searchParams.get("startDate")
      ? new Date(request.nextUrl.searchParams.get("startDate")!)
      : new Date(new Date().getFullYear(), 0, 1); // Jan 1 of current year
    const endDate = request.nextUrl.searchParams.get("endDate")
      ? new Date(request.nextUrl.searchParams.get("endDate")!)
      : new Date();

    // Income: confirmed payments
    const income = await prisma.paymentRecord.aggregate({
      where: {
        status: "CONFIRMED",
        paymentDate: { gte: startDate, lte: endDate },
        booking: { plot: { project: { organizationId: orgId } } },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Income by method
    const incomeByMethod = await prisma.paymentRecord.groupBy({
      by: ["paymentMethod"],
      where: {
        status: "CONFIRMED",
        paymentDate: { gte: startDate, lte: endDate },
        booking: { plot: { project: { organizationId: orgId } } },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Expenses
    const expenses = await prisma.transaction.aggregate({
      where: {
        type: "EXPENSE",
        date: { gte: startDate, lte: endDate },
        OR: [
          { project: { organizationId: orgId } },
          { vendor: { organizationId: orgId } },
        ],
      },
      _sum: { amount: true },
      _count: true,
    });

    // Expenses by category
    const expensesByCategory = await prisma.transaction.groupBy({
      by: ["category"],
      where: {
        type: "EXPENSE",
        date: { gte: startDate, lte: endDate },
        OR: [
          { project: { organizationId: orgId } },
          { vendor: { organizationId: orgId } },
        ],
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // Payroll expenses
    const payroll = await prisma.payroll.aggregate({
      where: {
        status: "PAID",
        employee: { organizationId: orgId },
        paidDate: { gte: startDate, lte: endDate },
      },
      _sum: { netSalary: true },
      _count: true,
    });

    // Commissions
    const commissions = await prisma.commission.aggregate({
      where: {
        status: "PAID",
        agent: { organizationId: orgId },
        paidDate: { gte: startDate, lte: endDate },
      },
      _sum: { commissionAmount: true },
    });

    const totalIncome = Number(income._sum.amount || 0);
    const totalExpenses = Number(expenses._sum.amount || 0) + Number(payroll._sum.netSalary || 0) + Number(commissions._sum.commissionAmount || 0);
    const netProfit = totalIncome - totalExpenses;

    return NextResponse.json({
      period: { startDate, endDate },
      income: {
        total: totalIncome,
        transactionCount: income._count,
        byMethod: incomeByMethod.map((m) => ({
          method: m.paymentMethod,
          amount: Number(m._sum.amount || 0),
          count: m._count,
        })),
      },
      expenses: {
        operational: Number(expenses._sum.amount || 0),
        payroll: Number(payroll._sum.netSalary || 0),
        commissions: Number(commissions._sum.commissionAmount || 0),
        total: totalExpenses,
        byCategory: expensesByCategory.map((c) => ({
          category: c.category,
          amount: Number(c._sum.amount || 0),
          count: c._count,
        })),
      },
      netProfit,
      profitMargin: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
