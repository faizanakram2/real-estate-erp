import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/recovery-rate
 * Recovery rate by project and sales agent
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const months = parseInt(request.nextUrl.searchParams.get("months") || "6");
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    // Recovery by project
    const projects = await prisma.project.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true, name: true,
        plots: {
          select: {
            bookings: {
              where: { status: { in: ["BOOKED", "CONFIRMED", "ACTIVE", "DEFAULTER"] } },
              select: {
                netAmount: true,
                paymentRecords: {
                  where: { status: "CONFIRMED", paymentDate: { gte: cutoffDate } },
                  select: { amount: true },
                },
                installments: {
                  where: { dueDate: { lte: new Date() } },
                  select: { amount: true, paidAmount: true },
                },
              },
            },
          },
        },
      },
    });

    const byProject = projects.map((p) => {
      let totalExpected = 0;
      let totalCollected = 0;

      for (const plot of p.plots) {
        for (const booking of plot.bookings) {
          for (const inst of booking.installments) {
            totalExpected += Number(inst.amount);
            totalCollected += Number(inst.paidAmount);
          }
        }
      }

      return {
        projectId: p.id,
        projectName: p.name,
        totalExpected,
        totalCollected,
        recoveryRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
      };
    });

    // Recovery by sales agent
    const agents = await prisma.user.findMany({
      where: { organizationId: session.user.organizationId, role: "SALES_AGENT" },
      select: {
        id: true, name: true,
        bookingsCreated: {
          where: { status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] } },
          select: {
            netAmount: true,
            paymentRecords: {
              where: { status: "CONFIRMED" },
              select: { amount: true },
            },
          },
        },
      },
    });

    const byAgent = agents.map((a) => {
      const totalBooked = a.bookingsCreated.reduce((sum, b) => sum + Number(b.netAmount), 0);
      const totalCollected = a.bookingsCreated.reduce(
        (sum, b) => sum + b.paymentRecords.reduce((s, p) => s + Number(p.amount), 0), 0
      );
      return {
        agentId: a.id,
        agentName: a.name,
        totalBookings: a.bookingsCreated.length,
        totalBooked,
        totalCollected,
        recoveryRate: totalBooked > 0 ? Math.round((totalCollected / totalBooked) * 100) : 0,
      };
    });

    return NextResponse.json({ byProject, byAgent });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
