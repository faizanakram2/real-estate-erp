import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/vendors/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     description: Retrieve detailed information about a vendor, including recent maintenance requests, transactions, material requisitions, and documents.
 *     tags:
 *       - Vendors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor ID.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vendor retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorDetails'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Vendor not found.
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const vendor = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
      include: {
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        transactions: { orderBy: { date: "desc" }, take: 10 },
        materialRequisitions: { orderBy: { requestDate: "desc" }, take: 10 },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!vendor) return notFoundResponse("Vendor");
    return NextResponse.json(vendor);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/vendors/{id}:
 *   patch:
 *     summary: Update vendor
 *     description: Update an existing vendor belonging to the authenticated user's organization.
 *     tags:
 *       - Vendors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor ID.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateVendorRequest'
 *           example:
 *             companyName: "ABC Construction Supplies Updated"
 *             contactName: "Ahmed Raza"
 *             email: "ahmed@abc-supplies.com"
 *             phone: "+923001234567"
 *             address: "DHA Phase 5"
 *             city: "Lahore"
 *             state: "Punjab"
 *             category: "CONSTRUCTION"
 *             taxId: "GST-987654"
 *             notes: "Updated vendor information"
 *     responses:
 *       200:
 *         description: Vendor updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Vendor not found.
 *       500:
 *         description: Internal server error.
 */

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Vendor");

    const body = await request.json();
    const vendor = await prisma.vendor.update({ where: { id: params.id }, data: body });
    return NextResponse.json(vendor);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/vendors/{id}:
 *   delete:
 *     summary: Deactivate vendor
 *     description: Deactivate a vendor by setting its active status to false. The vendor is not permanently deleted.
 *     tags:
 *       - Vendors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Vendor ID.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vendor deactivated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Vendor deactivated"
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Vendor not found.
 *       500:
 *         description: Internal server error.
 */

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const existing = await prisma.vendor.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    });
    if (!existing) return notFoundResponse("Vendor");

    await prisma.vendor.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ message: "Vendor deactivated" });
  } catch (error) { return serverErrorResponse(error); }
}


/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateVendorRequest:
 *       type: object
 *       properties:
 *         companyName:
 *           type: string
 *           description: Vendor company name.
 *           example: "ABC Construction Supplies Updated"
 *         contactName:
 *           type: string
 *           nullable: true
 *           description: Primary contact person.
 *           example: "Ahmed Raza"
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: Vendor email address.
 *           example: "ahmed@abc-supplies.com"
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Vendor phone number.
 *           example: "+923001234567"
 *         cnic:
 *           type: string
 *           nullable: true
 *           description: Vendor contact CNIC.
 *           example: "35202-1234567-1"
 *         address:
 *           type: string
 *           nullable: true
 *           description: Vendor address.
 *           example: "DHA Phase 5"
 *         city:
 *           type: string
 *           nullable: true
 *           description: Vendor city.
 *           example: "Lahore"
 *         state:
 *           type: string
 *           nullable: true
 *           description: Vendor state or province.
 *           example: "Punjab"
 *         category:
 *           type: string
 *           nullable: true
 *           description: Vendor category.
 *           example: "CONSTRUCTION"
 *         taxId:
 *           type: string
 *           nullable: true
 *           description: Vendor tax identification number.
 *           example: "GST-987654"
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Additional vendor notes.
 *           example: "Updated vendor information"
 *         isActive:
 *           type: boolean
 *           description: Whether the vendor is active.
 *           example: true
 *
 *     Vendor:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         organizationId:
 *           type: string
 *           format: uuid
 *         companyName:
 *           type: string
 *           example: "ABC Construction Supplies"
 *         contactName:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         phone:
 *           type: string
 *           nullable: true
 *         cnic:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         state:
 *           type: string
 *           nullable: true
 *         category:
 *           type: string
 *           nullable: true
 *         taxId:
 *           type: string
 *           nullable: true
 *         notes:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     VendorDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/Vendor'
 *         - type: object
 *           properties:
 *             maintenanceRequests:
 *               type: array
 *               description: Latest maintenance requests associated with the vendor.
 *               items:
 *                 type: object
 *                 additionalProperties: true
 *             transactions:
 *               type: array
 *               description: Latest financial transactions associated with the vendor.
 *               items:
 *                 type: object
 *                 additionalProperties: true
 *             materialRequisitions:
 *               type: array
 *               description: Latest material requisitions associated with the vendor.
 *               items:
 *                 type: object
 *                 additionalProperties: true
 *             documents:
 *               type: array
 *               description: Documents associated with the vendor.
 *               items:
 *                 type: object
 *                 additionalProperties: true
 */