import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return notFoundResponse("Document");
    return NextResponse.json(doc);
  } catch (error) { return serverErrorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return notFoundResponse("Document");

    await prisma.document.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Document deleted" });
  } catch (error) { return serverErrorResponse(error); }
}
