import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse, validationErrorResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const settlementSchema = z.object({
  discountPercent: z.number().min(0).max(50).default(0),
  notes: z.string().optional(),
});

/**
 * GET /api/bookings/:id/early-settlement
 * Calculate early settlement amount with optional discount
 */


/**
 * @swagger
 * /api/bookings/{id}/early-settlement:
 *   get:
 *     tags:
 *       - Bookings
 *     summary: Calculate early settlement amount
 *     description: >
 *       Calculates the remaining settlement amount for a booking.
 *       An optional discount percentage can be applied.
 *       Requires the bookings:read permission.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Booking ID
 *         schema:
 *           type: string
 *         example: "booking-id-here"
 *
 *       - in: query
 *         name: discountPercent
 *         required: false
 *         description: Discount percentage to apply to the remaining amount
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 50
 *           default: 0
 *         example: 10
 *
 *     responses:
 *       200:
 *         description: Early settlement calculation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookingNumber:
 *                   type: string
 *                   example: "BK-2026-0001"
 *                 netAmount:
 *                   type: number
 *                   example: 5000000
 *                 totalPaid:
 *                   type: number
 *                   example: 2000000
 *                 remainingAmount:
 *                   type: number
 *                   example: 3000000
 *                 totalPenalties:
 *                   type: number
 *                   example: 50000
 *                 pendingInstallments:
 *                   type: integer
 *                   example: 12
 *                 discountPercent:
 *                   type: number
 *                   example: 10
 *                 discountAmount:
 *                   type: number
 *                   example: 300000
 *                 settlementAmount:
 *                   type: number
 *                   example: 2750000
 *
 *       401:
 *         description: Unauthorized - Authentication required
 *
 *       403:
 *         description: Forbidden - User does not have bookings read permission
 *
 *       404:
 *         description: Booking not found
 *
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     tags:
 *       - Bookings
 *     summary: Complete early settlement
 *     description: >
 *       Completes the early settlement process for a booking.
 *       All pending, partial, and overdue installments are marked as PAID,
 *       and the associated plot is marked as SOLD.
 *       Requires the bookings:write permission.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Booking ID
 *         schema:
 *           type: string
 *         example: "booking-id-here"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discountPercent:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 50
 *                 default: 0
 *                 description: Discount percentage applied to settlement
 *                 example: 10
 *               notes:
 *                 type: string
 *                 description: Optional notes for the early settlement
 *                 example: "Customer completed full payment before schedule"
 *
 *     responses:
 *       200:
 *         description: Early settlement completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Early settlement completed successfully"
 *
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 *       401:
 *         description: Unauthorized - Authentication required
 *
 *       403:
 *         description: Forbidden - User does not have bookings write permission
 *
 *       404:
 *         description: Booking not found
 *
 *       500:
 *         description: Internal server error
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("bookings:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const discountPercent = parseFloat(request.nextUrl.searchParams.get("discountPercent") || "0");

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
        plot: { project: { organizationId: session.user.organizationId } },
      },
      include: {
        installments: true,
        paymentRecords: { where: { status: "CONFIRMED" } },
      },
    });
    if (!booking) return notFoundResponse("Booking");

    const totalPaid = booking.paymentRecords.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingAmount = Number(booking.netAmount) - totalPaid;
    const totalPenalties = booking.installments.reduce((sum, i) => sum + Number(i.latePenalty), 0);
    const pendingInstallments = booking.installments.filter(
      (i) => ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status)
    ).length;

    const discountAmount = Math.round(remainingAmount * (discountPercent / 100));
    const settlementAmount = remainingAmount - discountAmount + totalPenalties;

    return NextResponse.json({
      bookingNumber: booking.bookingNumber,
      netAmount: Number(booking.netAmount),
      totalPaid,
      remainingAmount,
      totalPenalties,
      pendingInstallments,
      discountPercent,
      discountAmount,
      settlementAmount,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/bookings/:id/early-settlement
 * Execute early settlement — mark all pending installments as paid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("bookings:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = settlementSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
        plot: { project: { organizationId: session.user.organizationId } },
      },
      include: { installments: true },
    });
    if (!booking) return notFoundResponse("Booking");

    await prisma.$transaction(async (tx) => {
      // Mark all pending installments as PAID
      await tx.installment.updateMany({
        where: {
          bookingId: params.id,
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
        data: {
          status: "PAID",
          paidDate: new Date(),
          notes: `Early settlement — discount: ${parsed.data.discountPercent}%`,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: params.id },
        data: { status: "ACTIVE", notes: `Early settlement completed. ${parsed.data.notes || ""}` },
      });

      // Update plot status to SOLD
      await tx.plot.update({
        where: { id: booking.plotId },
        data: { status: "SOLD" },
      });
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Booking",
      entityId: params.id,
      changes: { action: "early_settlement", discountPercent: parsed.data.discountPercent },
    });

    return NextResponse.json({ message: "Early settlement completed successfully" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
