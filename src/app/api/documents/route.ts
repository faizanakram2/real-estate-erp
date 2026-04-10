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
