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
