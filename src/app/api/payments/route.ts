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

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     description: Returns a paginated list of payment records.
 *     tags:
 *       - Payments
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         description: Number of records per page
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *
 *       - in: query
 *         name: search
 *         required: false
 *         description: Search by receipt number, reference number, or customer name
 *         schema:
 *           type: string
 *         example: REC-2026-00001
 *
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter payments by payment status
 *         schema:
 *           type: string
 *         example: PENDING
 *
 *       - in: query
 *         name: bookingId
 *         required: false
 *         description: Filter payments by booking ID
 *         schema:
 *           type: string
 *         example: clxbooking123
 *
 *       - in: query
 *         name: customerId
 *         required: false
 *         description: Filter payments by customer ID
 *         schema:
 *           type: string
 *         example: clxcustomer123
 *
 *       - in: query
 *         name: sortOrder
 *         required: false
 *         description: Sort payments by payment date
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *
 *     responses:
 *       "200":
 *         description: Paginated list of payments returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *
 *       "401":
 *         description: Unauthorized
 *
 *       "500":
 *         description: Internal server error
 *
 *   post:
 *     summary: Create a payment record
 *     description: Creates a new payment record. The receipt number is generated automatically.
 *     tags:
 *       - Payments
 *     security:
 *       - cookieAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - bookingId
 *               - amount
 *               - paymentMethod
 *               - paymentDate
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: clxcustomer123
 *
 *               bookingId:
 *                 type: string
 *                 example: clxbooking123
 *
 *               installmentId:
 *                 type: string
 *                 example: clxinstallment123
 *
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 500000
 *
 *               paymentMethod:
 *                 type: string
 *                 example: BANK_TRANSFER
 *
 *               paymentDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-27T10:30:00.000Z"
 *
 *               referenceNumber:
 *                 type: string
 *                 example: TXN-123456789
 *
 *               bankName:
 *                 type: string
 *                 example: Meezan Bank
 *
 *               chequeNumber:
 *                 type: string
 *                 example: CHQ-123456
 *
 *               chequeDate:
 *                 type: string
 *                 format: date-time
 *
 *               notes:
 *                 type: string
 *
 *           example:
 *             customerId: clxcustomer123
 *             bookingId: clxbooking123
 *             installmentId: clxinstallment123
 *             amount: 500000
 *             paymentMethod: BANK_TRANSFER
 *             paymentDate: "2026-08-27T10:30:00.000Z"
 *             referenceNumber: TXN-123456789
 *             bankName: Meezan Bank
 *             notes: Payment received successfully
 *
 *     responses:
 *       "201":
 *         description: Payment record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 *       "400":
 *         description: Validation error
 *
 *       "401":
 *         description: Unauthorized
 *
 *       "500":
 *         description: Internal server error
 */

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
