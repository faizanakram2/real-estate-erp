import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { updatePlotSchema } from "@/lib/validators/plot";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const plot = await prisma.plot.findFirst({
      where: {
        id: params.id,
        project: { organizationId: session.user.organizationId },
      },
      include: {
        project: { select: { id: true, name: true } },
        block: { select: { id: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
        bookings: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        images: true,
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!plot) return notFoundResponse("Plot");
    return NextResponse.json(plot);
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
    const parsed = updatePlotSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const existing = await prisma.plot.findFirst({
      where: {
        id: params.id,
        project: { organizationId: session.user.organizationId },
      },
    });
    if (!existing) return notFoundResponse("Plot");

    const plot = await prisma.plot.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(plot);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
