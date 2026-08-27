import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
  getPaginationParams,
  paginatedResponse,
} from "@/lib/api-utils";
import { createPlotSchema, bulkCreatePlotsSchema } from "@/lib/validators/plot";

/**
 * @swagger
 * /api/plots:
 *   get:
 *     summary: Get all plots
 *     description: |
 *       Returns a paginated list of plots belonging to the authenticated
 *       user's organization.
 *
 *       Results can be filtered by project, block, status, and plot type.
 *       Search can be performed using plot number or street.
 *
 *       Active bookings are included when available.
 *     tags:
 *       - Plots
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
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of plots per page.
 *
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by plot number or street.
 *         example: "A-101"
 *
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter plots by project ID.
 *         example: "clxproject123"
 *
 *       - in: query
 *         name: blockId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter plots by block ID.
 *         example: "clxblock123"
 *
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter plots by status.
 *         example: AVAILABLE
 *
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter plots by type.
 *         example: RESIDENTIAL
 *
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field used for sorting.
 *
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *         description: Sort order.
 *
 *     responses:
 *       200:
 *         description: Paginated list of plots returned successfully.
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
 *                         example: "clxplot123"
 *
 *                       plotNumber:
 *                         type: string
 *                         example: "A-101"
 *
 *                       projectId:
 *                         type: string
 *
 *                       blockId:
 *                         type: string
 *                         nullable: true
 *
 *                       type:
 *                         type: string
 *                         example: RESIDENTIAL
 *
 *                       size:
 *                         type: number
 *                         example: 10
 *
 *                       sizeUnit:
 *                         type: string
 *                         example: MARLA
 *
 *                       basePrice:
 *                         type: number
 *                         example: 5000000
 *
 *                       premiumAmount:
 *                         type: number
 *                         example: 0
 *
 *                       totalPrice:
 *                         type: number
 *                         example: 5000000
 *
 *                       status:
 *                         type: string
 *                         example: AVAILABLE
 *
 *                       street:
 *                         type: string
 *                         nullable: true
 *                         example: "Main Boulevard"
 *
 *                       project:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                             example: "Green Valley"
 *
 *                       block:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                             example: "Block A"
 *
 *                       bookings:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             bookingNumber:
 *                               type: string
 *                               example: "BK-2026-00001"
 *                             customer:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 firstName:
 *                                   type: string
 *                                   example: "Ahmed"
 *                                 lastName:
 *                                   type: string
 *                                   example: "Khan"
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
 *                       example: 50
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } =
      getPaginationParams(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const blockId = request.nextUrl.searchParams.get("blockId");
    const status = request.nextUrl.searchParams.get("status");
    const type = request.nextUrl.searchParams.get("type");

    const where: any = {
      project: { organizationId: session.user.organizationId },
    };
    if (projectId) where.projectId = projectId;
    if (blockId) where.blockId = blockId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { plotNumber: { contains: search, mode: "insensitive" } },
        { street: { contains: search, mode: "insensitive" } },
      ];
    }

    const [plots, total] = await Promise.all([
      prisma.plot.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          block: { select: { id: true, name: true } },
          bookings: {
            where: {
              status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
            },
            select: {
              id: true,
              bookingNumber: true,
              customer: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.plot.count({ where }),
    ]);

    return paginatedResponse(plots, total, page, limit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/plots:
 *   post:
 *     summary: Create plot or bulk create plots
 *     description: |
 *       Creates a single plot or multiple plots.
 *
 *       For a single plot, send the normal plot details.
 *
 *       For bulk creation, send "bulk": true along with the project,
 *       block, starting number, count, plot details, and optional prefix.
 *
 *       The project must belong to the authenticated user's organization.
 *     tags:
 *       - Plots
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - projectId
 *                   - plotNumber
 *                   - type
 *                   - size
 *                   - sizeUnit
 *                   - basePrice
 *                 properties:
 *                   projectId:
 *                     type: string
 *                     example: "clxproject123"
 *
 *                   blockId:
 *                     type: string
 *                     example: "clxblock123"
 *
 *                   plotNumber:
 *                     type: string
 *                     example: "A-101"
 *
 *                   type:
 *                     type: string
 *                     example: RESIDENTIAL
 *
 *                   size:
 *                     type: number
 *                     example: 10
 *
 *                   sizeUnit:
 *                     type: string
 *                     example: MARLA
 *
 *                   basePrice:
 *                     type: number
 *                     example: 5000000
 *
 *                   premiumAmount:
 *                     type: number
 *                     example: 0
 *
 *                   totalPrice:
 *                     type: number
 *                     example: 5000000
 *
 *                   status:
 *                     type: string
 *                     example: AVAILABLE
 *
 *                   street:
 *                     type: string
 *                     example: "Main Boulevard"
 *
 *                   facingDirection:
 *                     type: string
 *                     example: EAST
 *
 *               - type: object
 *                 required:
 *                   - bulk
 *                   - projectId
 *                   - startNumber
 *                   - count
 *                   - type
 *                   - size
 *                   - sizeUnit
 *                   - basePrice
 *                 properties:
 *                   bulk:
 *                     type: boolean
 *                     example: true
 *
 *                   projectId:
 *                     type: string
 *                     example: "clxproject123"
 *
 *                   blockId:
 *                     type: string
 *                     example: "clxblock123"
 *
 *                   plotPrefix:
 *                     type: string
 *                     example: "A"
 *
 *                   startNumber:
 *                     type: integer
 *                     example: 101
 *
 *                   count:
 *                     type: integer
 *                     example: 10
 *
 *                   type:
 *                     type: string
 *                     example: RESIDENTIAL
 *
 *                   size:
 *                     type: number
 *                     example: 10
 *
 *                   sizeUnit:
 *                     type: string
 *                     example: MARLA
 *
 *                   basePrice:
 *                     type: number
 *                     example: 5000000
 *
 *           examples:
 *             singlePlot:
 *               summary: Create a single plot
 *               value:
 *                 projectId: "clxproject123"
 *                 blockId: "clxblock123"
 *                 plotNumber: "A-101"
 *                 type: "RESIDENTIAL"
 *                 size: 10
 *                 sizeUnit: "MARLA"
 *                 basePrice: 5000000
 *                 premiumAmount: 0
 *                 totalPrice: 5000000
 *                 status: "AVAILABLE"
 *                 street: "Main Boulevard"
 *                 facingDirection: "EAST"
 *
 *             bulkPlots:
 *               summary: Bulk create plots
 *               value:
 *                 bulk: true
 *                 projectId: "clxproject123"
 *                 blockId: "clxblock123"
 *                 plotPrefix: "A"
 *                 startNumber: 101
 *                 count: 10
 *                 type: "RESIDENTIAL"
 *                 size: 10
 *                 sizeUnit: "MARLA"
 *                 basePrice: 5000000
 *
 *     responses:
 *       201:
 *         description: Plot or plots created successfully.
 *         content:
 *           application/json:
 *             examples:
 *               singlePlot:
 *                 summary: Single plot created
 *                 value:
 *                   id: "clxplot123"
 *                   projectId: "clxproject123"
 *                   blockId: "clxblock123"
 *                   plotNumber: "A-101"
 *                   type: "RESIDENTIAL"
 *                   size: 10
 *                   sizeUnit: "MARLA"
 *                   basePrice: 5000000
 *                   premiumAmount: 0
 *                   totalPrice: 5000000
 *                   status: "AVAILABLE"
 *
 *               bulkPlots:
 *                 summary: Multiple plots created
 *                 value:
 *                   message: "10 plots created"
 *
 *       400:
 *         description: Validation error or invalid plot data.
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       404:
 *         description: Project not found or does not belong to your organization.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();

    // Check if bulk create
    if (body.bulk) {
      const parsed = bulkCreatePlotsSchema.safeParse(body);
      if (!parsed.success)
        return validationErrorResponse(parsed.error.flatten());

      const d = parsed.data;
      const plots = [];
      for (let i = 0; i < d.count; i++) {
        const num = d.startNumber + i;
        const plotNumber = d.plotPrefix
          ? `${d.plotPrefix}-${num}`
          : String(num);
        plots.push({
          projectId: d.projectId,
          blockId: d.blockId,
          plotNumber,
          type: d.type,
          size: d.size,
          sizeUnit: d.sizeUnit,
          basePrice: d.basePrice,
          premiumAmount: 0,
          totalPrice: d.basePrice,
        });
      }

      const result = await prisma.plot.createMany({ data: plots });
      return NextResponse.json(
        { message: `${result.count} plots created` },
        { status: 201 }
      );
    }

    // Single create
    const parsed = createPlotSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: {
        id: parsed.data.projectId,
        organizationId: session.user.organizationId,
      },
    });
    if (!project)
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );

    const plot = await prisma.plot.create({ data: parsed.data });
    return NextResponse.json(plot, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
