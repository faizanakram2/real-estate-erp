import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createRequisitionSchema = z.object({
  vendorId: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitCost: z.number().positive(),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const materials = await prisma.materialRequisition.findMany({
      where: { phaseId: params.id, phase: { project: { organizationId: session.user.organizationId } } },
      include: { vendor: { select: { companyName: true } } },
      orderBy: { requestDate: "desc" },
    });
    return NextResponse.json(materials);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const phase = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
    });
    if (!phase) return notFoundResponse("Construction Phase");

    const body = await request.json();
    const parsed = createRequisitionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const requisition = await prisma.materialRequisition.create({
      data: {
        phaseId: params.id,
        vendorId: d.vendorId,
        itemName: d.itemName,
        quantity: d.quantity,
        unit: d.unit,
        unitCost: d.unitCost,
        totalCost: d.quantity * d.unitCost,
        deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : undefined,
        notes: d.notes,
      },
    });
    return NextResponse.json(requisition, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
