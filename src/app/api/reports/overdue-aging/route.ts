import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/overdue-aging
 * Overdue aging report: 30/60/90+ day buckets
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
