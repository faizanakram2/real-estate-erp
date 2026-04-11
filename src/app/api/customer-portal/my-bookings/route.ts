import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-bookings
 * Customer sees their own bookings with plot details
 */
export async function GET(request: NextRequest) {
  try {
    const customer = getCustomerSession(request);
    if (!customer) return customerUnauthorized();

    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.customerId },
      include: {
        plot: {
          select: {
            plotNumber: true, type: true, size: true, sizeUnit: true,
            facingDirection: true,
            project: { select: { name: true, city: true } },
            block: { select: { name: true } },
          },
        },
        installmentPlan: { select: { name: true, durationMonths: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = bookings.map((b) => {
      return {
        bookingNumber: b.bookingNumber,
        status: b.status,
        bookingDate: b.bookingDate,
        plot: b.plot,
        installmentPlan: b.installmentPlan,
        netAmount: Number(b.netAmount),
        monthlyInstallment: b.monthlyInstallment ? Number(b.monthlyInstallment) : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
