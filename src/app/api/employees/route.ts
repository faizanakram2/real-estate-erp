import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  joiningDate: z.string().datetime(),
  department: z.string().optional(),
  designation: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "DAILY_WAGE"]).default("FULL_TIME"),
  baseSalary: z.number().positive(),
  allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } = getPaginationParams(request);
    const department = request.nextUrl.searchParams.get("department");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = { organizationId: session.user.organizationId };
    if (department) where.department = department;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.employee.count({ where }),
    ]);

    return paginatedResponse(employees, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;
    const employee = await prisma.employee.create({
      data: {
        organizationId: session.user.organizationId,
        ...data,
        email: data.email || null,
        joiningDate: new Date(data.joiningDate),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
