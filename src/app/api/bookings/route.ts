import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
  getPaginationParams,
  paginatedResponse,
} from "@/lib/api-utils";
import { createBookingSchema } from "@/lib/validators/booking";

// Generate booking number: BK-2026-0001
async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BK-${year}-`;
  const lastBooking = await prisma.booking.findFirst({
    where: { bookingNumber: { startsWith: prefix } },
    orderBy: { bookingNumber: "desc" },
  });

  let nextNum = 1;
  if (lastBooking) {
    const lastNum = parseInt(lastBooking.bookingNumber.split("-").pop() || "0");
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } =
      getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const customerId = request.nextUrl.searchParams.get("customerId");

    const where: any = {
      plot: { project: { organizationId: session.user.organizationId } },
    };
    if (status) where.status = status;
    if (projectId) where.plot = { ...where.plot, projectId };
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { bookingNumber: { contains: search, mode: "insensitive" } },
        {
          customer: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              cnic: true,
            },
          },
          plot: {
            select: {
              id: true,
              plotNumber: true,
              type: true,
              size: true,
              sizeUnit: true,
              project: { select: { id: true, name: true } },
              block: { select: { id: true, name: true } },
            },
          },
          _count: { select: { installments: true, paymentRecords: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.booking.count({ where }),
    ]);

    return paginatedResponse(bookings, total, page, limit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;

    // Verify plot is available
    const plot = await prisma.plot.findFirst({
      where: {
        id: data.plotId,
        status: "AVAILABLE",
        project: { organizationId: session.user.organizationId },
      },
    });
    if (!plot) {
      return NextResponse.json(
        { error: "Plot not found or not available" },
        { status: 400 }
      );
    }

    // Verify customer
    const customer = await prisma.customer.findFirst({
      where: {
        id: data.customerId,
        organizationId: session.user.organizationId,
      },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const bookingNumber = await generateBookingNumber();
    const netAmount =
      data.totalPrice +
      data.developmentCharges +
      data.possessionCharges +
      data.otherCharges -
      data.discount;

    // Create booking + update plot status in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          customerId: data.customerId,
          plotId: data.plotId,
          createdById: session.user.id,
          totalPrice: data.totalPrice,
          bookingAmount: data.bookingAmount,
          downPayment: data.downPayment,
          developmentCharges: data.developmentCharges,
          possessionCharges: data.possessionCharges,
          otherCharges: data.otherCharges,
          discount: data.discount,
          netAmount,
          installmentPlanId: data.installmentPlanId,
          installmentMonths: data.installmentMonths,
          monthlyInstallment: data.installmentMonths
            ? (netAmount - data.bookingAmount - data.downPayment) /
              data.installmentMonths
            : undefined,
          notes: data.notes,
        },
      });

      // Update plot status
      await tx.plot.update({
        where: { id: data.plotId },
        data: { status: "BOOKED" },
      });

      // Auto-generate installment schedule if plan provided
      if (data.installmentMonths && data.installmentMonths > 0) {
        const installableAmount =
          netAmount - data.bookingAmount - data.downPayment;
        const monthlyAmount = installableAmount / data.installmentMonths;
        const installments = [];

        // Booking amount installment
        if (data.bookingAmount > 0) {
          installments.push({
            bookingId: newBooking.id,
            installmentNo: 0,
            type: "BOOKING" as const,
            amount: data.bookingAmount,
            dueDate: new Date(),
            status: "PENDING" as const,
            balanceAmount: data.bookingAmount,
          });
        }

        // Down payment
        if (data.downPayment > 0) {
          const dpDate = new Date();
          dpDate.setDate(dpDate.getDate() + 30);
          installments.push({
            bookingId: newBooking.id,
            installmentNo: 1,
            type: "DOWN_PAYMENT" as const,
            amount: data.downPayment,
            dueDate: dpDate,
            status: "PENDING" as const,
            balanceAmount: data.downPayment,
          });
        }

        // Monthly installments
        for (let i = 0; i < data.installmentMonths; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i + 2); // start 2 months from now
          dueDate.setDate(1); // 1st of each month

          installments.push({
            bookingId: newBooking.id,
            installmentNo: i + 2,
            type: "MONTHLY" as const,
            amount: monthlyAmount,
            dueDate,
            status: "PENDING" as const,
            balanceAmount: monthlyAmount,
          });
        }

        await tx.installment.createMany({ data: installments });
      }

      return newBooking;
    });

    const fullBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        customer: true,
        plot: { include: { project: true, block: true } },
        installments: { orderBy: { dueDate: "asc" } },
      },
    });

    return NextResponse.json(fullBooking, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
