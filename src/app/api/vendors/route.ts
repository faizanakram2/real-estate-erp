import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createVendorSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: Get vendors
 *     description: Retrieve a paginated list of vendors belonging to the authenticated user's organization.
 *     tags:
 *       - Vendors
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of vendors per page.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by company name, contact name, or phone number.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter vendors by category.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field used for sorting.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *         description: Sort direction.
 *     responses:
 *       200:
 *         description: Vendors retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vendor'
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
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } = getPaginationParams(request);
    const category = request.nextUrl.searchParams.get("category");

    const where: any = { organizationId: session.user.organizationId };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where, skip, take: limit,
        include: { _count: { select: { maintenanceRequests: true, transactions: true, materialRequisitions: true } } },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.vendor.count({ where }),
    ]);

    return paginatedResponse(vendors, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/vendors:
 *   post:
 *     summary: Create a vendor
 *     description: Create a new vendor within the authenticated user's organization.
 *     tags:
 *       - Vendors
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateVendorRequest'
 *           example:
 *             companyName: "ABC Construction Supplies"
 *             contactName: "Ahmed Raza"
 *             email: "ahmed@abc-supplies.com"
 *             phone: "+923001234567"
 *             cnic: "35202-1234567-1"
 *             address: "Main Boulevard"
 *             city: "Lahore"
 *             state: "Punjab"
 *             category: "CONSTRUCTION"
 *             taxId: "GST-123456"
 *             notes: "Primary construction material supplier"
 *     responses:
 *       201:
 *         description: Vendor created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createVendorSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const vendor = await prisma.vendor.create({
      data: { organizationId: session.user.organizationId, ...parsed.data, email: parsed.data.email || null },
    });
    return NextResponse.json(vendor, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateVendorRequest:
 *       type: object
 *       required:
 *         - companyName
 *       properties:
 *         companyName:
 *           type: string
 *           description: Vendor company name.
 *           example: "ABC Construction Supplies"
 *         contactName:
 *           type: string
 *           description: Primary contact person.
 *           example: "Ahmed Raza"
 *         email:
 *           type: string
 *           format: email
 *           description: Vendor email address.
 *           example: "ahmed@abc-supplies.com"
 *         phone:
 *           type: string
 *           description: Vendor phone number.
 *           example: "+923001234567"
 *         cnic:
 *           type: string
 *           description: Vendor contact CNIC.
 *           example: "35202-1234567-1"
 *         address:
 *           type: string
 *           description: Vendor address.
 *           example: "Main Boulevard"
 *         city:
 *           type: string
 *           description: Vendor city.
 *           example: "Lahore"
 *         state:
 *           type: string
 *           description: Vendor state or province.
 *           example: "Punjab"
 *         category:
 *           type: string
 *           description: Vendor category.
 *           example: "CONSTRUCTION"
 *         taxId:
 *           type: string
 *           description: Vendor tax identification number.
 *           example: "GST-123456"
 *         notes:
 *           type: string
 *           description: Additional notes about the vendor.
 *           example: "Primary construction material supplier"
 *
 *     Vendor:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         organizationId:
 *           type: string
 *           format: uuid
 *           example: "660e8400-e29b-41d4-a716-446655440000"
 *         companyName:
 *           type: string
 *           example: "ABC Construction Supplies"
 *         contactName:
 *           type: string
 *           nullable: true
 *           example: "Ahmed Raza"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "ahmed@abc-supplies.com"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+923001234567"
 *         cnic:
 *           type: string
 *           nullable: true
 *           example: "35202-1234567-1"
 *         address:
 *           type: string
 *           nullable: true
 *           example: "Main Boulevard"
 *         city:
 *           type: string
 *           nullable: true
 *           example: "Lahore"
 *         state:
 *           type: string
 *           nullable: true
 *           example: "Punjab"
 *         category:
 *           type: string
 *           nullable: true
 *           example: "CONSTRUCTION"
 *         taxId:
 *           type: string
 *           nullable: true
 *           example: "GST-123456"
 *         notes:
 *           type: string
 *           nullable: true
 *           example: "Primary construction material supplier"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         _count:
 *           type: object
 *           properties:
 *             maintenanceRequests:
 *               type: integer
 *               example: 4
 *             transactions:
 *               type: integer
 *               example: 12
 *             materialRequisitions:
 *               type: integer
 *               example: 6
 */