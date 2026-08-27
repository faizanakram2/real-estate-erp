import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createMaintenanceSchema = z.object({
  plotId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["PLUMBING","ELECTRICAL","HVAC","STRUCTURAL","PEST_CONTROL","LANDSCAPING","PAINTING","FLOORING","GENERAL","EMERGENCY","OTHER"]),
  priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]).default("MEDIUM"),
  assigneeId: z.string().optional(),
  vendorId: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  estimatedCost: z.number().positive().optional(),
});

/**
 * @swagger
 * /api/maintenance-requests:
 *   get:
 *     summary: Get maintenance requests
 *     description: |
 *       Returns a paginated list of maintenance requests belonging to the
 *       authenticated user's organization.
 *
 *       Maintenance requests can be filtered by status and priority and
 *       searched by title or description.
 *
 *       Each request includes plot, assignee, vendor, comment count,
 *       and image count information.
 *     tags:
 *       - Maintenance
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
 *         description: Number of maintenance requests per page.
 *         example: 10
 *
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search maintenance requests by title or description.
 *         example: "water leakage"
 *
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter maintenance requests by status.
 *         example: "PENDING"
 *
 *       - in: query
 *         name: priority
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - LOW
 *             - MEDIUM
 *             - HIGH
 *             - URGENT
 *         description: Filter maintenance requests by priority.
 *         example: HIGH
 *
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *         description: Field used to sort the results.
 *         example: "createdAt"
 *
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *         description: Sort direction.
 *         example: "desc"
 *
 *     responses:
 *       200:
 *         description: Maintenance requests retrieved successfully.
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
 *                       plotId:
 *                         type: string
 *                         nullable: true
 *                         example: "plot_123"
 *
 *                       title:
 *                         type: string
 *                         example: "Water Leakage"
 *
 *                       description:
 *                         type: string
 *                         example: "Water leakage reported near the main entrance."
 *
 *                       category:
 *                         type: string
 *                         enum:
 *                           - PLUMBING
 *                           - ELECTRICAL
 *                           - HVAC
 *                           - STRUCTURAL
 *                           - PEST_CONTROL
 *                           - LANDSCAPING
 *                           - PAINTING
 *                           - FLOORING
 *                           - GENERAL
 *                           - EMERGENCY
 *                           - OTHER
 *                         example: PLUMBING
 *
 *                       priority:
 *                         type: string
 *                         enum:
 *                           - LOW
 *                           - MEDIUM
 *                           - HIGH
 *                           - URGENT
 *                         example: HIGH
 *
 *                       status:
 *                         type: string
 *                         example: PENDING
 *
 *                       assigneeId:
 *                         type: string
 *                         nullable: true
 *                         example: "user_123"
 *
 *                       vendorId:
 *                         type: string
 *                         nullable: true
 *                         example: "vendor_123"
 *
 *                       scheduledDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2026-09-01T09:00:00.000Z"
 *
 *                       estimatedCost:
 *                         type: number
 *                         format: double
 *                         nullable: true
 *                         example: 25000
 *
 *                       plot:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           plotNumber:
 *                             type: string
 *                             example: "A-102"
 *                           project:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Green Valley Housing"
 *
 *                       assignee:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "user_123"
 *                           name:
 *                             type: string
 *                             example: "Ahmed Khan"
 *
 *                       vendor:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           companyName:
 *                             type: string
 *                             example: "ABC Maintenance Services"
 *
 *                       _count:
 *                         type: object
 *                         properties:
 *                           comments:
 *                             type: integer
 *                             example: 5
 *                           images:
 *                             type: integer
 *                             example: 3
 *
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T10:00:00.000Z"
 *
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T12:00:00.000Z"
 *
 *                 total:
 *                   type: integer
 *                   example: 45
 *
 *                 page:
 *                   type: integer
 *                   example: 1
 *
 *                 limit:
 *                   type: integer
 *                   example: 10
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

    const { page, limit, skip, search, sortBy, sortOrder } = getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");
    const priority = request.nextUrl.searchParams.get("priority");

    const where: any = { createdBy: { organizationId: session.user.organizationId } };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where, skip, take: limit,
        include: {
          plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          assignee: { select: { id: true, name: true } },
          vendor: { select: { companyName: true } },
          _count: { select: { comments: true, images: true } },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return paginatedResponse(requests, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/maintenance-requests:
 *   post:
 *     summary: Create maintenance request
 *     description: Creates a new maintenance request for the authenticated user's organization.
 *     tags:
 *       - Maintenance
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
 *               - title
 *               - description
 *               - category
 *             properties:
 *               plotId:
 *                 type: string
 *                 example: "plot_123"
 *                 description: Optional plot associated with the maintenance request.
 *
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 example: "Water Leakage"
 *                 description: Maintenance request title.
 *
 *               description:
 *                 type: string
 *                 minLength: 1
 *                 example: "Water leakage reported near the main entrance."
 *                 description: Detailed description of the maintenance issue.
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
 *                 description: Maintenance issue category.
 *
 *               priority:
 *                 type: string
 *                 enum:
 *                   - LOW
 *                   - MEDIUM
 *                   - HIGH
 *                   - URGENT
 *                 default: MEDIUM
 *                 example: MEDIUM
 *                 description: Priority of the maintenance request.
 *
 *               assigneeId:
 *                 type: string
 *                 example: "user_123"
 *                 description: Optional user/employee assigned to the request.
 *
 *               vendorId:
 *                 type: string
 *                 example: "vendor_123"
 *                 description: Optional vendor assigned to the request.
 *
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-09-01T09:00:00.000Z"
 *                 description: Optional scheduled maintenance date.
 *
 *               estimatedCost:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 example: 25000
 *                 description: Estimated maintenance cost.
 *
 *     responses:
 *       201:
 *         description: Maintenance request created successfully.
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
 *                   example: MEDIUM
 *
 *                 status:
 *                   type: string
 *                   example: PENDING
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
 *                 estimatedCost:
 *                   type: number
 *                   format: double
 *                   nullable: true
 *                   example: 25000
 *
 *                 createdById:
 *                   type: string
 *                   example: "user_123"
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
    const parsed = createMaintenanceSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const mr = await prisma.maintenanceRequest.create({
      data: {
        ...d,
        createdById: session.user.id,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : undefined,
      },
    });
    return NextResponse.json(mr, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
