import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/collection-forecast
 * Expected vs actual collections for next 6 months
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const months = parseInt(request.nextUrl.searchParams.get("months") || "6");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const now = new Date();
    const forecast = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthLabel = monthStart.toLocaleString("default", { month: "short", year: "numeric" });

      const where: any = {
        dueDate: { gte: monthStart, lte: monthEnd },
        booking: {
          status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
          plot: { project: { organizationId: session.user.organizationId } },
        },
      };
      if (projectId) where.booking.plot.projectId = projectId;

      const [expected, collected] = await Promise.all([
        prisma.installment.aggregate({
          where,
          _sum: { amount: true },
          _count: true,
        }),
        prisma.installment.aggregate({
          where: { ...where, status: "PAID" },
          _sum: { paidAmount: true },
          _count: true,
        }),
      ]);

      forecast.push({
        month: monthLabel,
        expectedAmount: Number(expected._sum.amount || 0),
        expectedCount: expected._count,
        collectedAmount: Number(collected._sum.paidAmount || 0),
        collectedCount: collected._count,
        collectionRate: expected._count > 0
          ? Math.round((collected._count / expected._count) * 100)
          : 0,
      });
    }

    return NextResponse.json({ forecast });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
