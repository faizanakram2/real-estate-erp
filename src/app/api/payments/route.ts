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
import { createPaymentSchema } from "@/lib/validators/payment";

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const last = await prisma.paymentRecord.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const lastNum = parseInt(last.receiptNumber.split("-").pop() || "0");
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortOrder } =
      getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");
    const bookingId = request.nextUrl.searchParams.get("bookingId");
    const customerId = request.nextUrl.searchParams.get("customerId");

    const where: any = {
      booking: {
        plot: { project: { organizationId: session.user.organizationId } },
      },
    };
    if (status) where.status = status;
    if (bookingId) where.bookingId = bookingId;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { referenceNumber: { contains: search, mode: "insensitive" } },
        {
          customer: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.paymentRecord.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              plot: {
                select: {
                  plotNumber: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
          installment: {
            select: { id: true, installmentNo: true, type: true },
          },
          verifiedBy: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { paymentDate: sortOrder },
      }),
      prisma.paymentRecord.count({ where }),
    ]);

    return paginatedResponse(payments, total, page, limit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;
    const receiptNumber = await generateReceiptNumber();

    const payment = await prisma.paymentRecord.create({
      data: {
        receiptNumber,
        customerId: data.customerId,
        bookingId: data.bookingId,
        installmentId: data.installmentId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        status: "PENDING",
        paymentDate: new Date(data.paymentDate),
        referenceNumber: data.referenceNumber,
        bankName: data.bankName,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined,
        chequeStatus: data.chequeNumber ? "PENDING" : undefined,
        notes: data.notes,
      },
      include: {
        customer: true,
        booking: true,
        installment: true,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
