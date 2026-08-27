import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const splitSchema = z.object({
  parts: z.number().int().min(2).max(12, "Cannot split into more than 12 parts"),
  firstDueDate: z.string().datetime(),
  intervalDays: z.number().int().min(7).max(90).default(30),
});

/**
 * POST /api/installments/:id/split
 * Split a single installment into multiple smaller ones
 */

/**
 * @swagger
 * /api/installments/{id}/split:
 *   post:
 *     summary: Split an installment
 *     description: |
 *       Splits a single PENDING or OVERDUE installment into multiple smaller
 *       installments.
 *
 *       The original installment is marked as WAIVED and the specified number
 *       of new installments are created using the original installment's
 *       booking, installment type, and outstanding balance.
 *
 *       The final installment receives any remainder caused by dividing the
 *       original amount equally among the requested parts.
 *
 *       The split operation is performed inside a database transaction and
 *       is recorded in the audit log.
 *     tags:
 *       - Installments
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the installment to split.
 *         example: "clx123abc456"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - parts
 *               - firstDueDate
 *             properties:
 *               parts:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 12
 *                 example: 4
 *                 description: Number of installments to create. Must be between 2 and 12.
 *
 *               firstDueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-09-15T00:00:00.000Z"
 *                 description: Due date of the first newly created installment.
 *
 *               intervalDays:
 *                 type: integer
 *                 minimum: 7
 *                 maximum: 90
 *                 default: 30
 *                 example: 30
 *                 description: Number of days between each newly created installment.
 *
 *     responses:
 *       201:
 *         description: Installment split successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Installment split into 4 parts"
 *
 *                 installments:
 *                   type: array
 *                   description: Newly created installments.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "clx987xyz123"
 *
 *                       bookingId:
 *                         type: string
 *                         example: "booking_123"
 *
 *                       installmentNo:
 *                         type: integer
 *                         example: 8
 *
 *                       type:
 *                         type: string
 *                         example: "MONTHLY"
 *
 *                       amount:
 *                         type: number
 *                         format: double
 *                         example: 25000
 *
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-09-15T00:00:00.000Z"
 *
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *
 *                       balanceAmount:
 *                         type: number
 *                         format: double
 *                         example: 25000
 *
 *                       paidAmount:
 *                         type: number
 *                         format: double
 *                         example: 0
 *
 *                       paidDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *
 *                       latePenalty:
 *                         type: number
 *                         format: double
 *                         example: 0
 *
 *                       notes:
 *                         type: string
 *                         example: "Split 1/4 from installment #7"
 *
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T10:00:00.000Z"
 *
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error. Parts, firstDueDate, or intervalDays is invalid.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the installments:write permission.
 *
 *       404:
 *         description: Installment not found, or the installment cannot be split because it is not PENDING or OVERDUE.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("installments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = splitSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const installment = await prisma.installment.findFirst({
      where: {
        id: params.id,
        status: { in: ["PENDING", "OVERDUE"] },
        booking: { plot: { project: { organizationId: session.user.organizationId } } },
      },
    });
    if (!installment) return notFoundResponse("Installment (must be PENDING or OVERDUE)");

    const { parts, firstDueDate, intervalDays } = parsed.data;
    const totalAmount = Number(installment.balanceAmount) || Number(installment.amount);
    const partAmount = Math.floor(totalAmount / parts);
    const remainder = totalAmount - partAmount * parts;

    const newInstallments = await prisma.$transaction(async (tx) => {
      // Cancel original installment
      await tx.installment.update({
        where: { id: params.id },
        data: { status: "WAIVED", notes: `Split into ${parts} parts` },
      });

      // Get max installment number for this booking
      const maxInst = await tx.installment.findFirst({
        where: { bookingId: installment.bookingId },
        orderBy: { installmentNo: "desc" },
      });
      const nextNo = (maxInst?.installmentNo || 0) + 1;

      // Create split installments
      const created = [];
      for (let i = 0; i < parts; i++) {
        const dueDate = new Date(firstDueDate);
        dueDate.setDate(dueDate.getDate() + i * intervalDays);
        const amount = i === parts - 1 ? partAmount + remainder : partAmount;

        const inst = await tx.installment.create({
          data: {
            bookingId: installment.bookingId,
            installmentNo: nextNo + i,
            type: installment.type,
            amount,
            dueDate,
            status: "PENDING",
            balanceAmount: amount,
            notes: `Split ${i + 1}/${parts} from installment #${installment.installmentNo}`,
          },
        });
        created.push(inst);
      }
      return created;
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Installment",
      entityId: params.id,
      changes: { action: "split", parts, originalAmount: totalAmount },
    });

    return NextResponse.json({
      message: `Installment split into ${parts} parts`,
      installments: newInstallments,
    }, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
