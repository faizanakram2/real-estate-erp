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


/**
 * @swagger
 * /api/construction/phases/{id}/updates:
 *   post:
 *     tags:
 *       - Construction
 *     summary: Add a construction phase progress update
 *     description: >
 *       Creates a progress update for a specific construction phase.
 *       The update can include progress percentage, weather information,
 *       labor count, issues, and multiple image URLs.
 *
 *       The construction phase progress and status are automatically updated
 *       based on the submitted progress value:
 *
 *       - 0 = NOT_STARTED
 *       - 1 to 99 = IN_PROGRESS
 *       - 100 = COMPLETED
 *
 *       Only construction phases belonging to the authenticated user's
 *       organization can be updated.
 *     security:
 *       - NextAuthSession: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Construction Phase ID
 *         schema:
 *           type: string
 *         example: "phase-id-here"
 *
 *     requestBody:
 *       required: true
 *       description: Construction progress update details
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - progress
 *             properties:
 *               description:
 *                 type: string
 *                 description: Description of the construction progress
 *                 example: "Foundation work completed successfully."
 *
 *               progress:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Current completion percentage of the phase
 *                 example: 45
 *
 *               weather:
 *                 type: string
 *                 description: Weather conditions during the work
 *                 example: "Sunny"
 *
 *               laborCount:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of workers involved
 *                 example: 25
 *
 *               issues:
 *                 type: string
 *                 description: Any issues or problems encountered
 *                 example: "Minor delay due to material delivery."
 *
 *               imageUrls:
 *                 type: array
 *                 description: List of construction update image URLs
 *                 items:
 *                   type: string
 *                 example:
 *                   - "https://example.com/images/construction-1.jpg"
 *                   - "https://example.com/images/construction-2.jpg"
 *
 *           example:
 *             description: "Foundation work completed successfully."
 *             progress: 45
 *             weather: "Sunny"
 *             laborCount: 25
 *             issues: "Minor delay due to material delivery."
 *             imageUrls:
 *               - "https://example.com/images/construction-1.jpg"
 *               - "https://example.com/images/construction-2.jpg"
 *
 *     responses:
 *       201:
 *         description: Construction progress update created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "construction-update-id"
 *
 *                 phaseId:
 *                   type: string
 *                   example: "phase-id-here"
 *
 *                 updatedById:
 *                   type: string
 *                   example: "user-id-here"
 *
 *                 description:
 *                   type: string
 *                   example: "Foundation work completed successfully."
 *
 *                 progress:
 *                   type: number
 *                   example: 45
 *
 *                 weather:
 *                   type: string
 *                   nullable: true
 *                   example: "Sunny"
 *
 *                 laborCount:
 *                   type: integer
 *                   nullable: true
 *                   example: 25
 *
 *                 issues:
 *                   type: string
 *                   nullable: true
 *                   example: "Minor delay due to material delivery."
 *
 *                 date:
 *                   type: string
 *                   format: date-time
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Validation failed
 *
 *                 details:
 *                   type: object
 *
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *
 *       404:
 *         description: Construction Phase not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Construction Phase not found
 *
 *       500:
 *         description: Internal server error
 */

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
