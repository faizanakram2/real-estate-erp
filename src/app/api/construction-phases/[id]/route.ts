import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/construction/phases/{id}:
 *   get:
 *     tags:
 *       - Construction
 *     summary: Get construction phase details
 *     description: >
 *       Retrieves detailed information about a specific construction phase.
 *       The response includes the associated project, construction updates,
 *       update images, and material requests.
 *       Only phases belonging to the authenticated user's organization
 *       can be accessed.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Construction phase ID.
 *         schema:
 *           type: string
 *           example: "phase-id-here"
 *
 *     responses:
 *       200:
 *         description: Construction phase retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "phase-id"
 *
 *                 name:
 *                   type: string
 *                   example: "Foundation Work"
 *
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Foundation construction and structural preparation."
 *
 *                 status:
 *                   type: string
 *                   example: "IN_PROGRESS"
 *
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 project:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "project-id"
 *
 *                     name:
 *                       type: string
 *                       example: "Green Valley Housing Society"
 *
 *                 updates:
 *                   type: array
 *                   description: Construction progress updates.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "update-id"
 *
 *                       date:
 *                         type: string
 *                         format: date-time
 *
 *                       description:
 *                         type: string
 *                         example: "Foundation work completed successfully."
 *
 *                       updatedBy:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Ahmed Khan"
 *
 *                       images:
 *                         type: array
 *                         description: Images attached to the construction update.
 *                         items:
 *                           type: object
 *
 *                 materials:
 *                   type: array
 *                   description: Material requests associated with this construction phase.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "material-request-id"
 *
 *                       requestDate:
 *                         type: string
 *                         format: date-time
 *
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *
 *                       vendor:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           companyName:
 *                             type: string
 *                             example: "ABC Construction Supplies"
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       404:
 *         description: Construction phase not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Construction Phase not found"
 *
 *       500:
 *         description: Internal server error.
 *
 *   patch:
 *     tags:
 *       - Construction
 *     summary: Update a construction phase
 *     description: >
 *       Updates an existing construction phase.
 *       Only construction phases belonging to the authenticated user's
 *       organization can be updated.
 *
 *       Date fields such as startDate and endDate should be provided
 *       as ISO 8601 date-time strings.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Construction phase ID.
 *         schema:
 *           type: string
 *           example: "phase-id-here"
 *
 *     requestBody:
 *       required: true
 *       description: Construction phase fields to update.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Foundation Work - Phase 1"
 *
 *               description:
 *                 type: string
 *                 example: "Updated foundation construction details."
 *
 *               status:
 *                 type: string
 *                 example: "IN_PROGRESS"
 *
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-01T00:00:00.000Z"
 *
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-09-15T00:00:00.000Z"
 *
 *           example:
 *             name: "Foundation Work - Phase 1"
 *             description: "Foundation work is currently in progress."
 *             status: "IN_PROGRESS"
 *             startDate: "2026-08-01T00:00:00.000Z"
 *             endDate: "2026-09-15T00:00:00.000Z"
 *
 *     responses:
 *       200:
 *         description: Construction phase updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "phase-id"
 *
 *                 name:
 *                   type: string
 *                   example: "Foundation Work - Phase 1"
 *
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Foundation work is currently in progress."
 *
 *                 status:
 *                   type: string
 *                   example: "IN_PROGRESS"
 *
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       404:
 *         description: Construction phase not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Construction Phase not found"
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const phase = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
      include: {
        project: { select: { id: true, name: true } },
        updates: { orderBy: { date: "desc" }, include: { updatedBy: { select: { name: true } }, images: true } },
        materials: { orderBy: { requestDate: "desc" }, include: { vendor: { select: { companyName: true } } } },
      },
    });
    if (!phase) return notFoundResponse("Construction Phase");
    return NextResponse.json(phase);
  } catch (error) { return serverErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
    });
    if (!existing) return notFoundResponse("Construction Phase");

    const body = await request.json();
    if (body.startDate) body.startDate = new Date(body.startDate);
    if (body.endDate) body.endDate = new Date(body.endDate);

    const phase = await prisma.constructionPhase.update({ where: { id: params.id }, data: body });
    return NextResponse.json(phase);
  } catch (error) { return serverErrorResponse(error); }
}
