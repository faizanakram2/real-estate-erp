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
