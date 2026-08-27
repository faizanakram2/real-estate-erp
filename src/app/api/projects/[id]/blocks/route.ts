import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createBlockSchema = z.object({
  name: z.string().min(1, "Block name is required"),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/projects/{id}/blocks:
 *   get:
 *     summary: Get project blocks
 *     description: Get all blocks belonging to a specific project with plot statistics.
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
 *         description: Project blocks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: clxyz123block001
 *                   projectId:
 *                     type: string
 *                     example: clxyz123project001
 *                   name:
 *                     type: string
 *                     example: Block A
 *                   description:
 *                     type: string
 *                     example: Residential Block A
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   _count:
 *                     type: object
 *                     properties:
 *                       plots:
 *                         type: integer
 *                         example: 100
 *                   stats:
 *                     type: object
 *                     properties:
 *                       totalPlots:
 *                         type: integer
 *                         example: 100
 *                       available:
 *                         type: integer
 *                         example: 60
 *                       booked:
 *                         type: integer
 *                         example: 25
 *                       sold:
 *                         type: integer
 *                         example: 15
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create project block
 *     description: Create a new block inside a specific project.
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
 *                 example: Block A
 *               description:
 *                 type: string
 *                 example: Residential Block A
 *     responses:
 *       201:
 *         description: Block created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: clxyz123block001
 *                 projectId:
 *                   type: string
 *                   example: clxyz123project001
 *                 name:
 *                   type: string
 *                   example: Block A
 *                 description:
 *                   type: string
 *                   example: Residential Block A
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
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

    const blocks = await prisma.block.findMany({
      where: { projectId: params.id },
      include: {
        _count: { select: { plots: true } },
        plots: { select: { status: true } },
      },
      orderBy: { name: "asc" },
    });

    const enriched = blocks.map((b) => ({
      ...b,
      plots: undefined,
      stats: {
        totalPlots: b._count.plots,
        available: b.plots.filter((p) => p.status === "AVAILABLE").length,
        booked: b.plots.filter((p) => p.status === "BOOKED").length,
        sold: b.plots.filter((p) => p.status === "SOLD").length,
      },
    }));

    return NextResponse.json(enriched);
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
    const parsed = createBlockSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const block = await prisma.block.create({
      data: { projectId: params.id, ...parsed.data },
    });
    return NextResponse.json(block, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
