import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/activity/:entityType/:entityId
 * Get activity timeline for any entity (customer, booking, plot, project)
 * Aggregates audit logs, payments, installments, notes, status changes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { entityType: string; entityId: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { entityType, entityId } = params;
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const timeline: any[] = [];

    // Always include audit logs for this entity
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: entityType, entityId, organizationId: session.user.organizationId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    for (const log of auditLogs) {
      timeline.push({
        type: "audit",
        action: log.action,
        description: `${log.user?.name || "System"} ${log.action.toLowerCase()}d ${log.entity}`,
        changes: log.changes,
        timestamp: log.createdAt,
        user: log.user?.name,
      });
    }

    // Entity-specific timeline items
    if (entityType === "Customer" || entityType === "customer") {
      const payments = await prisma.paymentRecord.findMany({
        where: { customerId: entityId },
        select: { receiptNumber: true, amount: true, status: true, paymentMethod: true, paymentDate: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const p of payments) {
        timeline.push({
          type: "payment",
          action: p.status,
          description: `Payment PKR ${Number(p.amount).toLocaleString()} via ${p.paymentMethod} (${p.receiptNumber})`,
          timestamp: p.createdAt,
          status: p.status,
        });
      }

      const notes = await prisma.note.findMany({
        where: { customerId: entityId },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      for (const n of notes) {
        timeline.push({
          type: "note",
          action: "NOTE",
          description: n.content,
          timestamp: n.createdAt,
          user: n.author.name,
        });
      }
    }

    if (entityType === "Booking" || entityType === "booking") {
      const payments = await prisma.paymentRecord.findMany({
        where: { bookingId: entityId },
        select: { receiptNumber: true, amount: true, status: true, paymentMethod: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      for (const p of payments) {
        timeline.push({
          type: "payment",
          action: p.status,
          description: `Payment PKR ${Number(p.amount).toLocaleString()} via ${p.paymentMethod} (${p.receiptNumber})`,
          timestamp: p.createdAt,
          status: p.status,
        });
      }

      const installments = await prisma.installment.findMany({
        where: { bookingId: entityId, status: { in: ["PAID", "OVERDUE"] } },
        select: { installmentNo: true, type: true, amount: true, status: true, paidDate: true, dueDate: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      for (const i of installments) {
        timeline.push({
          type: "installment",
          action: i.status,
          description: `Installment #${i.installmentNo} (${i.type}) PKR ${Number(i.amount).toLocaleString()} — ${i.status}`,
          timestamp: i.status === "PAID" ? i.paidDate : i.updatedAt,
          status: i.status,
        });
      }
    }

    if (entityType === "Plot" || entityType === "plot") {
      const priceHistory = await prisma.plotPriceHistory.findMany({
        where: { plotId: entityId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      for (const ph of priceHistory) {
        timeline.push({
          type: "price_change",
          action: "PRICE_CHANGE",
          description: `Price changed from PKR ${Number(ph.oldPrice).toLocaleString()} to PKR ${Number(ph.newPrice).toLocaleString()}${ph.reason ? ` — ${ph.reason}` : ""}`,
          timestamp: ph.createdAt,
        });
      }
    }

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ entityType, entityId, timeline: timeline.slice(0, limit) });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
