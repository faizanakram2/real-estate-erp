import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { z } from "zod";

const createBankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountTitle: z.string().min(1),
  accountNumber: z.string().min(1),
  iban: z.string().optional(),
  branchCode: z.string().optional(),
  swiftCode: z.string().optional(),
  accountType: z.enum(["current", "savings", "jazzcash", "easypaisa"]).default("current"),
});

/**
 * @swagger
 * /api/organization/bank-accounts:
 *   get:
 *     summary: Get organization bank accounts
 *     description: |
 *       Returns all active bank accounts belonging to the authenticated
 *       user's organization.
 *     tags:
 *       - Organization
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Organization bank accounts retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "clxbank123456"
 *
 *                   organizationId:
 *                     type: string
 *                     example: "org_123"
 *
 *                   bankName:
 *                     type: string
 *                     example: "Meezan Bank"
 *
 *                   accountTitle:
 *                     type: string
 *                     example: "ABC Real Estate Pvt Ltd"
 *
 *                   accountNumber:
 *                     type: string
 *                     example: "0123456789"
 *
 *                   iban:
 *                     type: string
 *                     nullable: true
 *                     example: "PK36MEZN0000001234567890"
 *
 *                   branchCode:
 *                     type: string
 *                     nullable: true
 *                     example: "0123"
 *
 *                   swiftCode:
 *                     type: string
 *                     nullable: true
 *                     example: "MEZNPKKA"
 *
 *                   accountType:
 *                     type: string
 *                     enum:
 *                       - current
 *                       - savings
 *                       - jazzcash
 *                       - easypaisa
 *                     example: current
 *
 *                   isActive:
 *                     type: boolean
 *                     example: true
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
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to read organization bank accounts.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(_request: NextRequest) {
  try {
    const auth = await authorize("organization:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const accounts = await prisma.organizationBankAccount.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      orderBy: { bankName: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    return serverErrorResponse(error);
  }
}


/**
 * @swagger
 * /api/organization/bank-accounts:
 *   post:
 *     summary: Create organization bank account
 *     description: |
 *       Creates a new bank account for the authenticated user's organization.
 *     tags:
 *       - Organization
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
 *               - bankName
 *               - accountTitle
 *               - accountNumber
 *             properties:
 *               bankName:
 *                 type: string
 *                 minLength: 1
 *                 example: "Meezan Bank"
 *                 description: Name of the bank.
 *
 *               accountTitle:
 *                 type: string
 *                 minLength: 1
 *                 example: "ABC Real Estate Pvt Ltd"
 *                 description: Account holder/title.
 *
 *               accountNumber:
 *                 type: string
 *                 minLength: 1
 *                 example: "0123456789"
 *                 description: Bank account number.
 *
 *               iban:
 *                 type: string
 *                 example: "PK36MEZN0000001234567890"
 *                 description: International Bank Account Number.
 *
 *               branchCode:
 *                 type: string
 *                 example: "0123"
 *                 description: Bank branch code.
 *
 *               swiftCode:
 *                 type: string
 *                 example: "MEZNPKKA"
 *                 description: SWIFT/BIC code.
 *
 *               accountType:
 *                 type: string
 *                 enum:
 *                   - current
 *                   - savings
 *                   - jazzcash
 *                   - easypaisa
 *                 default: current
 *                 example: current
 *                 description: Type of bank account.
 *
 *     responses:
 *       201:
 *         description: Bank account created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clxbank123456"
 *
 *                 organizationId:
 *                   type: string
 *                   example: "org_123"
 *
 *                 bankName:
 *                   type: string
 *                   example: "Meezan Bank"
 *
 *                 accountTitle:
 *                   type: string
 *                   example: "ABC Real Estate Pvt Ltd"
 *
 *                 accountNumber:
 *                   type: string
 *                   example: "0123456789"
 *
 *                 iban:
 *                   type: string
 *                   nullable: true
 *                   example: "PK36MEZN0000001234567890"
 *
 *                 branchCode:
 *                   type: string
 *                   nullable: true
 *                   example: "0123"
 *
 *                 swiftCode:
 *                   type: string
 *                   nullable: true
 *                   example: "MEZNPKKA"
 *
 *                 accountType:
 *                   type: string
 *                   enum:
 *                     - current
 *                     - savings
 *                     - jazzcash
 *                     - easypaisa
 *                   example: current
 *
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to create organization bank accounts.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("organization:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = createBankAccountSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const account = await prisma.organizationBankAccount.create({
      data: { organizationId: session.user.organizationId, ...parsed.data },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
