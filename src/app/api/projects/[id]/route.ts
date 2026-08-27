import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { updateProjectSchema } from "@/lib/validators/project";

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get project details
 *     description: Get detailed information about a specific project, including blocks, plots, construction phases, and related document counts.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: "clxproject123"
 *     responses:
 *       200:
 *         description: Project details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        blocks: true,
        plots: {
          include: { block: true },
          orderBy: { plotNumber: "asc" },
        },
        constructionPhases: {
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: { plots: true, blocks: true, documents: true },
        },
      },
    });

    if (!project) return notFoundResponse("Project");

    return NextResponse.json(project);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/projects/{id}:
 *   patch:
 *     tags:
 *       - Projects
 *     summary: Update project
 *     description: Update an existing project belonging to the current user's organization.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: "clxproject123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProjectRequest'
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const existing = await prisma.project.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Project");

    const data = parsed.data;
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        expectedCompletion: data.expectedCompletion
          ? new Date(data.expectedCompletion)
          : undefined,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Delete project
 *     description: Delete a project. A project cannot be deleted if it already contains plots.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: "clxproject123"
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project deleted
 *       400:
 *         description: Cannot delete project with existing plots
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.project.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
      include: { _count: { select: { plots: true } } },
    });
    if (!existing) return notFoundResponse("Project");

    if (existing._count.plots > 0) {
      return NextResponse.json(
        { error: "Cannot delete project with existing plots" },
        { status: 400 }
      );
    }

    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Project deleted" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
