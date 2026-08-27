import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get document by ID
 *     description: Returns a single document by its ID.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the document.
 *         example: "doc_123"
 *
 *     responses:
 *       200:
 *         description: Document retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Document not found.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return notFoundResponse("Document");
    return NextResponse.json(doc);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Delete document
 *     description: Permanently deletes a document by its ID.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the document to delete.
 *         example: "doc_123"
 *
 *     responses:
 *       200:
 *         description: Document deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document deleted"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       404:
 *         description: Document not found.
 *
 *       500:
 *         description: Internal server error.
 */

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
