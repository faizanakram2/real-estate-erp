import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { updateCustomerSchema } from "@/lib/validators/customer";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const customer = await prisma.customer.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        bookings: {
          include: {
            plot: {
              select: {
                plotNumber: true,
                type: true,
                size: true,
                sizeUnit: true,
                project: { select: { name: true } },
                block: { select: { name: true } },
              },
            },
            installments: { orderBy: { dueDate: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        paymentRecords: { orderBy: { paymentDate: "desc" }, take: 20 },
        documents: { orderBy: { createdAt: "desc" } },
        notesList: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!customer) return notFoundResponse("Customer");
    return NextResponse.json(customer);
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
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const existing = await prisma.customer.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Customer");

    const data = parsed.data;
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : undefined,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
