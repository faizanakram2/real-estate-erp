import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-payments
 * Customer sees their payment history with downloadable receipts
 */
export async function GET(request: NextRequest) {
  try {
    const customer = getCustomerSession(request);
    if (!customer) return customerUnauthorized();

    const bookingId = request.nextUrl.searchParams.get("bookingId");

    const where: any = { customerId: customer.customerId };
    if (bookingId) where.bookingId = bookingId;

    const payments = await prisma.paymentRecord.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
        installment: { select: { installmentNo: true, type: true } },
      },
      orderBy: { paymentDate: "desc" },
    });

    const formatted = payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      status: p.status,
      referenceNumber: p.referenceNumber,
      booking: p.booking,
      installment: p.installment,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
