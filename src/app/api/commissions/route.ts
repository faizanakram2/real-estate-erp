import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, getPaginationParams } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createCommissionSchema = z.object({
  bookingId: z.string().min(1),
  agentId: z.string().min(1),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  rate: z.number().positive(),
});

/**
 * @swagger
 * /api/commissions:
 *   get:
 *     tags:
 *       - Commissions
 *     summary: Get commissions
 *     description: >
 *       Retrieves a paginated list of commission records for the authenticated
 *       user's organization. Supports filtering by agent ID and commission status.
 *       Also returns a commission summary including total, pending, and paid amounts.
 *       Requires the `payments:read` permission.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number for pagination.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of commission records per page.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *           example: 10
 *
 *       - in: query
 *         name: agentId
 *         required: false
 *         description: Filter commissions by agent ID.
 *         schema:
 *           type: string
 *           example: "agent-id-here"
 *
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter commissions by status.
 *         schema:
 *           type: string
 *           example: "PENDING"
 *
 *     responses:
 *       200:
 *         description: Commission records retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "commission-id"
 *
 *                       bookingId:
 *                         type: string
 *                         example: "booking-id"
 *
 *                       agentId:
 *                         type: string
 *                         example: "agent-id"
 *
 *                       commissionType:
 *                         type: string
 *                         enum:
 *                           - PERCENTAGE
 *                           - FIXED
 *                         example: "PERCENTAGE"
 *
 *                       rate:
 *                         type: number
 *                         example: 5
 *
 *                       baseAmount:
 *                         type: number
 *                         example: 5000000
 *
 *                       commissionAmount:
 *                         type: number
 *                         example: 250000
 *
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *
 *                       agent:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "agent-id"
 *
 *                           name:
 *                             type: string
 *                             example: "Ahmed Khan"
 *
 *                       booking:
 *                         type: object
 *                         properties:
 *                           bookingNumber:
 *                             type: string
 *                             example: "BK-2026-0001"
 *
 *                           netAmount:
 *                             type: number
 *                             example: 5000000
 *
 *                           customer:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                                 example: "Ali"
 *
 *                               lastName:
 *                                 type: string
 *                                 example: "Khan"
 *
 *                           plot:
 *                             type: object
 *                             properties:
 *                               plotNumber:
 *                                 type: string
 *                                 example: "A-101"
 *
 *                               project:
 *                                 type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Green Valley Housing Society"
 *
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCommission:
 *                       type: number
 *                       example: 1000000
 *
 *                     pendingAmount:
 *                       type: number
 *                       example: 400000
 *
 *                     paidAmount:
 *                       type: number
 *                       example: 600000
 *
 *                     totalEntries:
 *                       type: integer
 *                       example: 25
 *
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *
 *                     limit:
 *                       type: integer
 *                       example: 10
 *
 *                     total:
 *                       type: integer
 *                       example: 25
 *
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       403:
 *         description: Forbidden - User does not have the `payments:read` permission.
 *
 *       500:
 *         description: Internal server error.
 *
 *   post:
 *     tags:
 *       - Commissions
 *     summary: Create a commission
 *     description: >
 *       Creates a commission record for an agent based on a booking.
 *       The commission amount is automatically calculated using either
 *       a percentage of the booking net amount or a fixed amount.
 *       Requires the `payments:write` permission.
 *     security:
 *       - NextAuthSession: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - agentId
 *               - rate
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: ID of the booking associated with this commission.
 *                 example: "booking-id-here"
 *
 *               agentId:
 *                 type: string
 *                 description: ID of the sales agent receiving the commission.
 *                 example: "agent-id-here"
 *
 *               commissionType:
 *                 type: string
 *                 enum:
 *                   - PERCENTAGE
 *                   - FIXED
 *                 default: PERCENTAGE
 *                 description: >
 *                   Commission calculation method. PERCENTAGE calculates the
 *                   commission based on the booking net amount. FIXED uses
 *                   the rate as the commission amount.
 *                 example: "PERCENTAGE"
 *
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 description: >
 *                   Percentage rate or fixed commission amount depending
 *                   on the commission type.
 *                 example: 5
 *
 *           examples:
 *             percentageCommission:
 *               summary: Percentage-based commission
 *               value:
 *                 bookingId: "booking-id-here"
 *                 agentId: "agent-id-here"
 *                 commissionType: "PERCENTAGE"
 *                 rate: 5
 *
 *             fixedCommission:
 *               summary: Fixed commission
 *               value:
 *                 bookingId: "booking-id-here"
 *                 agentId: "agent-id-here"
 *                 commissionType: "FIXED"
 *                 rate: 100000
 *
 *     responses:
 *       201:
 *         description: Commission created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "commission-id"
 *
 *                 bookingId:
 *                   type: string
 *                   example: "booking-id"
 *
 *                 agentId:
 *                   type: string
 *                   example: "agent-id"
 *
 *                 commissionType:
 *                   type: string
 *                   enum:
 *                     - PERCENTAGE
 *                     - FIXED
 *                   example: "PERCENTAGE"
 *
 *                 rate:
 *                   type: number
 *                   example: 5
 *
 *                 baseAmount:
 *                   type: number
 *                   example: 5000000
 *
 *                 commissionAmount:
 *                   type: number
 *                   example: 250000
 *
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *
 *       400:
 *         description: Validation error - Invalid request body.
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       403:
 *         description: Forbidden - User does not have the `payments:write` permission.
 *
 *       404:
 *         description: Booking not found in the authenticated user's organization.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Booking not found"
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("payments:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const { page, limit, skip } = getPaginationParams(request);
    const agentId = request.nextUrl.searchParams.get("agentId");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = {
      agent: { organizationId: session.user.organizationId },
    };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where, skip, take: limit,
        include: {
          agent: { select: { id: true, name: true } },
          booking: {
            select: {
              bookingNumber: true, netAmount: true,
              customer: { select: { firstName: true, lastName: true } },
              plot: { select: { plotNumber: true, project: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.commission.count({ where }),
    ]);

    // Summary
    const summary = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId } },
      _sum: { commissionAmount: true },
      _count: true,
    });
    const pendingSum = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId }, status: "PENDING" },
      _sum: { commissionAmount: true },
    });
    const paidSum = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId }, status: "PAID" },
      _sum: { commissionAmount: true },
    });

    return NextResponse.json({
      data: commissions,
      summary: {
        totalCommission: Number(summary._sum.commissionAmount || 0),
        pendingAmount: Number(pendingSum._sum.commissionAmount || 0),
        paidAmount: Number(paidSum._sum.commissionAmount || 0),
        totalEntries: summary._count,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("payments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = createCommissionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;

    const booking = await prisma.booking.findFirst({
      where: { id: d.bookingId, plot: { project: { organizationId: session.user.organizationId } } },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const baseAmount = Number(booking.netAmount);
    const commissionAmount = d.commissionType === "PERCENTAGE"
      ? Math.round(baseAmount * (d.rate / 100))
      : d.rate;

    const commission = await prisma.commission.create({
      data: {
        bookingId: d.bookingId,
        agentId: d.agentId,
        commissionType: d.commissionType,
        rate: d.rate,
        baseAmount,
        commissionAmount,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Commission",
      entityId: commission.id,
      changes: { agentId: d.agentId, bookingId: d.bookingId, amount: commissionAmount },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
