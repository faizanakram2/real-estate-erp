import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, validationErrorResponse, serverErrorResponse } from "@/lib/api-utils";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["IN_APP", "SMS", "WHATSAPP", "EMAIL"]),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const templates = await prisma.notificationTemplate.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const template = await prisma.notificationTemplate.create({
      data: { organizationId: session.user.organizationId, ...parsed.data },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
