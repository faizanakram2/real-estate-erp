import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * POST /api/reminders
 * Generate payment reminders for upcoming/overdue installments.
 * Creates in-app notifications (ready for SMS/WhatsApp integration).
 * Call daily via cron or manually.
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await authorize("installments:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const orgId = session.user.organizationId;
    const now = new Date();
    const in7Days = new Date(); in7Days.setDate(now.getDate() + 7);
    const in3Days = new Date(); in3Days.setDate(now.getDate() + 3);
    const in1Day = new Date(); in1Day.setDate(now.getDate() + 1);

    // Get templates
    const templates = await prisma.notificationTemplate.findMany({
      where: { organizationId: orgId, isActive: true },
    });
    const templateMap = new Map(templates.map((t) => [t.name, t]));

    // Find installments due in 7, 3, 1 days and overdue
    const upcomingInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { gte: now, lte: in7Days },
        booking: {
          status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
          plot: { project: { organizationId: orgId } },
        },
      },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
            createdBy: true,
          },
        },
      },
    });

    const overdueInstallments = await prisma.installment.findMany({
      where: {
        status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
        dueDate: { lt: now },
        booking: {
          status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] },
          plot: { project: { organizationId: orgId } },
        },
      },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
        },
      },
    });

    const notifications = [];

    // Upcoming reminders
    for (const inst of upcomingInstallments) {
      const daysUntilDue = Math.ceil((new Date(inst.dueDate).getTime() - now.getTime()) / 86400000);
      let templateName = "";
      if (daysUntilDue <= 1) templateName = "payment_reminder_3days";
      else if (daysUntilDue <= 3) templateName = "payment_reminder_3days";
      else templateName = "payment_reminder_7days";

      const customer = inst.booking.customer;
      const plot = inst.booking.plot;
      const amount = Number(inst.balanceAmount) || Number(inst.amount);

      let message = templateMap.get(templateName)?.body || `Payment of PKR ${amount} for ${plot.plotNumber} is due on ${inst.dueDate.toISOString().split("T")[0]}`;
      message = message
        .replace("{{customerName}}", `${customer.firstName} ${customer.lastName}`)
        .replace("{{amount}}", amount.toLocaleString())
        .replace("{{plotNumber}}", plot.plotNumber)
        .replace("{{dueDate}}", inst.dueDate.toISOString().split("T")[0])
        .replace("{{orgName}}", session.user.organizationName);

      notifications.push({
        userId: inst.booking.createdBy?.id || session.user.id,
        title: `Payment Reminder: ${plot.plotNumber}`,
        message,
        type: "PAYMENT_DUE" as const,
        channel: "IN_APP" as const,
        link: `/bookings/${inst.booking.id}`,
      });
    }

    // Overdue reminders
    for (const inst of overdueInstallments) {
      const customer = inst.booking.customer;
      const plot = inst.booking.plot;
      const amount = Number(inst.balanceAmount) || Number(inst.amount);
      const penalty = Number(inst.latePenalty);

      let message = templateMap.get("payment_overdue")?.body || `OVERDUE: PKR ${amount} for ${plot.plotNumber} was due on ${inst.dueDate.toISOString().split("T")[0]}`;
      message = message
        .replace("{{customerName}}", `${customer.firstName} ${customer.lastName}`)
        .replace("{{amount}}", amount.toLocaleString())
        .replace("{{plotNumber}}", plot.plotNumber)
        .replace("{{dueDate}}", inst.dueDate.toISOString().split("T")[0])
        .replace("{{penaltyPercent}}", String(penalty))
        .replace("{{orgName}}", session.user.organizationName);

      notifications.push({
        userId: session.user.id,
        title: `OVERDUE: ${plot.plotNumber}`,
        message,
        type: "PAYMENT_OVERDUE" as const,
        channel: "IN_APP" as const,
        link: `/bookings/${inst.booking.id}`,
      });
    }

    // Bulk create notifications
    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }

    return NextResponse.json({
      message: `${notifications.length} reminders generated`,
      upcoming: upcomingInstallments.length,
      overdue: overdueInstallments.length,
      notificationsCreated: notifications.length,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/reminders
 * Preview what reminders would be sent (dry run)
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await authorize("installments:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const now = new Date();
    const in7Days = new Date(); in7Days.setDate(now.getDate() + 7);

    const [upcoming, overdue] = await Promise.all([
      prisma.installment.count({
        where: {
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { gte: now, lte: in7Days },
          booking: { status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] }, plot: { project: { organizationId: session.user.organizationId } } },
        },
      }),
      prisma.installment.count({
        where: {
          status: { in: ["OVERDUE", "PENDING", "PARTIAL"] },
          dueDate: { lt: now },
          booking: { status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] }, plot: { project: { organizationId: session.user.organizationId } } },
        },
      }),
    ]);

    return NextResponse.json({ upcomingReminders: upcoming, overdueReminders: overdue, total: upcoming + overdue });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
