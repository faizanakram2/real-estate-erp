import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { z } from "zod";

const bulkAttendanceSchema = z.object({
  date: z.string().datetime(),
  records: z.array(z.object({
    employeeId: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"]),
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional(),
    notes: z.string().optional(),
  })).min(1),
});

/**
 * POST /api/bulk/attendance
 * Mark attendance for multiple employees at once
 */

/**
 * @swagger
 * /api/bulk/attendance:
 *   post:
 *     tags:
 *       - Bulk Operations
 *     summary: Mark attendance for multiple employees
 *     description: >
 *       Creates attendance records for multiple employees for a specific date.
 *       Requires the `employees:write` permission.
 *       Duplicate employee/date attendance records are skipped.
 *     security:
 *       - NextAuthSession: []
 *
 *     requestBody:
 *       required: true
 *       description: Attendance date and employee attendance records.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - records
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Date for which attendance is being marked.
 *                 example: "2026-08-27T00:00:00.000Z"
 *
 *               records:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - employeeId
 *                     - status
 *                   properties:
 *                     employeeId:
 *                       type: string
 *                       description: Employee ID.
 *                       example: "employee-id-here"
 *
 *                     status:
 *                       type: string
 *                       enum:
 *                         - PRESENT
 *                         - ABSENT
 *                         - HALF_DAY
 *                         - LEAVE
 *                         - HOLIDAY
 *                       example: PRESENT
 *
 *                     checkIn:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2026-08-27T09:00:00.000Z"
 *
 *                     checkOut:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2026-08-27T17:00:00.000Z"
 *
 *                     notes:
 *                       type: string
 *                       nullable: true
 *                       example: "Arrived on time"
 *
 *           example:
 *             date: "2026-08-27T00:00:00.000Z"
 *             records:
 *               - employeeId: "employee-123"
 *                 status: "PRESENT"
 *                 checkIn: "2026-08-27T09:00:00.000Z"
 *                 checkOut: "2026-08-27T17:00:00.000Z"
 *                 notes: "Regular working day"
 *
 *               - employeeId: "employee-456"
 *                 status: "HALF_DAY"
 *                 checkIn: "2026-08-27T09:30:00.000Z"
 *                 checkOut: "2026-08-27T13:00:00.000Z"
 *
 *               - employeeId: "employee-789"
 *                 status: "ABSENT"
 *
 *     responses:
 *       200:
 *         description: Attendance records processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "2 attendance records created, 1 skipped (duplicates)"
 *
 *                 created:
 *                   type: integer
 *                   description: Number of attendance records successfully created.
 *                   example: 2
 *
 *                 skipped:
 *                   type: integer
 *                   description: Number of duplicate records skipped.
 *                   example: 1
 *
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Validation failed"
 *
 *                 details:
 *                   type: object
 *
 *       401:
 *         description: Unauthorized - Authentication required.
 *
 *       403:
 *         description: Forbidden - User does not have the employees write permission.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("employees:write");
    if (isErrorResponse(auth)) return auth;

    const body = await request.json();
    const parsed = bulkAttendanceSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const { date, records } = parsed.data;
    let created = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        await prisma.attendance.create({
          data: {
            employeeId: record.employeeId,
            date: new Date(date),
            status: record.status,
            checkIn: record.checkIn ? new Date(record.checkIn) : undefined,
            checkOut: record.checkOut ? new Date(record.checkOut) : undefined,
            notes: record.notes,
          },
        });
        created++;
      } catch {
        skipped++; // duplicate date+employee
      }
    }

    return NextResponse.json({ message: `${created} attendance records created, ${skipped} skipped (duplicates)`, created, skipped });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
