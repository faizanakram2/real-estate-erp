import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse, notFoundResponse } from "@/lib/api-utils";

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
