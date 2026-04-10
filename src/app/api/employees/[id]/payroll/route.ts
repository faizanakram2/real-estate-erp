import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  allowances: z.number().min(0).default(0),
  overtime: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId: params.id, employee: { organizationId: session.user.organizationId } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return NextResponse.json(payrolls);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const employee = await prisma.employee.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!employee) return notFoundResponse("Employee");

    const body = await request.json();
    const parsed = createPayrollSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const netSalary = Number(employee.baseSalary) + d.allowances + d.overtime - d.deductions - d.tax;

    const payroll = await prisma.payroll.create({
      data: {
        employeeId: params.id,
        month: d.month,
        year: d.year,
        baseSalary: employee.baseSalary,
        allowances: d.allowances,
        overtime: d.overtime,
        deductions: d.deductions,
        tax: d.tax,
        netSalary,
        notes: d.notes,
      },
    });
    return NextResponse.json(payroll, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
