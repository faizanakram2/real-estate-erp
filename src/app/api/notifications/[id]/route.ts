import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!notification) return notFoundResponse("Notification");

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });
    return NextResponse.json(updated);
  } catch (error) { return serverErrorResponse(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    await prisma.notification.deleteMany({ where: { id: params.id, userId: session.user.id } });
    return NextResponse.json({ message: "Notification deleted" });
  } catch (error) { return serverErrorResponse(error); }
}
