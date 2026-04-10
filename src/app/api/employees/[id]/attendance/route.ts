import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createAttendanceSchema = z.object({
  date: z.string().datetime(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]).default("PRESENT"),
  hoursWorked: z.number().min(0).optional(),
  overtime: z.number().min(0).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip } = getPaginationParams(request);
    const month = request.nextUrl.searchParams.get("month");
    const year = request.nextUrl.searchParams.get("year");

    const where: any = { employeeId: params.id, employee: { organizationId: session.user.organizationId } };
    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0);
      where.date = { gte: start, lte: end };
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({ where, skip, take: limit, orderBy: { date: "desc" } }),
      prisma.attendance.count({ where }),
    ]);

    return paginatedResponse(attendances, total, page, limit);
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
    const parsed = createAttendanceSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;
    const attendance = await prisma.attendance.create({
      data: {
        employeeId: params.id,
        date: new Date(data.date),
        checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
        checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
        status: data.status,
        hoursWorked: data.hoursWorked,
        overtime: data.overtime,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
      },
    });
    return NextResponse.json(attendance, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
