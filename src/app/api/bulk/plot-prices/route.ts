import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const bulkPriceSchema = z.object({
  plotIds: z.array(z.string()).min(1),
  adjustmentType: z.enum(["FIXED", "PERCENTAGE"]),
  adjustmentValue: z.number(), // positive = increase, negative = decrease
  reason: z.string().min(1, "Reason is required"),
});

/**
 * POST /api/bulk/plot-prices
 * Bulk update plot prices with history tracking
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("plots:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = bulkPriceSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const { plotIds, adjustmentType, adjustmentValue, reason } = parsed.data;

    const plots = await prisma.plot.findMany({
      where: {
        id: { in: plotIds },
        status: "AVAILABLE", // only update available plots
        project: { organizationId: session.user.organizationId },
      },
    });

    let updated = 0;
    for (const plot of plots) {
      const oldPrice = Number(plot.totalPrice);
      let newPrice: number;

      if (adjustmentType === "PERCENTAGE") {
        newPrice = Math.round(oldPrice * (1 + adjustmentValue / 100));
      } else {
        newPrice = oldPrice + adjustmentValue;
      }

      if (newPrice < 0) continue;

      await prisma.$transaction(async (tx) => {
        // Record price history
        await tx.plotPriceHistory.create({
          data: {
            plotId: plot.id,
            oldPrice: oldPrice,
            newPrice: newPrice,
            reason,
            changedById: session.user.id,
          },
        });

        // Update plot price
        await tx.plot.update({
          where: { id: plot.id },
          data: {
            basePrice: newPrice - Number(plot.premiumAmount),
            totalPrice: newPrice,
            pricePerUnit: plot.size > 0 ? newPrice / plot.size : null,
          },
        });
      });

      updated++;
    }

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Plot",
      entityId: "bulk-price-update",
      changes: { plotCount: updated, adjustmentType, adjustmentValue, reason },
    });

    return NextResponse.json({
      message: `${updated} plot prices updated`,
      updated,
      skipped: plotIds.length - updated,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
