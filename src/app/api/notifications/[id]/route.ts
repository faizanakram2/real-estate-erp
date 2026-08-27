import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/notifications/{id}:
 *   patch:
 *     summary: Mark notification as read
 *     description: |
 *       Marks a specific notification belonging to the authenticated user
 *       as read.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID.
 *         example: "clx123abc456"
 *
 *     responses:
 *       200:
 *         description: Notification marked as read successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *                 userId:
 *                   type: string
 *                   example: "user_123"
 *                 title:
 *                   type: string
 *                   example: "Payment Reminder"
 *                 message:
 *                   type: string
 *                   example: "Your installment payment is due tomorrow."
 *                 isRead:
 *                   type: boolean
 *                   example: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Notification not found or does not belong to the authenticated user.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!notification) return notFoundResponse("Notification");

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });
    return NextResponse.json(updated);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     description: |
 *       Deletes a specific notification belonging to the authenticated user.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID.
 *         example: "clx123abc456"
 *
 *     responses:
 *       200:
 *         description: Notification deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notification deleted"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    await prisma.notification.deleteMany({ where: { id: params.id, userId: session.user.id } });
    return NextResponse.json({ message: "Notification deleted" });
  } catch (error) { return serverErrorResponse(error); }
}
