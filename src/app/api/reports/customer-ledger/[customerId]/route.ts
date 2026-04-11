import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/customer-ledger/:customerId
 * Complete payment history and ledger for a customer
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, organizationId: session.user.organizationId },
      select: { id: true, firstName: true, lastName: true, phone: true, cnic: true },
    });
    if (!customer) return notFoundResponse("Customer");

    const bookings = await prisma.booking.findMany({
      where: { customerId: params.customerId },
      include: {
        plot: {
          select: { plotNumber: true, size: true, sizeUnit: true, project: { select: { name: true } }, block: { select: { name: true } } },
        },
        installments: { orderBy: { dueDate: "asc" } },
        paymentRecords: { orderBy: { paymentDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const ledger = bookings.map((b) => {
      const totalPaid = b.paymentRecords
        .filter((p) => p.status === "CONFIRMED")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalDue = Number(b.netAmount) - totalPaid;
      const paidInstallments = b.installments.filter((i) => i.status === "PAID").length;
      const overdueInstallments = b.installments.filter((i) => ["OVERDUE"].includes(i.status)).length;
      const totalPenalty = b.installments.reduce((sum, i) => sum + Number(i.latePenalty), 0);

      return {
        bookingNumber: b.bookingNumber,
        status: b.status,
        plot: b.plot,
        netAmount: Number(b.netAmount),
        totalPaid,
        totalDue,
        totalPenalty,
        installmentsSummary: {
          total: b.installments.length,
          paid: paidInstallments,
          overdue: overdueInstallments,
          pending: b.installments.filter((i) => i.status === "PENDING").length,
        },
        installments: b.installments.map((i) => ({
          no: i.installmentNo,
          type: i.type,
          amount: Number(i.amount),
          dueDate: i.dueDate,
          status: i.status,
          paidAmount: Number(i.paidAmount),
          paidDate: i.paidDate,
          penalty: Number(i.latePenalty),
          balance: Number(i.balanceAmount),
        })),
        payments: b.paymentRecords.map((p) => ({
          receiptNumber: p.receiptNumber,
          amount: Number(p.amount),
          method: p.paymentMethod,
          date: p.paymentDate,
          status: p.status,
          reference: p.referenceNumber,
        })),
      };
    });

    const grandTotal = ledger.reduce((sum, l) => sum + l.netAmount, 0);
    const grandPaid = ledger.reduce((sum, l) => sum + l.totalPaid, 0);
    const grandDue = ledger.reduce((sum, l) => sum + l.totalDue, 0);

    return NextResponse.json({
      customer,
      summary: { totalBookings: ledger.length, grandTotal, grandPaid, grandDue },
      ledger,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
