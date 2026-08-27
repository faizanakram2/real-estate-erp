import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createPhaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().positive().optional(),
});

/**
 * @swagger
 * /api/projects/{id}/phases:
 *   get:
 *     summary: Get construction phases
 *     description: Get all construction phases for a specific project, including recent updates, images, and counts.
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Construction phases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: clxyz123phase001
 *                   projectId:
 *                     type: string
 *                     example: clxyz123project001
 *                   name:
 *                     type: string
 *                     example: Foundation
 *                   description:
 *                     type: string
 *                     example: Foundation and excavation work
 *                   sortOrder:
 *                     type: integer
 *                     example: 1
 *                   startDate:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-01-15T00:00:00.000Z
 *                   endDate:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-03-15T00:00:00.000Z
 *                   budget:
 *                     type: number
 *                     example: 15000000
 *                   _count:
 *                     type: object
 *                     properties:
 *                       updates:
 *                         type: integer
 *                         example: 5
 *                       materials:
 *                         type: integer
 *                         example: 12
 *                   updates:
 *                     type: array
 *                     description: Latest three construction updates
 *                     items:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create construction phase
 *     description: Create a new construction phase for a specific project.
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: Foundation
 *               description:
 *                 type: string
 *                 example: Foundation and excavation work
 *               sortOrder:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 example: 1
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-01-15T00:00:00.000Z
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-03-15T00:00:00.000Z
 *               budget:
 *                 type: number
 *                 exclusiveMinimum: 0
 *                 example: 15000000
 *     responses:
 *       201:
 *         description: Construction phase created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clxyz123phase001
 *                 projectId:
 *                   type: string
 *                   example: clxyz123project001
 *                 name:
 *                   type: string
 *                   example: Foundation
 *                 description:
 *                   type: string
 *                   example: Foundation and excavation work
 *                 sortOrder:
 *                   type: integer
 *                   example: 1
 *                 startDate:
 *                   type: string
 *                   format: date-time
 *                 endDate:
 *                   type: string
 *                   format: date-time
 *                 budget:
 *                   type: number
 *                   example: 15000000
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const project = await prisma.project.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!project) return notFoundResponse("Project");

    const phases = await prisma.constructionPhase.findMany({
      where: { projectId: params.id },
      include: {
        _count: { select: { updates: true, materials: true } },
        updates: { orderBy: { date: "desc" }, take: 3, include: { images: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(phases);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const project = await prisma.project.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!project) return notFoundResponse("Project");

    const body = await request.json();
    const parsed = createPhaseSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const phase = await prisma.constructionPhase.create({
      data: {
        projectId: params.id,
        name: d.name,
        description: d.description,
        sortOrder: d.sortOrder,
        startDate: d.startDate ? new Date(d.startDate) : undefined,
        endDate: d.endDate ? new Date(d.endDate) : undefined,
        budget: d.budget,
      },
    });
    return NextResponse.json(phase, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
