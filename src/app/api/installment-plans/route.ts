import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { createInstallmentPlanSchema } from "@/lib/validators/installment-plan";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const plans = await prisma.installmentPlan.findMany({
      where: { isActive: true },
      orderBy: { durationMonths: "asc" },
    });

    return NextResponse.json(plans);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createInstallmentPlanSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const plan = await prisma.installmentPlan.create({
      data: parsed.data,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
