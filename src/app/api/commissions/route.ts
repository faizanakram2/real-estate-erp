import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse, getPaginationParams } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createCommissionSchema = z.object({
  bookingId: z.string().min(1),
  agentId: z.string().min(1),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  rate: z.number().positive(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("payments:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const { page, limit, skip } = getPaginationParams(request);
    const agentId = request.nextUrl.searchParams.get("agentId");
    const status = request.nextUrl.searchParams.get("status");

    const where: any = {
      agent: { organizationId: session.user.organizationId },
    };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where, skip, take: limit,
        include: {
          agent: { select: { id: true, name: true } },
          booking: {
            select: {
              bookingNumber: true, netAmount: true,
              customer: { select: { firstName: true, lastName: true } },
              plot: { select: { plotNumber: true, project: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.commission.count({ where }),
    ]);

    // Summary
    const summary = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId } },
      _sum: { commissionAmount: true },
      _count: true,
    });
    const pendingSum = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId }, status: "PENDING" },
      _sum: { commissionAmount: true },
    });
    const paidSum = await prisma.commission.aggregate({
      where: { agent: { organizationId: session.user.organizationId }, status: "PAID" },
      _sum: { commissionAmount: true },
    });

    return NextResponse.json({
      data: commissions,
      summary: {
        totalCommission: Number(summary._sum.commissionAmount || 0),
        pendingAmount: Number(pendingSum._sum.commissionAmount || 0),
        paidAmount: Number(paidSum._sum.commissionAmount || 0),
        totalEntries: summary._count,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("payments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = createCommissionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;

    const booking = await prisma.booking.findFirst({
      where: { id: d.bookingId, plot: { project: { organizationId: session.user.organizationId } } },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const baseAmount = Number(booking.netAmount);
    const commissionAmount = d.commissionType === "PERCENTAGE"
      ? Math.round(baseAmount * (d.rate / 100))
      : d.rate;

    const commission = await prisma.commission.create({
      data: {
        bookingId: d.bookingId,
        agentId: d.agentId,
        commissionType: d.commissionType,
        rate: d.rate,
        baseAmount,
        commissionAmount,
      },
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Commission",
      entityId: commission.id,
      changes: { agentId: d.agentId, bookingId: d.bookingId, amount: commissionAmount },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
