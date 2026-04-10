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
