import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/installments/overdue
 * Marks all past-due installments as OVERDUE and calculates late penalties.
 * Should be called daily via cron or manually by admin/accountant.
 */

/**
 * @swagger
 * /api/installments/overdue:
 *   post:
 *     summary: Mark overdue installments
 *     description: |
 *       Finds all pending or partially paid installments whose due date has
 *       passed and marks them as OVERDUE.
 *
 *       Late penalties are calculated using the late penalty percentage
 *       configured on the installment plan. The penalty is calculated based
 *       on the outstanding balance and the number of months overdue.
 *
 *       This endpoint is intended to be called daily through a cron job
 *       or manually by an authorized administrator/accountant.
 *     tags:
 *       - Installments
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Overdue installments processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "5 installments marked as overdue"
 *
 *                 markedCount:
 *                   type: integer
 *                   example: 5
 *                   description: Number of installments marked as overdue.
 *
 *                 penaltyTotal:
 *                   type: number
 *                   format: double
 *                   example: 12500
 *                   description: Total late penalty calculated for all processed installments.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the installments:write permission.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(_request: NextRequest) {
  try {
    const auth = await authorize("installments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const now = new Date();

    // Find all pending/partial installments past due date
    const overdueInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lt: now },
        booking: {
          status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
      include: {
        booking: {
          include: {
            installmentPlan: true,
          },
        },
      },
    });

    let markedCount = 0;
    let penaltyTotal = 0;

    for (const inst of overdueInstallments) {
      const plan = inst.booking.installmentPlan;
      const penaltyPercent = plan?.latePenaltyPercent || 0;

      // Calculate days overdue
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate penalty: (balance * penaltyPercent / 100) per month overdue
      const monthsOverdue = Math.max(1, Math.ceil(daysOverdue / 30));
      const balanceAmount = Number(inst.balanceAmount) || Number(inst.amount) - Number(inst.paidAmount);
      const penalty = penaltyPercent > 0
        ? Math.round(balanceAmount * (penaltyPercent / 100) * monthsOverdue)
        : 0;

      await prisma.installment.update({
        where: { id: inst.id },
        data: {
          status: "OVERDUE",
          latePenalty: penalty,
          balanceAmount: balanceAmount,
        },
      });

      markedCount++;
      penaltyTotal += penalty;
    }

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Installment",
      entityId: "bulk-overdue",
      changes: { markedCount, penaltyTotal },
    });

    return NextResponse.json({
      message: `${markedCount} installments marked as overdue`,
      markedCount,
      penaltyTotal,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/installments/overdue
 * Get all overdue installments with customer details for follow-up
 */

/**
 * @swagger
 * /api/installments/overdue:
 *   get:
 *     summary: Get overdue installments
 *     description: |
 *       Returns all overdue installments for the authenticated user's
 *       organization, including customer, booking, project, and plot details.
 *
 *       The response also contains an aging summary grouped into:
 *       0-30 days, 31-60 days, 61-90 days, and 90+ days.
 *
 *       The optional aging parameter can be used to return installments
 *       that are older than the specified number of days.
 *     tags:
 *       - Installments
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: aging
 *         required: false
 *         schema:
 *           type: integer
 *           enum:
 *             - 30
 *             - 60
 *             - 90
 *         description: |
 *           Return installments whose due date is older than the specified
 *           number of days.
 *         example: 30
 *
 *     responses:
 *       200:
 *         description: Overdue installments retrieved successfully.
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
 *                       example: 25
 *                       description: Total number of overdue installments.
 *
 *                     totalAmount:
 *                       type: number
 *                       format: double
 *                       example: 450000
 *                       description: Total outstanding balance.
 *
 *                     totalPenalty:
 *                       type: number
 *                       format: double
 *                       example: 25000
 *                       description: Total late penalty.
 *
 *                     aging:
 *                       type: object
 *                       properties:
 *                         0-30:
 *                           type: integer
 *                           example: 10
 *
 *                         31-60:
 *                           type: integer
 *                           example: 7
 *
 *                         61-90:
 *                           type: integer
 *                           example: 5
 *
 *                         90+:
 *                           type: integer
 *                           example: 3
 *
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "inst_123"
 *
 *                       bookingId:
 *                         type: string
 *                         example: "booking_123"
 *
 *                       installmentNo:
 *                         type: integer
 *                         example: 5
 *
 *                       type:
 *                         type: string
 *                         example: "MONTHLY"
 *
 *                       amount:
 *                         type: number
 *                         format: double
 *                         example: 50000
 *
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-07-01T00:00:00.000Z"
 *
 *                       status:
 *                         type: string
 *                         enum:
 *                           - PENDING
 *                           - PARTIAL
 *                           - OVERDUE
 *                         example: "OVERDUE"
 *
 *                       paidAmount:
 *                         type: number
 *                         format: double
 *                         example: 10000
 *
 *                       paidDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *
 *                       latePenalty:
 *                         type: number
 *                         format: double
 *                         example: 1000
 *
 *                       balanceAmount:
 *                         type: number
 *                         format: double
 *                         example: 41000
 *
 *                       booking:
 *                         type: object
 *                         properties:
 *                           bookingNumber:
 *                             type: string
 *                             example: "BK-2026-00125"
 *
 *                           customer:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "customer_123"
 *
 *                               firstName:
 *                                 type: string
 *                                 example: "Ahmed"
 *
 *                               lastName:
 *                                 type: string
 *                                 example: "Khan"
 *
 *                               phone:
 *                                 type: string
 *                                 example: "+923001234567"
 *
 *                               cnic:
 *                                 type: string
 *                                 nullable: true
 *                                 example: "35202-1234567-1"
 *
 *                           plot:
 *                             type: object
 *                             properties:
 *                               plotNumber:
 *                                 type: string
 *                                 example: "A-102"
 *
 *                               project:
 *                                 type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Green Valley Housing"
 *
 *                               block:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Block A"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the installments:read permission.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("installments:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const agingBucket = request.nextUrl.searchParams.get("aging"); // 30, 60, 90

    const now = new Date();
    const where: any = {
      status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
      dueDate: { lt: now },
      booking: {
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
        plot: { project: { organizationId: session.user.organizationId } },
      },
    };

    // Aging bucket filter
    if (agingBucket) {
      const days = parseInt(agingBucket);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      where.dueDate = { lt: cutoff };
    }

    const overdues = await prisma.installment.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            customer: {
              select: { id: true, firstName: true, lastName: true, phone: true, cnic: true },
            },
            plot: {
              select: {
                plotNumber: true,
                project: { select: { name: true } },
                block: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Group by aging buckets
    const summary = {
      total: overdues.length,
      totalAmount: overdues.reduce((sum, i) => sum + Number(i.balanceAmount), 0),
      totalPenalty: overdues.reduce((sum, i) => sum + Number(i.latePenalty), 0),
      aging: {
        "0-30": overdues.filter((i) => {
          const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
          return days <= 30;
        }).length,
        "31-60": overdues.filter((i) => {
          const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
          return days > 30 && days <= 60;
        }).length,
        "61-90": overdues.filter((i) => {
          const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
          return days > 60 && days <= 90;
        }).length,
        "90+": overdues.filter((i) => {
          const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
          return days > 90;
        }).length,
      },
    };

    return NextResponse.json({ summary, data: overdues });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
