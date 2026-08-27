import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, customerUnauthorized } from "@/lib/customer-auth";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customer-portal/my-bookings
 * Customer sees their own bookings with plot details
 */

/**
 * @swagger
 * /api/customer-portal/my-bookings:
 *   get:
 *     tags:
 *       - Customer Portal
 *     summary: Get customer bookings
 *     description: >
 *       Returns all bookings belonging to the authenticated customer.
 *       Each booking includes plot details, project information, block information,
 *       installment plan details, net amount, and monthly installment amount.
 *
 *       Requires a valid Customer Portal JWT token.
 *     security:
 *       - CustomerPortalAuth: []
 *
 *     responses:
 *       200:
 *         description: Customer bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   bookingNumber:
 *                     type: string
 *                     example: "BK-2026-0001"
 *
 *                   status:
 *                     type: string
 *                     example: "ACTIVE"
 *
 *                   bookingDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-20T10:30:00.000Z"
 *
 *                   plot:
 *                     type: object
 *                     properties:
 *                       plotNumber:
 *                         type: string
 *                         example: "A-101"
 *
 *                       type:
 *                         type: string
 *                         example: "RESIDENTIAL"
 *
 *                       size:
 *                         type: number
 *                         example: 10
 *
 *                       sizeUnit:
 *                         type: string
 *                         example: "MARLA"
 *
 *                       facingDirection:
 *                         type: string
 *                         nullable: true
 *                         example: "EAST"
 *
 *                       project:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Green Valley Housing Society"
 *
 *                           city:
 *                             type: string
 *                             example: "Lahore"
 *
 *                       block:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Block A"
 *
 *                   installmentPlan:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "3 Year Installment Plan"
 *
 *                       durationMonths:
 *                         type: integer
 *                         example: 36
 *
 *                   netAmount:
 *                     type: number
 *                     example: 5000000
 *
 *                   monthlyInstallment:
 *                     type: number
 *                     nullable: true
 *                     example: 138889
 *
 *       401:
 *         description: Unauthorized - Customer portal authentication token is missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
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
