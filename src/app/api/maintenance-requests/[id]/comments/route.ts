import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/maintenance-requests/{id}/comments:
 *   post:
 *     summary: Add comment to maintenance request
 *     description: |
 *       Adds a comment to a specific maintenance request.
 *       The authenticated user is automatically recorded as the author
 *       of the comment.
 *
 *       Comments can be marked as internal so they are only intended
 *       for internal staff communication.
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
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 minLength: 1
 *                 example: "Technician has been assigned and will visit tomorrow."
 *                 description: Comment text.
 *
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *                 description: |
 *                   Whether the comment is internal.
 *                   Defaults to false when omitted.
 *
 *     responses:
 *       201:
 *         description: Comment added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clxcomment123"
 *
 *                 maintenanceRequestId:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 userId:
 *                   type: string
 *                   example: "user_123"
 *
 *                 comment:
 *                   type: string
 *                   example: "Technician has been assigned and will visit tomorrow."
 *
 *                 isInternal:
 *                   type: boolean
 *                   example: false
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T12:30:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T12:30:00.000Z"
 *
 *       400:
 *         description: Comment is required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Comment is required"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { comment, isInternal } = await request.json();
    if (!comment) return NextResponse.json({ error: "Comment is required" }, { status: 400 });

    const mc = await prisma.maintenanceComment.create({
      data: { maintenanceRequestId: params.id, userId: session.user.id, comment, isInternal: isInternal || false },
    });
    return NextResponse.json(mc, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
