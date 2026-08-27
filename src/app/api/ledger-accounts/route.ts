import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
  parentId: z.string().optional(),
});

/**
 * @swagger
 * /api/ledger-accounts:
 *   get:
 *     summary: Get ledger accounts
 *     description: |
 *       Returns all active ledger accounts belonging to the authenticated
 *       user's organization.
 *
 *       Accounts can optionally be filtered by account type.
 *       Each account includes its parent account, child accounts, and
 *       transaction count.
 *     tags:
 *       - Ledger Accounts
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - ASSET
 *             - LIABILITY
 *             - EQUITY
 *             - INCOME
 *             - EXPENSE
 *         description: Filter accounts by account type.
 *         example: ASSET
 *
 *     responses:
 *       200:
 *         description: Ledger accounts retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "clx123abc456"
 *
 *                   organizationId:
 *                     type: string
 *                     example: "org_123"
 *
 *                   code:
 *                     type: string
 *                     example: "1000"
 *
 *                   name:
 *                     type: string
 *                     example: "Cash"
 *
 *                   type:
 *                     type: string
 *                     enum:
 *                       - ASSET
 *                       - LIABILITY
 *                       - EQUITY
 *                       - INCOME
 *                       - EXPENSE
 *                     example: "ASSET"
 *
 *                   parentId:
 *                     type: string
 *                     nullable: true
 *                     example: null
 *
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *
 *                   parent:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "clxparent123"
 *                       code:
 *                         type: string
 *                         example: "1000"
 *                       name:
 *                         type: string
 *                         example: "Current Assets"
 *
 *                   children:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "clxchild123"
 *                         code:
 *                           type: string
 *                           example: "1010"
 *                         name:
 *                           type: string
 *                           example: "Petty Cash"
 *
 *                   _count:
 *                     type: object
 *                     properties:
 *                       transactions:
 *                         type: integer
 *                         example: 25
 *
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const type = request.nextUrl.searchParams.get("type");
    const where: any = { organizationId: session.user.organizationId, isActive: true };
    if (type) where.type = type;

    const accounts = await prisma.ledgerAccount.findMany({
      where,
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/ledger-accounts:
 *   post:
 *     summary: Create ledger account
 *     description: Creates a new ledger account for the authenticated user's organization.
 *     tags:
 *       - Ledger Accounts
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - type
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 1
 *                 example: "1010"
 *                 description: Unique account code.
 *
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: "Petty Cash"
 *                 description: Name of the ledger account.
 *
 *               type:
 *                 type: string
 *                 enum:
 *                   - ASSET
 *                   - LIABILITY
 *                   - EQUITY
 *                   - INCOME
 *                   - EXPENSE
 *                 example: "ASSET"
 *                 description: Type/category of the ledger account.
 *
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 example: "clxparent123"
 *                 description: Optional ID of the parent ledger account.
 *
 *     responses:
 *       201:
 *         description: Ledger account created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 organizationId:
 *                   type: string
 *                   example: "org_123"
 *
 *                 code:
 *                   type: string
 *                   example: "1010"
 *
 *                 name:
 *                   type: string
 *                   example: "Petty Cash"
 *
 *                 type:
 *                   type: string
 *                   enum:
 *                     - ASSET
 *                     - LIABILITY
 *                     - EQUITY
 *                     - INCOME
 *                     - EXPENSE
 *                   example: "ASSET"
 *
 *                 parentId:
 *                   type: string
 *                   nullable: true
 *                   example: "clxparent123"
 *
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const account = await prisma.ledgerAccount.create({
      data: { organizationId: session.user.organizationId, ...parsed.data },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
