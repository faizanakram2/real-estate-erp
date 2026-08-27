import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/organization/bank-accounts/{id}:
 *   patch:
 *     summary: Update organization bank account
 *     description: |
 *       Updates an existing bank account belonging to the authenticated
 *       user's organization.
 *
 *       Only fields provided in the request body will be updated.
 *     tags:
 *       - Organization
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank account ID.
 *         example: "clxbank123456"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankName:
 *                 type: string
 *                 example: "Meezan Bank"
 *
 *               accountTitle:
 *                 type: string
 *                 example: "ABC Real Estate Pvt Ltd"
 *
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *
 *               iban:
 *                 type: string
 *                 example: "PK36MEZN0000001234567890"
 *
 *               branchCode:
 *                 type: string
 *                 example: "0123"
 *
 *               swiftCode:
 *                 type: string
 *                 example: "MEZNPKKA"
 *
 *               accountType:
 *                 type: string
 *                 enum:
 *                   - current
 *                   - savings
 *                   - jazzcash
 *                   - easypaisa
 *                 example: current
 *
 *               isActive:
 *                 type: boolean
 *                 example: true
 *
 *     responses:
 *       200:
 *         description: Bank account updated successfully.
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
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to update organization bank accounts.
 *
 *       404:
 *         description: Bank account not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("organization:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const existing = await prisma.organizationBankAccount.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Bank Account");

    const body = await request.json();
    const account = await prisma.organizationBankAccount.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(account);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/organization/bank-accounts/{id}:
 *   delete:
 *     summary: Deactivate organization bank account
 *     description: |
 *       Deactivates an organization bank account by setting its isActive
 *       field to false. The bank account is not permanently deleted.
 *     tags:
 *       - Organization
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank account ID.
 *         example: "clxbank123456"
 *
 *     responses:
 *       200:
 *         description: Bank account deactivated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bank account deactivated"
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to deactivate organization bank accounts.
 *
 *       404:
 *         description: Bank account not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorize("organization:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const existing = await prisma.organizationBankAccount.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Bank Account");

    await prisma.organizationBankAccount.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ message: "Bank account deactivated" });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
