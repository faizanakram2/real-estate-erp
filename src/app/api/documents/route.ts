import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createDocumentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["BOOKING_FORM","ALLOTMENT_LETTER","TRANSFER_DEED","PAYMENT_RECEIPT","CNIC_COPY","MAP","AGREEMENT","NOC","POSSESSION_LETTER","INSPECTION_REPORT","INSURANCE","TAX_DOCUMENT","OTHER"]),
  category: z.string().optional(),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  projectId: z.string().optional(),
  customerId: z.string().optional(),
  bookingId: z.string().optional(),
  vendorId: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});


/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get documents
 *     description: |
 *       Returns a paginated list of documents belonging to the authenticated
 *       user's organization. Documents can be filtered by type, project,
 *       customer, booking, or name search.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *         example: 1
 *
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of documents per page.
 *         example: 10
 *
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search documents by name.
 *         example: "booking agreement"
 *
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - BOOKING_FORM
 *             - ALLOTMENT_LETTER
 *             - TRANSFER_DEED
 *             - PAYMENT_RECEIPT
 *             - CNIC_COPY
 *             - MAP
 *             - AGREEMENT
 *             - NOC
 *             - POSSESSION_LETTER
 *             - INSPECTION_REPORT
 *             - INSURANCE
 *             - TAX_DOCUMENT
 *             - OTHER
 *         description: Filter documents by document type.
 *         example: AGREEMENT
 *
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter documents by project ID.
 *         example: "project_123"
 *
 *       - in: query
 *         name: customerId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter documents by customer ID.
 *         example: "customer_123"
 *
 *       - in: query
 *         name: bookingId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter documents by booking ID.
 *         example: "booking_123"
 *
 *     responses:
 *       200:
 *         description: Documents retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
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

    const { page, limit, skip, search } = getPaginationParams(request);
    const type = request.nextUrl.searchParams.get("type");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const customerId = request.nextUrl.searchParams.get("customerId");
    const bookingId = request.nextUrl.searchParams.get("bookingId");

    const where: any = {};
    if (type) where.type = type;
    if (projectId) where.projectId = projectId;
    if (customerId) where.customerId = customerId;
    if (bookingId) where.bookingId = bookingId;
    if (search) where.name = { contains: search, mode: "insensitive" };

    // Scope to org via relations
    where.OR = [
      { project: { organizationId: session.user.organizationId } },
      { customer: { organizationId: session.user.organizationId } },
      { vendor: { organizationId: session.user.organizationId } },
      { booking: { plot: { project: { organizationId: session.user.organizationId } } } },
    ];

    const [documents, total] = await Promise.all([
      prisma.document.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.document.count({ where }),
    ]);

    return paginatedResponse(documents, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a document
 *     description: |
 *       Creates a new document and associates it with a project, customer,
 *       booking, or vendor. The authenticated user is automatically recorded
 *       as the uploader.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDocumentRequest'
 *
 *     responses:
 *       201:
 *         description: Document created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
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
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const doc = await prisma.document.create({
      data: {
        ...d,
        uploadedById: session.user.id,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
