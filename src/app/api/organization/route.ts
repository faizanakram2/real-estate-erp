import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  taxId: z.string().optional(),
  logo: z.string().optional(),
});

/**
 * GET /api/organization
 * Get current user's organization details
 */

/**
 * @swagger
 * /api/organization:
 *   get:
 *     summary: Get current organization
 *     description: |
 *       Returns the organization details of the currently authenticated user.
 *       Includes active bank accounts and counts of users, projects,
 *       customers, vendors, and employees.
 *     tags:
 *       - Organization
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Organization details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "org_123"
 *
 *                 name:
 *                   type: string
 *                   example: "ABC Real Estate Pvt Ltd"
 *
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                   example: "+923001234567"
 *
 *                 email:
 *                   type: string
 *                   nullable: true
 *                   example: "info@abcrealestate.com"
 *
 *                 website:
 *                   type: string
 *                   nullable: true
 *                   example: "https://abcrealestate.com"
 *
 *                 addressLine1:
 *                   type: string
 *                   nullable: true
 *                   example: "123 Main Boulevard"
 *
 *                 addressLine2:
 *                   type: string
 *                   nullable: true
 *                   example: "Office 4"
 *
 *                 city:
 *                   type: string
 *                   nullable: true
 *                   example: "Lahore"
 *
 *                 state:
 *                   type: string
 *                   nullable: true
 *                   example: "Punjab"
 *
 *                 country:
 *                   type: string
 *                   nullable: true
 *                   example: "Pakistan"
 *
 *                 postalCode:
 *                   type: string
 *                   nullable: true
 *                   example: "54000"
 *
 *                 taxId:
 *                   type: string
 *                   nullable: true
 *                   example: "NTN-1234567"
 *
 *                 logo:
 *                   type: string
 *                   nullable: true
 *                   example: "https://example.com/logo.png"
 *
 *                 bankAccounts:
 *                   type: array
 *                   description: Active bank accounts belonging to the organization.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "bank_123"
 *                       bankName:
 *                         type: string
 *                         example: "Meezan Bank"
 *                       accountNumber:
 *                         type: string
 *                         example: "PK00MEZN0000001234567890"
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *
 *                 _count:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: integer
 *                       example: 15
 *                     projects:
 *                       type: integer
 *                       example: 5
 *                     customers:
 *                       type: integer
 *                       example: 250
 *                     vendors:
 *                       type: integer
 *                       example: 20
 *                     employees:
 *                       type: integer
 *                       example: 35
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to read organization details.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(_request: NextRequest) {
  try {
    const auth = await authorize("organization:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        bankAccounts: { where: { isActive: true }, orderBy: { bankName: "asc" } },
        _count: {
          select: { users: true, projects: true, customers: true, vendors: true, employees: true },
        },
      },
    });

    return NextResponse.json(org);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * PATCH /api/organization
 * Update organization profile
 */

/**
 * @swagger
 * /api/organization:
 *   patch:
 *     summary: Update organization profile
 *     description: |
 *       Updates the profile information of the currently authenticated
 *       user's organization.
 *
 *       Only fields provided in the request body will be updated.
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: "ABC Real Estate Pvt Ltd"
 *
 *               phone:
 *                 type: string
 *                 example: "+923001234567"
 *
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "info@abcrealestate.com"
 *
 *               website:
 *                 type: string
 *                 example: "https://abcrealestate.com"
 *
 *               addressLine1:
 *                 type: string
 *                 example: "123 Main Boulevard"
 *
 *               addressLine2:
 *                 type: string
 *                 example: "Office 4"
 *
 *               city:
 *                 type: string
 *                 example: "Lahore"
 *
 *               state:
 *                 type: string
 *                 example: "Punjab"
 *
 *               country:
 *                 type: string
 *                 example: "Pakistan"
 *
 *               postalCode:
 *                 type: string
 *                 example: "54000"
 *
 *               taxId:
 *                 type: string
 *                 example: "NTN-1234567"
 *
 *               logo:
 *                 type: string
 *                 example: "https://example.com/logo.png"
 *
 *     responses:
 *       200:
 *         description: Organization profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "org_123"
 *                 name:
 *                   type: string
 *                   example: "ABC Real Estate Pvt Ltd"
 *                 phone:
 *                   type: string
 *                   example: "+923001234567"
 *                 email:
 *                   type: string
 *                   example: "info@abcrealestate.com"
 *                 website:
 *                   type: string
 *                   example: "https://abcrealestate.com"
 *                 city:
 *                   type: string
 *                   example: "Lahore"
 *                 country:
 *                   type: string
 *                   example: "Pakistan"
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T12:30:00.000Z"
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized or authentication required.
 *
 *       403:
 *         description: Forbidden. User does not have permission to update organization details.
 *
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize("organization:write");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const body = await request.json();
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const org = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: parsed.data,
    });

    await logAudit({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Organization",
      entityId: session.user.organizationId,
      changes: parsed.data,
    });

    return NextResponse.json(org);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
