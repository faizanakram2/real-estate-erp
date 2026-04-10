import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { verifyPaymentSchema } from "@/lib/validators/payment";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const payment = await prisma.paymentRecord.findFirst({
      where: {
        id: params.id,
        booking: {
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
      include: {
        customer: true,
        booking: {
          include: {
            plot: { include: { project: true, block: true } },
          },
        },
        installment: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    });

    if (!payment) return notFoundResponse("Payment");
    return NextResponse.json(payment);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// Verify / Confirm / Reject payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = verifyPaymentSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const payment = await prisma.paymentRecord.findFirst({
      where: {
        id: params.id,
        booking: {
          plot: { project: { organizationId: session.user.organizationId } },
        },
      },
    });
    if (!payment) return notFoundResponse("Payment");

    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.paymentRecord.update({
        where: { id: params.id },
        data: {
          status: data.status,
          verifiedById: session.user.id,
          verifiedAt: new Date(),
          rejectionReason: data.rejectionReason,
        },
      });

      // If confirmed, update the installment status
      if (data.status === "CONFIRMED" && payment.installmentId) {
        const installment = await tx.installment.findUnique({
          where: { id: payment.installmentId },
        });

        if (installment) {
          const newPaidAmount =
            Number(installment.paidAmount) + Number(payment.amount);
          const newBalance = Number(installment.amount) - newPaidAmount;

          await tx.installment.update({
            where: { id: payment.installmentId },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: Math.max(0, newBalance),
              paidDate: newBalance <= 0 ? new Date() : undefined,
              status: newBalance <= 0 ? "PAID" : "PARTIAL",
            },
          });
        }
      }

      return updatedPayment;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
