import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { updatePlotSchema } from "@/lib/validators/plot";

/**
 * @swagger
 * /api/plots/{id}:
 *   get:
 *     tags:
 *       - Plots
 *     summary: Get plot details
 *     description: Get detailed information about a specific plot, including project, block, assigned agent, bookings, images, and recent maintenance requests.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Plot ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plot details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123plot"
 *                 plotNumber:
 *                   type: string
 *                   example: "A-101"
 *                 type:
 *                   type: string
 *                   example: "RESIDENTIAL"
 *                 size:
 *                   type: number
 *                   example: 10
 *                 sizeUnit:
 *                   type: string
 *                   example: "MARLA"
 *                 basePrice:
 *                   type: number
 *                   example: 5000000
 *                 premiumAmount:
 *                   type: number
 *                   example: 0
 *                 totalPrice:
 *                   type: number
 *                   example: 5000000
 *                 status:
 *                   type: string
 *                   example: "AVAILABLE"
 *                 project:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 block:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 assignedAgent:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 bookings:
 *                   type: array
 *                   items:
 *                     type: object
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                 maintenanceRequests:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plot not found
 *       500:
 *         description: Internal server error
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const plot = await prisma.plot.findFirst({
      where: {
        id: params.id,
        project: { organizationId: session.user.organizationId },
      },
      include: {
        project: { select: { id: true, name: true } },
        block: { select: { id: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
        bookings: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        images: true,
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!plot) return notFoundResponse("Plot");
    return NextResponse.json(plot);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/plots/{id}:
 *   patch:
 *     tags:
 *       - Plots
 *     summary: Update a plot
 *     description: Update information for a specific plot belonging to the current user's organization.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Plot ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plotNumber:
 *                 type: string
 *                 example: "A-101"
 *               blockId:
 *                 type: string
 *                 example: "clxblock123"
 *               type:
 *                 type: string
 *                 example: "RESIDENTIAL"
 *               size:
 *                 type: number
 *                 example: 10
 *               sizeUnit:
 *                 type: string
 *                 example: "MARLA"
 *               basePrice:
 *                 type: number
 *                 example: 5000000
 *               premiumAmount:
 *                 type: number
 *                 example: 250000
 *               totalPrice:
 *                 type: number
 *                 example: 5250000
 *               status:
 *                 type: string
 *                 example: "AVAILABLE"
 *               street:
 *                 type: string
 *                 example: "Main Boulevard"
 *               facingDirection:
 *                 type: string
 *                 example: "NORTH"
 *               assignedAgentId:
 *                 type: string
 *                 example: "clxagent123"
 *     responses:
 *       200:
 *         description: Plot updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 plotNumber:
 *                   type: string
 *                 status:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plot not found
 *       500:
 *         description: Internal server error
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = updatePlotSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const existing = await prisma.plot.findFirst({
      where: {
        id: params.id,
        project: { organizationId: session.user.organizationId },
      },
    });
    if (!existing) return notFoundResponse("Plot");

    const plot = await prisma.plot.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(plot);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
