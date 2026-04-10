import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createUpdateSchema = z.object({
  description: z.string().min(1),
  progress: z.number().min(0).max(100),
  weather: z.string().optional(),
  laborCount: z.number().int().min(0).optional(),
  issues: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const phase = await prisma.constructionPhase.findFirst({
      where: { id: params.id, project: { organizationId: session.user.organizationId } },
    });
    if (!phase) return notFoundResponse("Construction Phase");

    const body = await request.json();
    const parsed = createUpdateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;

    const update = await prisma.$transaction(async (tx) => {
      const newUpdate = await tx.constructionUpdate.create({
        data: {
          phaseId: params.id,
          updatedById: session.user.id,
          description: d.description,
          progress: d.progress,
          weather: d.weather,
          laborCount: d.laborCount,
          issues: d.issues,
        },
      });

      if (d.imageUrls && d.imageUrls.length > 0) {
        await tx.constructionImage.createMany({
          data: d.imageUrls.map((url) => ({ updateId: newUpdate.id, url })),
        });
      }

      // Update phase progress
      await tx.constructionPhase.update({
        where: { id: params.id },
        data: {
          progress: d.progress,
          status: d.progress >= 100 ? "COMPLETED" : d.progress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
        },
      });

      return newUpdate;
    });

    return NextResponse.json(update, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
