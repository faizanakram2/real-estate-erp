import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const mr = await prisma.maintenanceRequest.findFirst({
      where: { id: params.id, createdBy: { organizationId: session.user.organizationId } },
      include: {
        plot: { select: { plotNumber: true, project: { select: { name: true } } } },
        assignee: { select: { id: true, name: true } },
        vendor: { select: { id: true, companyName: true } },
        createdBy: { select: { id: true, name: true } },
        images: true,
        comments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!mr) return notFoundResponse("Maintenance Request");
    return NextResponse.json(mr);
  } catch (error) { return serverErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id: params.id, createdBy: { organizationId: session.user.organizationId } },
    });
    if (!existing) return notFoundResponse("Maintenance Request");

    const body = await request.json();
    if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate);
    if (body.completedDate) body.completedDate = new Date(body.completedDate);
    if (body.status === "COMPLETED" && !body.completedDate) body.completedDate = new Date();

    const mr = await prisma.maintenanceRequest.update({ where: { id: params.id }, data: body });
    return NextResponse.json(mr);
  } catch (error) { return serverErrorResponse(error); }
}
