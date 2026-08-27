import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/maintenance-requests/{id}:
 *   get:
 *     summary: Get maintenance request by ID
 *     description: |
 *       Returns detailed information about a specific maintenance request
 *       belonging to the authenticated user's organization.
 *
 *       The response includes the associated plot, project, assignee,
 *       vendor, creator, images, and comments.
 *     tags:
 *       - Maintenance
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Maintenance request ID.
 *         example: "clx123abc456"
 *
 *     responses:
 *       200:
 *         description: Maintenance request retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 plotId:
 *                   type: string
 *                   nullable: true
 *                   example: "plot_123"
 *
 *                 title:
 *                   type: string
 *                   example: "Water Leakage"
 *
 *                 description:
 *                   type: string
 *                   example: "Water leakage reported near the main entrance."
 *
 *                 category:
 *                   type: string
 *                   example: PLUMBING
 *
 *                 priority:
 *                   type: string
 *                   example: HIGH
 *
 *                 status:
 *                   type: string
 *                   example: IN_PROGRESS
 *
 *                 assigneeId:
 *                   type: string
 *                   nullable: true
 *                   example: "user_123"
 *
 *                 vendorId:
 *                   type: string
 *                   nullable: true
 *                   example: "vendor_123"
 *
 *                 scheduledDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2026-09-01T09:00:00.000Z"
 *
 *                 completedDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: null
 *
 *                 estimatedCost:
 *                   type: number
 *                   format: double
 *                   nullable: true
 *                   example: 25000
 *
 *                 actualCost:
 *                   type: number
 *                   format: double
 *                   nullable: true
 *                   example: 23000
 *
 *                 createdById:
 *                   type: string
 *                   example: "user_456"
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T12:00:00.000Z"
 *
 *                 plot:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     plotNumber:
 *                       type: string
 *                       example: "A-102"
 *                     project:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Green Valley Housing"
 *
 *                 assignee:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_123"
 *                     name:
 *                       type: string
 *                       example: "Ahmed Khan"
 *
 *                 vendor:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "vendor_123"
 *                     companyName:
 *                       type: string
 *                       example: "ABC Maintenance Services"
 *
 *                 createdBy:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "user_456"
 *                     name:
 *                       type: string
 *                       example: "Admin User"
 *
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Maintenance request not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const mr = await prisma.maintenanceRequest.findFirst({
      where: { id: params.id, createdBy: { organizationId: session.user.organizationId } },
      include: {
        plot: { select: { plotNumber: true, project: { select: { name: true } } } },
        assignee: { select: { id: true, name: true } },
        vendor: { select: { id: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        images: true,
        comments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!mr) return notFoundResponse("Maintenance Request");
    return NextResponse.json(mr);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/maintenance-requests/{id}:
 *   patch:
 *     summary: Update maintenance request
 *     description: |
 *       Updates an existing maintenance request.
 *
 *       The request can update any fields accepted by the maintenance
 *       request model. When the status is changed to COMPLETED and no
 *       completedDate is supplied, the server automatically sets the
 *       completedDate to the current date and time.
 *     tags:
 *       - Maintenance
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Maintenance request ID.
 *         example: "clx123abc456"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plotId:
 *                 type: string
 *                 nullable: true
 *                 example: "plot_123"
 *
 *               title:
 *                 type: string
 *                 example: "Water Leakage Repair"
 *
 *               description:
 *                 type: string
 *                 example: "Leakage repaired and pipe replaced."
 *
 *               category:
 *                 type: string
 *                 enum:
 *                   - PLUMBING
 *                   - ELECTRICAL
 *                   - HVAC
 *                   - STRUCTURAL
 *                   - PEST_CONTROL
 *                   - LANDSCAPING
 *                   - PAINTING
 *                   - FLOORING
 *                   - GENERAL
 *                   - EMERGENCY
 *                   - OTHER
 *                 example: PLUMBING
 *
 *               priority:
 *                 type: string
 *                 enum:
 *                   - LOW
 *                   - MEDIUM
 *                   - HIGH
 *                   - URGENT
 *                 example: HIGH
 *
 *               status:
 *                 type: string
 *                 example: IN_PROGRESS
 *                 description: Current status of the maintenance request.
 *
 *               assigneeId:
 *                 type: string
 *                 nullable: true
 *                 example: "user_123"
 *
 *               vendorId:
 *                 type: string
 *                 nullable: true
 *                 example: "vendor_123"
 *
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-09-01T09:00:00.000Z"
 *
 *               completedDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-09-02T15:30:00.000Z"
 *
 *               estimatedCost:
 *                 type: number
 *                 format: double
 *                 example: 25000
 *
 *               actualCost:
 *                 type: number
 *                 format: double
 *                 example: 23000
 *
 *               notes:
 *                 type: string
 *                 example: "Work completed successfully."
 *
 *     responses:
 *       200:
 *         description: Maintenance request updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 plotId:
 *                   type: string
 *                   nullable: true
 *                   example: "plot_123"
 *
 *                 title:
 *                   type: string
 *                   example: "Water Leakage Repair"
 *
 *                 description:
 *                   type: string
 *                   example: "Leakage repaired and pipe replaced."
 *
 *                 category:
 *                   type: string
 *                   example: PLUMBING
 *
 *                 priority:
 *                   type: string
 *                   example: HIGH
 *
 *                 status:
 *                   type: string
 *                   example: COMPLETED
 *
 *                 scheduledDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2026-09-01T09:00:00.000Z"
 *
 *                 completedDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2026-09-02T15:30:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-09-02T15:30:00.000Z"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Maintenance request not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id: params.id, createdBy: { organizationId: session.user.organizationId } },
    });
    if (!existing) return notFoundResponse("Maintenance Request");

    const body = await request.json();
    if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate);
    if (body.completedDate) body.completedDate = new Date(body.completedDate);
    if (body.status === "COMPLETED" && !body.completedDate) body.completedDate = new Date();

    const mr = await prisma.maintenanceRequest.update({ where: { id: params.id }, data: body });
    return NextResponse.json(mr);
  } catch (error) { return serverErrorResponse(error); }
}
