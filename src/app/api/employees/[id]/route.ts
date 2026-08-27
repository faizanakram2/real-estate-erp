import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get employee details
 *     description: |
 *       Returns detailed information about a specific employee.
 *       The response also includes the employee's latest 30 attendance
 *       records and latest 12 payroll records.
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
 *     responses:
 *       200:
 *         description: Employee details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "emp_123"
 *
 *                 organizationId:
 *                   type: string
 *                   example: "org_123"
 *
 *                 employeeCode:
 *                   type: string
 *                   example: "EMP-001"
 *
 *                 firstName:
 *                   type: string
 *                   example: "Ahmed"
 *
 *                 lastName:
 *                   type: string
 *                   example: "Khan"
 *
 *                 email:
 *                   type: string
 *                   format: email
 *                   nullable: true
 *                   example: "ahmed.khan@example.com"
 *
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                   example: "+923001234567"
 *
 *                 cnic:
 *                   type: string
 *                   nullable: true
 *                   example: "35202-1234567-1"
 *
 *                 dateOfBirth:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "1995-05-15T00:00:00.000Z"
 *
 *                 joiningDate:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-01T00:00:00.000Z"
 *
 *                 department:
 *                   type: string
 *                   nullable: true
 *                   example: "Finance"
 *
 *                 designation:
 *                   type: string
 *                   nullable: true
 *                   example: "Accountant"
 *
 *                 employmentType:
 *                   type: string
 *                   enum:
 *                     - FULL_TIME
 *                     - PART_TIME
 *                     - CONTRACT
 *                     - DAILY_WAGE
 *                   example: "FULL_TIME"
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
 *                 deductions:
 *                   type: number
 *                   format: double
 *                   example: 5000
 *
 *                 bankName:
 *                   type: string
 *                   nullable: true
 *                   example: "Meezan Bank"
 *
 *                 bankAccount:
 *                   type: string
 *                   nullable: true
 *                   example: "PK12MEZN0000001234567890"
 *
 *                 address:
 *                   type: string
 *                   nullable: true
 *                   example: "Gulberg, Lahore"
 *
 *                 emergencyName:
 *                   type: string
 *                   nullable: true
 *                   example: "Ali Khan"
 *
 *                 emergencyPhone:
 *                   type: string
 *                   nullable: true
 *                   example: "+923111234567"
 *
 *                 status:
 *                   type: string
 *                   example: "ACTIVE"
 *
 *                 attendances:
 *                   type: array
 *                   description: Latest 30 attendance records.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "attendance_123"
 *                       employeeId:
 *                         type: string
 *                         example: "emp_123"
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T00:00:00.000Z"
 *                       checkIn:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2026-08-27T09:00:00.000Z"
 *                       checkOut:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2026-08-27T17:30:00.000Z"
 *                       status:
 *                         type: string
 *                         enum:
 *                           - PRESENT
 *                           - ABSENT
 *                           - HALF_DAY
 *                           - LEAVE
 *                           - HOLIDAY
 *                         example: "PRESENT"
 *                       hoursWorked:
 *                         type: number
 *                         nullable: true
 *                         example: 8.5
 *                       overtime:
 *                         type: number
 *                         nullable: true
 *                         example: 1.5
 *                       latitude:
 *                         type: number
 *                         nullable: true
 *                         example: 30.0444
 *                       longitude:
 *                         type: number
 *                         nullable: true
 *                         example: 31.2357
 *                       notes:
 *                         type: string
 *                         nullable: true
 *                         example: "Regular working day"
 *
 *                 payrolls:
 *                   type: array
 *                   description: Latest 12 payroll records.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "payroll_123"
 *                       employeeId:
 *                         type: string
 *                         example: "emp_123"
 *                       month:
 *                         type: integer
 *                         example: 8
 *                       year:
 *                         type: integer
 *                         example: 2026
 *                       baseSalary:
 *                         type: number
 *                         format: double
 *                         example: 75000
 *                       allowances:
 *                         type: number
 *                         format: double
 *                         example: 10000
 *                       overtime:
 *                         type: number
 *                         format: double
 *                         example: 5000
 *                       deductions:
 *                         type: number
 *                         format: double
 *                         example: 3000
 *                       tax:
 *                         type: number
 *                         format: double
 *                         example: 5000
 *                       netSalary:
 *                         type: number
 *                         format: double
 *                         example: 82000
 *                       notes:
 *                         type: string
 *                         nullable: true
 *                         example: "August 2026 payroll"
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-01T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
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

/**
 * @swagger
 * /api/employees/{id}:
 *   patch:
 *     summary: Update employee
 *     description: |
 *       Updates an existing employee. The employee must belong to the
 *       authenticated user's organization.
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
 *             description: Fields to update. All fields are optional.
 *             properties:
 *               employeeCode:
 *                 type: string
 *                 example: "EMP-001"
 *
 *               firstName:
 *                 type: string
 *                 example: "Ahmed"
 *
 *               lastName:
 *                 type: string
 *                 example: "Khan"
 *
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ahmed.khan@example.com"
 *
 *               phone:
 *                 type: string
 *                 example: "+923001234567"
 *
 *               cnic:
 *                 type: string
 *                 example: "35202-1234567-1"
 *
 *               dateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 example: "1995-05-15T00:00:00.000Z"
 *
 *               joiningDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-01T00:00:00.000Z"
 *
 *               department:
 *                 type: string
 *                 example: "Finance"
 *
 *               designation:
 *                 type: string
 *                 example: "Senior Accountant"
 *
 *               employmentType:
 *                 type: string
 *                 enum:
 *                   - FULL_TIME
 *                   - PART_TIME
 *                   - CONTRACT
 *                   - DAILY_WAGE
 *                 example: "FULL_TIME"
 *
 *               baseSalary:
 *                 type: number
 *                 format: double
 *                 example: 80000
 *
 *               allowances:
 *                 type: number
 *                 format: double
 *                 example: 12000
 *
 *               deductions:
 *                 type: number
 *                 format: double
 *                 example: 5000
 *
 *               bankName:
 *                 type: string
 *                 example: "Meezan Bank"
 *
 *               bankAccount:
 *                 type: string
 *                 example: "PK12MEZN0000001234567890"
 *
 *               address:
 *                 type: string
 *                 example: "Gulberg, Lahore"
 *
 *               emergencyName:
 *                 type: string
 *                 example: "Ali Khan"
 *
 *               emergencyPhone:
 *                 type: string
 *                 example: "+923111234567"
 *
 *               status:
 *                 type: string
 *                 example: "ACTIVE"
 *
 *     responses:
 *       200:
 *         description: Employee updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "emp_123"
 *                 employeeCode:
 *                   type: string
 *                   example: "EMP-001"
 *                 firstName:
 *                   type: string
 *                   example: "Ahmed"
 *                 lastName:
 *                   type: string
 *                   example: "Khan"
 *                 email:
 *                   type: string
 *                   nullable: true
 *                   example: "ahmed.khan@example.com"
 *                 department:
 *                   type: string
 *                   nullable: true
 *                   example: "Finance"
 *                 designation:
 *                   type: string
 *                   nullable: true
 *                   example: "Senior Accountant"
 *                 employmentType:
 *                   type: string
 *                   example: "FULL_TIME"
 *                 baseSalary:
 *                   type: number
 *                   example: 80000
 *                 status:
 *                   type: string
 *                   example: "ACTIVE"
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
