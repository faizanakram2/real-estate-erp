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
