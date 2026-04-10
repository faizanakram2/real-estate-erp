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
