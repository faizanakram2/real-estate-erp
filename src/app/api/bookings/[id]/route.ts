import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import {
  cancelBookingSchema,
  transferBookingSchema,
} from "@/lib/validators/booking";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        plot: { project: { organizationId: session.user.organizationId } },
      },
      include: {
        customer: true,
        plot: {
          include: {
            project: { select: { id: true, name: true } },
            block: { select: { id: true, name: true } },
          },
        },
        installments: { orderBy: { dueDate: "asc" } },
        paymentRecords: { orderBy: { paymentDate: "desc" } },
        documents: true,
        installmentPlan: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!booking) return notFoundResponse("Booking");

    // Calculate summary
    const totalPaid = booking.paymentRecords
      .filter((p) => p.status === "CONFIRMED")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalDue = Number(booking.netAmount) - totalPaid;
    const overdueInstallments = booking.installments.filter(
      (i) => i.status === "OVERDUE" || (i.status === "PENDING" && new Date(i.dueDate) < new Date())
    );

    return NextResponse.json({
      ...booking,
      summary: {
        totalPaid,
        totalDue,
        overdueCount: overdueInstallments.length,
        overdueAmount: overdueInstallments.reduce(
          (sum, i) => sum + Number(i.balanceAmount),
          0
        ),
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// Cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = cancelBookingSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        plot: { project: { organizationId: session.user.organizationId } },
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
      },
    });
    if (!booking) return notFoundResponse("Booking");

    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: params.id },
        data: {
          status: "CANCELLED",
          cancellationDate: new Date(),
          cancellationReason: data.cancellationReason,
          refundAmount: data.refundAmount,
          deductionAmount: data.deductionAmount,
        },
      });

      // Release plot
      await tx.plot.update({
        where: { id: booking.plotId },
        data: { status: "AVAILABLE" },
      });

      // Cancel pending installments
      await tx.installment.updateMany({
        where: {
          bookingId: params.id,
          status: { in: ["PENDING", "PARTIAL"] },
        },
        data: { status: "WAIVED" },
      });
    });

    return NextResponse.json({ message: "Booking cancelled" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// Transfer booking
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = transferBookingSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        plot: { project: { organizationId: session.user.organizationId } },
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
      },
    });
    if (!booking) return notFoundResponse("Booking");

    const data = parsed.data;

    // Verify new customer
    const newCustomer = await prisma.customer.findFirst({
      where: {
        id: data.newCustomerId,
        organizationId: session.user.organizationId,
      },
    });
    if (!newCustomer) {
      return NextResponse.json(
        { error: "New customer not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mark old booking as transferred
      await tx.booking.update({
        where: { id: params.id },
        data: {
          status: "TRANSFERRED",
          isTransferred: true,
          transferDate: new Date(),
          transferFee: data.transferFee,
        },
      });

      // Create new booking for new customer with remaining balance
      const paidAmount = await tx.paymentRecord.aggregate({
        where: { bookingId: params.id, status: "CONFIRMED" },
        _sum: { amount: true },
      });

      const remaining =
        Number(booking.netAmount) - Number(paidAmount._sum.amount || 0);

      await tx.booking.create({
        data: {
          bookingNumber: `TR-${booking.bookingNumber}`,
          customerId: data.newCustomerId,
          plotId: booking.plotId,
          createdById: session.user.id,
          status: "ACTIVE",
          totalPrice: booking.totalPrice,
          bookingAmount: 0,
          downPayment: 0,
          netAmount: remaining,
          transferredFrom: params.id,
          notes: data.notes,
        },
      });

      // Update plot status
      await tx.plot.update({
        where: { id: booking.plotId },
        data: { status: "TRANSFERRED" },
      });
    });

    return NextResponse.json({ message: "Booking transferred successfully" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
