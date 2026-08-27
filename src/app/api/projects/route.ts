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
import { createProjectSchema } from "@/lib/validators/project";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get all projects
 *     description: Get a paginated list of projects belonging to the current user's organization. Supports searching, filtering, sorting, and project statistics.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of projects per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *       - in: query
 *         name: search
 *         required: false
 *         description: Search projects by name or city
 *         schema:
 *           type: string
 *           example: DHA
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter projects by status
 *         schema:
 *           type: string
 *           example: ACTIVE
 *       - in: query
 *         name: type
 *         required: false
 *         description: Filter projects by project type
 *         schema:
 *           type: string
 *           example: RESIDENTIAL
 *       - in: query
 *         name: sortBy
 *         required: false
 *         description: Field to sort by
 *         schema:
 *           type: string
 *           example: createdAt
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         description: Sort direction
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     tags:
 *       - Projects
 *     summary: Create a new project
 *     description: Create a new real estate project for the current user's organization.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectRequest'
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * components:
 *   schemas:
 *     CreateProjectRequest:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           example: Green Valley Housing Scheme
 *         type:
 *           type: string
 *           example: RESIDENTIAL
 *         description:
 *           type: string
 *           nullable: true
 *           example: Premium residential housing project
 *         addressLine1:
 *           type: string
 *           nullable: true
 *           example: Main Boulevard
 *         city:
 *           type: string
 *           nullable: true
 *           example: Lahore
 *         state:
 *           type: string
 *           nullable: true
 *           example: Punjab
 *         country:
 *           type: string
 *           nullable: true
 *           example: Pakistan
 *         latitude:
 *           type: number
 *           nullable: true
 *           example: 31.5204
 *         longitude:
 *           type: number
 *           nullable: true
 *           example: 74.3587
 *         totalArea:
 *           type: number
 *           nullable: true
 *           example: 500
 *         areaUnit:
 *           type: string
 *           nullable: true
 *           example: ACRES
 *         totalPlots:
 *           type: integer
 *           nullable: true
 *           example: 1000
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2026-01-01T00:00:00.000Z
 *         expectedCompletion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2028-12-31T00:00:00.000Z
 *         totalBudget:
 *           type: number
 *           nullable: true
 *           example: 500000000
 *
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxproject123
 *         organizationId:
 *           type: string
 *           example: clxorganization123
 *         slug:
 *           type: string
 *           example: green-valley-housing-scheme
 *         name:
 *           type: string
 *           example: Green Valley Housing Scheme
 *         type:
 *           type: string
 *           example: RESIDENTIAL
 *         description:
 *           type: string
 *           nullable: true
 *         addressLine1:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *           example: Lahore
 *         state:
 *           type: string
 *           nullable: true
 *           example: Punjab
 *         country:
 *           type: string
 *           nullable: true
 *           example: Pakistan
 *         latitude:
 *           type: number
 *           nullable: true
 *         longitude:
 *           type: number
 *           nullable: true
 *         totalArea:
 *           type: number
 *           nullable: true
 *         areaUnit:
 *           type: string
 *           nullable: true
 *         totalPlots:
 *           type: integer
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         expectedCompletion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         totalBudget:
 *           type: number
 *           nullable: true
 *         stats:
 *           type: object
 *           properties:
 *             totalPlots:
 *               type: integer
 *               example: 1000
 *             totalBlocks:
 *               type: integer
 *               example: 10
 *             available:
 *               type: integer
 *               example: 450
 *             booked:
 *               type: integer
 *               example: 350
 *             sold:
 *               type: integer
 *               example: 200
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } =
      getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");
    const type = request.nextUrl.searchParams.get("type");

    const where: any = { organizationId: session.user.organizationId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: { select: { plots: true, blocks: true } },
          plots: {
            select: { status: true },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.project.count({ where }),
    ]);

    const enriched = projects.map((p) => ({
      ...p,
      plots: undefined,
      stats: {
        totalPlots: p._count.plots,
        totalBlocks: p._count.blocks,
        available: p.plots.filter((pl) => pl.status === "AVAILABLE").length,
        booked: p.plots.filter((pl) => pl.status === "BOOKED").length,
        sold: p.plots.filter((pl) => pl.status === "SOLD").length,
      },
    }));

    return paginatedResponse(enriched, total, page, limit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}



export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const project = await prisma.project.create({
      data: {
        organizationId: session.user.organizationId,
        slug,
        name: data.name,
        type: data.type,
        description: data.description,
        addressLine1: data.addressLine1,
        city: data.city,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        totalArea: data.totalArea,
        areaUnit: data.areaUnit,
        totalPlots: data.totalPlots,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        expectedCompletion: data.expectedCompletion
          ? new Date(data.expectedCompletion)
          : undefined,
        totalBudget: data.totalBudget,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
