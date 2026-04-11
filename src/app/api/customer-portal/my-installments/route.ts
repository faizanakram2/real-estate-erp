import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-installments
 * Customer sees their installment schedule with payment status
 */
export async function GET(request: NextRequest) {
  try {
    const customer = getCustomerSession(request);
    if (!customer) return customerUnauthorized();

    const bookingId = request.nextUrl.searchParams.get("bookingId");

    const where: any = {
      booking: { customerId: customer.customerId },
    };
    if (bookingId) where.bookingId = bookingId;

    const installments = await prisma.installment.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const summary = {
      total: installments.length,
      paid: installments.filter((i) => i.status === "PAID").length,
      pending: installments.filter((i) => i.status === "PENDING").length,
      overdue: installments.filter((i) => i.status === "OVERDUE").length,
      totalAmount: installments.reduce((sum, i) => sum + Number(i.amount), 0),
      totalPaid: installments.reduce((sum, i) => sum + Number(i.paidAmount), 0),
      totalBalance: installments.reduce((sum, i) => sum + Number(i.balanceAmount), 0),
      totalPenalty: installments.reduce((sum, i) => sum + Number(i.latePenalty), 0),
      nextDue: installments.find((i) => ["PENDING", "PARTIAL"].includes(i.status)),
    };

    return NextResponse.json({ summary, installments });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
