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
