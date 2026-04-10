import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
      include: {
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        transactions: { orderBy: { date: "desc" }, take: 10 },
        materialRequisitions: { orderBy: { requestDate: "desc" }, take: 10 },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!vendor) return notFoundResponse("Vendor");
    return NextResponse.json(vendor);
  } catch (error) { return serverErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Vendor");

    const body = await request.json();
    const vendor = await prisma.vendor.update({ where: { id: params.id }, data: body });
    return NextResponse.json(vendor);
  } catch (error) { return serverErrorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Vendor");

    await prisma.vendor.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ message: "Vendor deactivated" });
  } catch (error) { return serverErrorResponse(error); }
}
