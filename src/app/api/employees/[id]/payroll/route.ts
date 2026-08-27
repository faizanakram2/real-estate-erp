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

/**
 * @swagger
 * /api/employees/{id}/payroll:
 *   get:
 *     summary: Get employee payroll records
 *     description: |
 *       Returns all payroll records for a specific employee.
 *       The employee must belong to the authenticated user's organization.
 *       Payroll records are ordered by year and month in descending order.
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
 *     responses:
 *       200:
 *         description: Payroll records retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "payroll_123"
 *
 *                   employeeId:
 *                     type: string
 *                     example: "emp_123"
 *
 *                   month:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 12
 *                     example: 8
 *
 *                   year:
 *                     type: integer
 *                     example: 2026
 *
 *                   baseSalary:
 *                     type: number
 *                     format: double
 *                     example: 75000
 *
 *                   allowances:
 *                     type: number
 *                     format: double
 *                     example: 10000
 *
 *                   overtime:
 *                     type: number
 *                     format: double
 *                     example: 5000
 *
 *                   deductions:
 *                     type: number
 *                     format: double
 *                     example: 3000
 *
 *                   tax:
 *                     type: number
 *                     format: double
 *                     example: 5000
 *
 *                   netSalary:
 *                     type: number
 *                     format: double
 *                     example: 82000
 *
 *                   notes:
 *                     type: string
 *                     nullable: true
 *                     example: "August 2026 payroll"
 *
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:30:00.000Z"
 *
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:30:00.000Z"
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

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId: params.id, employee: { organizationId: session.user.organizationId } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return NextResponse.json(payrolls);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/employees/{id}/payroll:
 *   post:
 *     summary: Create employee payroll
 *     description: |
 *       Creates a payroll record for a specific employee.
 *       The employee's base salary is automatically retrieved from the
 *       employee record. Net salary is calculated as:
 *       base salary + allowances + overtime - deductions - tax.
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
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 example: 8
 *                 description: Payroll month.
 *
 *               year:
 *                 type: integer
 *                 minimum: 2020
 *                 example: 2026
 *                 description: Payroll year.
 *
 *               allowances:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 default: 0
 *                 example: 10000
 *                 description: Employee allowances.
 *
 *               overtime:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 default: 0
 *                 example: 5000
 *                 description: Overtime amount.
 *
 *               deductions:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 default: 0
 *                 example: 3000
 *                 description: Employee deductions.
 *
 *               tax:
 *                 type: number
 *                 format: double
 *                 minimum: 0
 *                 default: 0
 *                 example: 5000
 *                 description: Tax deducted from salary.
 *
 *               notes:
 *                 type: string
 *                 example: "August 2026 payroll"
 *
 *     responses:
 *       201:
 *         description: Payroll created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "payroll_123"
 *
 *                 employeeId:
 *                   type: string
 *                   example: "emp_123"
 *
 *                 month:
 *                   type: integer
 *                   example: 8
 *
 *                 year:
 *                   type: integer
 *                   example: 2026
 *
 *                 baseSalary:
 *                   type: number
 *                   format: double
 *                   example: 75000
 *
 *                 allowances:
 *                   type: number
 *                   format: double
 *                   example: 10000
 *
 *                 overtime:
 *                   type: number
 *                   format: double
 *                   example: 5000
 *
 *                 deductions:
 *                   type: number
 *                   format: double
 *                   example: 3000
 *
 *                 tax:
 *                   type: number
 *                   format: double
 *                   example: 5000
 *
 *                 netSalary:
 *                   type: number
 *                   format: double
 *                   example: 82000
 *
 *                 notes:
 *                   type: string
 *                   nullable: true
 *                   example: "August 2026 payroll"
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
