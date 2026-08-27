import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createTransactionSchema = z.object({
  projectId: z.string().optional(),
  vendorId: z.string().optional(),
  ledgerAccountId: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transactions
 *     description: Returns a paginated list of income, expense, and transfer transactions for the authenticated organization.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of transactions per page
 *
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order by transaction date
 *
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE, TRANSFER]
 *         description: Filter transactions by type
 *
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter transactions by category
 *
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions from this date
 *
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter transactions up to this date
 *
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
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
 *       401:
 *         description: Unauthorized
 *
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create transaction
 *     description: Creates a new income, expense, or transfer transaction for the organization.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTransactionRequest'
 *           example:
 *             projectId: "project_123"
 *             vendorId: "vendor_123"
 *             ledgerAccountId: "ledger_123"
 *             type: "EXPENSE"
 *             category: "CONSTRUCTION"
 *             description: "Construction material purchase"
 *             amount: 250000
 *             date: "2026-08-27T10:00:00.000Z"
 *             referenceNumber: "INV-2026-001"
 *             notes: "Cement and steel purchase"
 *
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *
 *       400:
 *         description: Validation error
 *
 *       401:
 *         description: Unauthorized
 *
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     CreateTransactionRequest:
 *       type: object
 *       required:
 *         - type
 *         - category
 *         - description
 *         - amount
 *         - date
 *       properties:
 *         projectId:
 *           type: string
 *           nullable: true
 *           description: ID of the related project
 *         vendorId:
 *           type: string
 *           nullable: true
 *           description: ID of the related vendor
 *         ledgerAccountId:
 *           type: string
 *           nullable: true
 *           description: ID of the related ledger account
 *         type:
 *           type: string
 *           enum:
 *             - INCOME
 *             - EXPENSE
 *             - TRANSFER
 *           description: Transaction type
 *         category:
 *           type: string
 *           description: Transaction category
 *           example: CONSTRUCTION
 *         description:
 *           type: string
 *           description: Description of the transaction
 *           example: Construction material purchase
 *         amount:
 *           type: number
 *           format: double
 *           minimum: 0
 *           exclusiveMinimum: true
 *           description: Transaction amount
 *           example: 250000
 *         date:
 *           type: string
 *           format: date-time
 *           description: Transaction date
 *           example: "2026-08-27T10:00:00.000Z"
 *         referenceNumber:
 *           type: string
 *           nullable: true
 *           description: Optional transaction reference number
 *           example: INV-2026-001
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Additional notes
 *           example: Cement and steel purchase
 *
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "transaction_123"
 *         projectId:
 *           type: string
 *           nullable: true
 *         vendorId:
 *           type: string
 *           nullable: true
 *         ledgerAccountId:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum:
 *             - INCOME
 *             - EXPENSE
 *             - TRANSFER
 *         category:
 *           type: string
 *         description:
 *           type: string
 *         amount:
 *           type: number
 *           format: double
 *         date:
 *           type: string
 *           format: date-time
 *         referenceNumber:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, sortOrder } = getPaginationParams(request);
    const type = request.nextUrl.searchParams.get("type");
    const category = request.nextUrl.searchParams.get("category");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    const where: any = {
      OR: [
        { project: { organizationId: session.user.organizationId } },
        { vendor: { organizationId: session.user.organizationId } },
      ],
    };
    if (type) where.type = type;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip, take: limit,
        include: {
          project: { select: { name: true } },
          vendor: { select: { companyName: true } },
          ledgerAccount: { select: { code: true, name: true } },
        },
        orderBy: { date: sortOrder },
      }),
      prisma.transaction.count({ where }),
    ]);

    return paginatedResponse(transactions, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const transaction = await prisma.transaction.create({
      data: { ...d, date: new Date(d.date) },
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
