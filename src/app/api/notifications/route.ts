import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse, getPaginationParams } from "@/lib/api-utils";


/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     description: |
 *       Returns paginated notifications for the currently authenticated user.
 *       Supports filtering to return only unread notifications and also
 *       returns the total unread notification count.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of notifications per page.
 *         example: 10
 *
 *       - in: query
 *         name: unreadOnly
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only unread notifications when set to true.
 *         example: true
 *
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully.
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
 *                         example: "clx123abc456"
 *
 *                       userId:
 *                         type: string
 *                         example: "user_123"
 *
 *                       title:
 *                         type: string
 *                         example: "Payment Reminder"
 *
 *                       message:
 *                         type: string
 *                         example: "Your installment payment of PKR 50,000 is due tomorrow."
 *
 *                       type:
 *                         type: string
 *                         example: "PAYMENT_REMINDER"
 *
 *                       isRead:
 *                         type: boolean
 *                         example: false
 *
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T10:00:00.000Z"
 *
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T10:00:00.000Z"
 *
 *                 unreadCount:
 *                   type: integer
 *                   example: 5
 *                   description: Total number of unread notifications for the user.
 *
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip } = getPaginationParams(request);
    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";

    const where: any = { userId: session.user.id };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: session.user.id, isRead: false } }),
    ]);

    return NextResponse.json({
      data: notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { return serverErrorResponse(error); }
}


/**
 * @swagger
 * /api/notifications:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: |
 *       Marks all unread notifications belonging to the currently
 *       authenticated user as read.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "All notifications marked as read"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(_request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) { return serverErrorResponse(error); }
}
