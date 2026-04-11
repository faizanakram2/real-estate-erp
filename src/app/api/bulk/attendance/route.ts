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
