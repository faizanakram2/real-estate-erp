import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, validationErrorResponse, serverErrorResponse } from "@/lib/api-utils";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["IN_APP", "SMS", "WHATSAPP", "EMAIL"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

/**
 * @swagger
 * /api/notification-templates:
 *   get:
 *     summary: Get notification templates
 *     description: |
 *       Returns all notification templates belonging to the authenticated
 *       user's organization.
 *
 *       Templates are ordered alphabetically by name.
 *     tags:
 *       - Notification Templates
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Notification templates retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "clx123abc456"
 *
 *                   organizationId:
 *                     type: string
 *                     example: "org_123"
 *
 *                   name:
 *                     type: string
 *                     example: "Payment Reminder"
 *
 *                   channel:
 *                     type: string
 *                     enum:
 *                       - IN_APP
 *                       - SMS
 *                       - WHATSAPP
 *                       - EMAIL
 *                     example: SMS
 *
 *                   subject:
 *                     type: string
 *                     nullable: true
 *                     example: "Payment Reminder"
 *
 *                   body:
 *                     type: string
 *                     example: "Dear {{customerName}}, your installment of PKR {{amount}} is due on {{dueDate}}."
 *
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const templates = await prisma.notificationTemplate.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/notification-templates:
 *   post:
 *     summary: Create notification template
 *     description: Creates a new notification template for the authenticated user's organization.
 *     tags:
 *       - Notification Templates
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - channel
 *               - body
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: "Payment Reminder"
 *                 description: Name of the notification template.
 *
 *               channel:
 *                 type: string
 *                 enum:
 *                   - IN_APP
 *                   - SMS
 *                   - WHATSAPP
 *                   - EMAIL
 *                 example: SMS
 *                 description: Notification delivery channel.
 *
 *               subject:
 *                 type: string
 *                 example: "Payment Reminder"
 *                 description: Optional subject. Typically used for email notifications.
 *
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 example: "Dear {{customerName}}, your installment of PKR {{amount}} is due on {{dueDate}}."
 *                 description: Notification message body.
 *
 *     responses:
 *       201:
 *         description: Notification template created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 organizationId:
 *                   type: string
 *                   example: "org_123"
 *
 *                 name:
 *                   type: string
 *                   example: "Payment Reminder"
 *
 *                 channel:
 *                   type: string
 *                   enum:
 *                     - IN_APP
 *                     - SMS
 *                     - WHATSAPP
 *                     - EMAIL
 *                   example: SMS
 *
 *                 subject:
 *                   type: string
 *                   nullable: true
 *                   example: "Payment Reminder"
 *
 *                 body:
 *                   type: string
 *                   example: "Dear {{customerName}}, your installment of PKR {{amount}} is due on {{dueDate}}."
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const template = await prisma.notificationTemplate.create({
      data: { organizationId: session.user.organizationId, ...parsed.data },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
