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

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking details
 *     description: |
 *       Retrieves complete details for a specific booking.
 *
 *       The response includes:
 *       - Customer information
 *       - Plot information
 *       - Project and block information
 *       - Installments
 *       - Payment records
 *       - Documents
 *       - Installment plan
 *       - Booking creator
 *       - Payment and overdue summary
 *
 *     tags:
 *       - Bookings
 *
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Booking ID.
 *         schema:
 *           type: string
 *         example: clxbooking123
 *
 *     responses:
 *       200:
 *         description: Booking retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clxbooking123
 *
 *                 bookingNumber:
 *                   type: string
 *                   example: BK-2026-0001
 *
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *
 *                 totalPrice:
 *                   type: number
 *                   example: 5000000
 *
 *                 bookingAmount:
 *                   type: number
 *                   example: 500000
 *
 *                 downPayment:
 *                   type: number
 *                   example: 1000000
 *
 *                 netAmount:
 *                   type: number
 *                   example: 5000000
 *
 *                 customer:
 *                   type: object
 *
 *                 plot:
 *                   type: object
 *
 *                 installments:
 *                   type: array
 *                   items:
 *                     type: object
 *
 *                 paymentRecords:
 *                   type: array
 *                   items:
 *                     type: object
 *
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *
 *                 installmentPlan:
 *                   type: object
 *                   nullable: true
 *
 *                 createdBy:
 *                   type: object
 *
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalPaid:
 *                       type: number
 *                       example: 1500000
 *
 *                     totalDue:
 *                       type: number
 *                       example: 3500000
 *
 *                     overdueCount:
 *                       type: integer
 *                       example: 2
 *
 *                     overdueAmount:
 *                       type: number
 *                       example: 200000
 *
 *       401:
 *         description: Unauthorized.
 *
 *       404:
 *         description: Booking not found.
 *
 *       500:
 *         description: Internal server error.
 *
 *   delete:
 *     summary: Cancel booking
 *     description: |
 *       Cancels an existing booking.
 *
 *       The booking must have one of the following statuses:
 *       - BOOKED
 *       - CONFIRMED
 *       - ACTIVE
 *
 *       When a booking is cancelled:
 *       - Booking status becomes CANCELLED
 *       - Cancellation date is recorded
 *       - The plot becomes AVAILABLE again
 *       - Pending and partial installments become WAIVED
 *
 *     tags:
 *       - Bookings
 *
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Booking ID to cancel.
 *         schema:
 *           type: string
 *         example: clxbooking123
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancellationReason
 *             properties:
 *               cancellationReason:
 *                 type: string
 *                 example: Customer requested cancellation
 *
 *               refundAmount:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 400000
 *
 *               deductionAmount:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 100000
 *
 *     responses:
 *       200:
 *         description: Booking cancelled successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Booking cancelled
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized.
 *
 *       404:
 *         description: Booking not found or cannot be cancelled.
 *
 *       500:
 *         description: Internal server error.
 *
 *   put:
 *     summary: Transfer booking to another customer
 *     description: |
 *       Transfers an existing booking to another customer in the same organization.
 *
 *       The original booking must have one of the following statuses:
 *       - BOOKED
 *       - CONFIRMED
 *       - ACTIVE
 *
 *       When transferred:
 *       - Original booking status becomes TRANSFERRED
 *       - A new ACTIVE booking is created for the new customer
 *       - Remaining balance is calculated using confirmed payments
 *       - The plot status becomes TRANSFERRED
 *
 *     tags:
 *       - Bookings
 *
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Existing booking ID to transfer.
 *         schema:
 *           type: string
 *         example: clxbooking123
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newCustomerId
 *             properties:
 *               newCustomerId:
 *                 type: string
 *                 description: ID of the customer receiving the transferred booking.
 *                 example: clxnewcustomer123
 *
 *               transferFee:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 50000
 *
 *               notes:
 *                 type: string
 *                 example: Booking transferred to new customer.
 *
 *     responses:
 *       200:
 *         description: Booking transferred successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Booking transferred successfully
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized.
 *
 *       404:
 *         description: Booking or new customer not found.
 *
 *       500:
 *         description: Internal server error.
 */


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
