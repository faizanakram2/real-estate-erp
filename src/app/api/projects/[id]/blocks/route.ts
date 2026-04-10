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
