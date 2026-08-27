import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, serverErrorResponse,
  getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";


/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     description: |
 *       Returns a paginated list of audit logs for the authenticated user's organization.
 *
 *       Only users with ADMIN or SUPER_ADMIN roles can access this endpoint.
 *
 *       Audit logs can be filtered by entity, user ID, or action.
 *
 *     tags:
 *       - Audit Logs
 *
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number for pagination.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of audit logs per page.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         example: 20
 *
 *       - name: entity
 *         in: query
 *         required: false
 *         description: Filter audit logs by entity type.
 *         schema:
 *           type: string
 *         example: Customer
 *
 *       - name: userId
 *         in: query
 *         required: false
 *         description: Filter audit logs by the user who performed the action.
 *         schema:
 *           type: string
 *         example: clx123abc456
 *
 *       - name: action
 *         in: query
 *         required: false
 *         description: Filter audit logs by action.
 *         schema:
 *           type: string
 *         example: CREATED
 *
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully.
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
 *                         example: clx123abc456
 *
 *                       entity:
 *                         type: string
 *                         example: Customer
 *
 *                       entityId:
 *                         type: string
 *                         example: customer-id-123
 *
 *                       action:
 *                         type: string
 *                         example: CREATED
 *
 *                       changes:
 *                         nullable: true
 *                         description: Details of changes made to the entity.
 *
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: user-id-123
 *
 *                           name:
 *                             type: string
 *                             example: Admin User
 *
 *                           email:
 *                             type: string
 *                             format: email
 *                             example: admin@devlayers.org
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
 *                       example: 20
 *
 *                     total:
 *                       type: integer
 *                       example: 100
 *
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *
 *             example:
 *               data:
 *                 - id: clx123abc456
 *                   entity: Customer
 *                   entityId: customer-id-123
 *                   action: CREATED
 *                   changes:
 *                     firstName: Ahmed
 *                     lastName: Khan
 *                   createdAt: "2026-08-25T10:30:00.000Z"
 *                   user:
 *                     id: user-id-123
 *                     name: Admin User
 *                     email: admin@devlayers.org
 *
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 100
 *                 totalPages: 5
 *
 *       401:
 *         description: Unauthorized. User is not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *
 *       403:
 *         description: Forbidden. Only ADMIN and SUPER_ADMIN users can access audit logs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Forbidden
 *
 *       500:
 *         description: Internal server error.
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
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    // Only admins can view audit logs
    if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, skip } = getPaginationParams(request);
    const entity = request.nextUrl.searchParams.get("entity");
    const userId = request.nextUrl.searchParams.get("userId");
    const action = request.nextUrl.searchParams.get("action");

    const where: any = { organizationId: session.user.organizationId };
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginatedResponse(logs, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}
