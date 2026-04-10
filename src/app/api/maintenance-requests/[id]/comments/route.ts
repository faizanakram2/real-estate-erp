import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { comment, isInternal } = await request.json();
    if (!comment) return NextResponse.json({ error: "Comment is required" }, { status: 400 });

    const mc = await prisma.maintenanceComment.create({
      data: { maintenanceRequestId: params.id, userId: session.user.id, comment, isInternal: isInternal || false },
    });
    return NextResponse.json(mc, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
