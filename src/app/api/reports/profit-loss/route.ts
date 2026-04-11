import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/profit-loss?startDate=&endDate=
 * Profit & Loss statement
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
