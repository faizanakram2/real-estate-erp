import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/collection-forecast
 * Expected vs actual collections for next 6 months
 */

/**
 * @swagger
 * /api/reports/collection-forecast:
 *   get:
 *     summary: Get collection forecast
 *     description: >
 *       Returns the expected versus actual installment collections for the
 *       upcoming months. The report includes expected collection amounts,
 *       collected amounts, installment counts, and collection rates.
 *       Optionally, the forecast can be filtered by project.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         required: false
 *         description: Number of upcoming months to include in the forecast
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 6
 *           example: 6
 *       - in: query
 *         name: projectId
 *         required: false
 *         description: Filter the collection forecast by a specific project ID
 *         schema:
 *           type: string
 *           example: "clx1234567890abcdef"
 *     responses:
 *       200:
 *         description: Collection forecast generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 forecast:
 *                   type: array
 *                   description: Monthly collection forecast
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         description: Month and year of the forecast
 *                         example: "Sep 2026"
 *                       expectedAmount:
 *                         type: number
 *                         description: Total installment amount expected during the month
 *                         example: 5000000
 *                       expectedCount:
 *                         type: integer
 *                         description: Number of installments expected during the month
 *                         example: 25
 *                       collectedAmount:
 *                         type: number
 *                         description: Total amount collected from paid installments
 *                         example: 3500000
 *                       collectedCount:
 *                         type: integer
 *                         description: Number of paid installments
 *                         example: 18
 *                       collectionRate:
 *                         type: number
 *                         description: Percentage of expected installments that have been collected
 *                         example: 72
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
