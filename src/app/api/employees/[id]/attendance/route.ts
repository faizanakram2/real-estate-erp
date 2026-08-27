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

/**
 * @swagger
 * /api/employees/{id}/attendance:
 *   get:
 *     summary: Get employee attendance
 *     description: |
 *       Returns a paginated list of attendance records for a specific employee.
 *       Optionally filters attendance records by month and year.
 *       The employee must belong to the authenticated user's organization.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID.
 *         example: "emp_123"
 *
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of attendance records per page.
 *         example: 10
 *
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month number. Must be provided together with year.
 *         example: 8
 *
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           example: 2026
 *         description: Year. Must be provided together with month.
 *         example: 2026
 *
 *     responses:
 *       200:
 *         description: Employee attendance retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Attendance'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 22
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

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

/**
 * @swagger
 * /api/employees/{id}/attendance:
 *   post:
 *     summary: Create employee attendance
 *     description: |
 *       Creates a new attendance record for a specific employee.
 *       The employee must belong to the authenticated user's organization.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID.
 *         example: "emp_123"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAttendanceRequest'
 *
 *     responses:
 *       201:
 *         description: Attendance record created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attendance'
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Employee not found.
 *
 *       500:
 *         description: Internal server error.
 */

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
