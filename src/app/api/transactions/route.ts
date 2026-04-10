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
