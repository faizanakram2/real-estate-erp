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
