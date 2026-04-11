import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, notFoundResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const waiveSchema = z.object({
  waiveAmount: z.number().positive("Waive amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
});

/**
 * PATCH /api/installments/:id/waive-penalty
 * Waive (fully or partially) the late penalty on an installment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("installments:waive");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = waiveSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const installment = await prisma.installment.findFirst({
      where: {
        id: params.id,
        booking: { plot: { project: { organizationId: session.user.organizationId } } },
      },
    });
    if (!installment) return notFoundResponse("Installment");

    const currentPenalty = Number(installment.latePenalty);
    const waiveAmount = Math.min(parsed.data.waiveAmount, currentPenalty);
    const newWaived = Number(installment.waivedPenalty) + waiveAmount;

    const updated = await prisma.installment.update({
      where: { id: params.id },
      data: {
        latePenalty: currentPenalty - waiveAmount,
        waivedPenalty: newWaived,
        notes: `Penalty waived: PKR ${waiveAmount} — Reason: ${parsed.data.reason}`,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "WAIVE",
      entity: "Installment",
      entityId: params.id,
      changes: { waiveAmount, reason: parsed.data.reason, remainingPenalty: currentPenalty - waiveAmount },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
