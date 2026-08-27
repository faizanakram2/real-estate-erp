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

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get employees
 *     description: |
 *       Returns a paginated list of employees belonging to the authenticated
 *       user's organization. Supports filtering by department and status,
 *       searching by employee name, employee code, or phone number, and
 *       sorting.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
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
 *         description: Number of employees per page.
 *         example: 10
 *
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by employee name, employee code, or phone number.
 *         example: "EMP-001"
 *
 *       - in: query
 *         name: department
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter employees by department.
 *         example: "Finance"
 *
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter employees by employment status.
 *         example: "ACTIVE"
 *
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field used to sort the employee list.
 *         example: "firstName"
 *
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *         description: Sort direction.
 *         example: "asc"
 *
 *     responses:
 *       200:
 *         description: Employees retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Employee'
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
 *                       example: 25
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

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Create employee
 *     description: |
 *       Creates a new employee in the authenticated user's organization.
 *       The organization ID is automatically taken from the authenticated
 *       user's session.
 *     tags:
 *       - Employees
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEmployeeRequest'
 *
 *     responses:
 *       201:
 *         description: Employee created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

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
