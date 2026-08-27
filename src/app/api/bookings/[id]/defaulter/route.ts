import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/bookings/:id/defaulter
 * Mark a booking as DEFAULTER (manual trigger)
 */

/**
 * @swagger
 * /api/bookings/{id}/defaulter:
 *   post:
 *     tags:
 *       - Bookings
 *     summary: Mark a booking as defaulter
 *     description: Manually marks a booking and its associated customer as DEFAULTER.
 *     security:
 *       - NextAuthSession: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Customer has missed multiple installment payments
 *     responses:
 *       200:
 *         description: Booking successfully marked as defaulter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *
 *   put:
 *     tags:
 *       - Bookings
 *     summary: Automatically detect and flag defaulters
 *     description: Marks bookings with 3 or more overdue installments as DEFAULTER.
 *     security:
 *       - NextAuthSession: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: bulk-check
 *     responses:
 *       200:
 *         description: Defaulter detection completed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("bookings:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        plot: { project: { organizationId: session.user.organizationId } },
      },
    });
    if (!booking) return notFoundResponse("Booking");

    const { reason } = await request.json();

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: params.id },
        data: { status: "DEFAULTER", notes: `Marked as defaulter: ${reason || "Multiple missed installments"}` },
      });

      await tx.customer.update({
        where: { id: booking.customerId },
        data: { status: "DEFAULTER" },
      });
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Booking",
      entityId: params.id,
      changes: { action: "mark_defaulter", reason },
    });

    return NextResponse.json({ message: "Booking marked as defaulter" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/bookings/defaulter (handled via parent route filter)
 * But we also provide a dedicated bulk-check endpoint:
 * POST with no body = auto-detect defaulters (3+ overdue installments)
 */
export async function PUT(_request: NextRequest) {
  try {
    const auth = await authorize("bookings:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    // Find bookings with 3+ overdue installments
    const bookingsWithOverdue = await prisma.booking.findMany({
      where: {
        status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
        plot: { project: { organizationId: session.user.organizationId } },
      },
      include: {
        installments: {
          where: {
            status: "OVERDUE",
          },
        },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        plot: { select: { plotNumber: true, project: { select: { name: true } } } },
      },
    });

    const defaulters = bookingsWithOverdue.filter((b) => b.installments.length >= 3);

    // Mark them
    let markedCount = 0;
    for (const booking of defaulters) {
      if (booking.status !== "DEFAULTER") {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "DEFAULTER", notes: `Auto-flagged: ${booking.installments.length} overdue installments` },
          });
          await tx.customer.update({
            where: { id: booking.customerId },
            data: { status: "DEFAULTER" },
          });
        });
        markedCount++;
      }
    }

    const defaulterList = defaulters.map((b) => ({
      bookingNumber: b.bookingNumber,
      customer: b.customer,
      plot: b.plot,
      overdueCount: b.installments.length,
      totalOverdue: b.installments.reduce((sum, i) => sum + Number(i.balanceAmount), 0),
    }));

    return NextResponse.json({
      message: `${markedCount} new defaulters flagged`,
      totalDefaulters: defaulters.length,
      newlyFlagged: markedCount,
      defaulters: defaulterList,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
