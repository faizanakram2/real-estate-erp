import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const phase = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
      include: {
        project: { select: { id: true, name: true } },
        updates: { orderBy: { date: "desc" }, include: { updatedBy: { select: { name: true } }, images: true } },
        materials: { orderBy: { requestDate: "desc" }, include: { vendor: { select: { companyName: true } } } },
      },
    });
    if (!phase) return notFoundResponse("Construction Phase");
    return NextResponse.json(phase);
  } catch (error) { return serverErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
    });
    if (!existing) return notFoundResponse("Construction Phase");

    const body = await request.json();
    if (body.startDate) body.startDate = new Date(body.startDate);
    if (body.endDate) body.endDate = new Date(body.endDate);

    const phase = await prisma.constructionPhase.update({ where: { id: params.id }, data: body });
    return NextResponse.json(phase);
  } catch (error) { return serverErrorResponse(error); }
}
