import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const employee = await prisma.employee.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
      include: {
        attendances: { orderBy: { date: "desc" }, take: 30 },
        payrolls: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 },
      },
    });
    if (!employee) return notFoundResponse("Employee");
    return NextResponse.json(employee);
  } catch (error) { return serverErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.employee.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Employee");

    const body = await request.json();
    if (body.joiningDate) body.joiningDate = new Date(body.joiningDate);
    if (body.dateOfBirth) body.dateOfBirth = new Date(body.dateOfBirth);

    const employee = await prisma.employee.update({ where: { id: params.id }, data: body });
    return NextResponse.json(employee);
  } catch (error) { return serverErrorResponse(error); }
}
