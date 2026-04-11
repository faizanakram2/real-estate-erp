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
