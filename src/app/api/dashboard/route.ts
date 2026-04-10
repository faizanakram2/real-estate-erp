import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const orgId = session.user.organizationId;

    const [
      projectCount,
      customerCount,
      plotStats,
      bookingStats,
      recentPayments,
      overdueInstallments,
      collectionThisMonth,
    ] = await Promise.all([
      // Total projects
      prisma.project.count({
        where: { organizationId: orgId, status: { not: "COMPLETED" } },
      }),

      // Total customers
      prisma.customer.count({
        where: { organizationId: orgId, status: "ACTIVE" },
      }),

      // Plot statistics
      prisma.plot.groupBy({
        by: ["status"],
        where: { project: { organizationId: orgId } },
        _count: true,
      }),

      // Booking statistics
      prisma.booking.groupBy({
        by: ["status"],
        where: {
          plot: { project: { organizationId: orgId } },
        },
        _count: true,
        _sum: { netAmount: true },
      }),

      // Recent payments (last 10)
      prisma.paymentRecord.findMany({
        where: {
          booking: {
            plot: { project: { organizationId: orgId } },
          },
        },
        include: {
          customer: {
            select: { firstName: true, lastName: true },
          },
          booking: {
            select: {
              bookingNumber: true,
              plot: {
                select: {
                  plotNumber: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Overdue installments
      prisma.installment.findMany({
        where: {
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { lt: new Date() },
          booking: {
            status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
            plot: { project: { organizationId: orgId } },
          },
        },
        include: {
          booking: {
            select: {
              bookingNumber: true,
              customer: {
                select: { firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),

      // This month's collections
      prisma.paymentRecord.aggregate({
        where: {
          status: "CONFIRMED",
          paymentDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          booking: {
            plot: { project: { organizationId: orgId } },
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Format plot stats
    const plotSummary: Record<string, number> = {};
    plotStats.forEach((s) => {
      plotSummary[s.status] = s._count;
    });

    // Format booking stats
    const bookingSummary: Record<string, { count: number; amount: number }> =
      {};
    bookingStats.forEach((s) => {
      bookingSummary[s.status] = {
        count: s._count,
        amount: Number(s._sum.netAmount || 0),
      };
    });

    return NextResponse.json({
      stats: {
        projects: projectCount,
        customers: customerCount,
        plots: plotSummary,
        bookings: bookingSummary,
        monthlyCollection: {
          amount: Number(collectionThisMonth._sum.amount || 0),
          count: collectionThisMonth._count,
        },
      },
      recentPayments,
      overdueInstallments,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
