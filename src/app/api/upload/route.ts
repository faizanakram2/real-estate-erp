import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";


/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file
 *     description: Upload an image, PDF, Word document, or Excel spreadsheet. Maximum file size is 10 MB.
 *     tags:
 *       - Upload
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload. Maximum size is 10 MB.
 *
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fileUrl:
 *                   type: string
 *                   description: URL of the uploaded file
 *                   example: "/uploads/org_123/2026-08-27/1756291234567-document.pdf"
 *                 fileName:
 *                   type: string
 *                   description: Original file name
 *                   example: "document.pdf"
 *                 fileSize:
 *                   type: integer
 *                   description: File size in bytes
 *                   example: 524288
 *                 mimeType:
 *                   type: string
 *                   description: MIME type of the uploaded file
 *                   example: "application/pdf"
 *
 *       400:
 *         description: Invalid file, missing file, file too large, or unsupported file type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               noFile:
 *                 summary: No file provided
 *                 value:
 *                   error: "No file provided"
 *               fileTooLarge:
 *                 summary: File exceeds size limit
 *                 value:
 *                   error: "File size exceeds 10MB limit"
 *               invalidType:
 *                 summary: Unsupported file type
 *                 value:
 *                   error: "File type not allowed"
 *
 *       401:
 *         description: Unauthorized
 *
 *       500:
 *         description: Internal server error
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}-${safeName}`;

    // Store in uploads directory organized by org and date
    const orgId = session.user.organizationId;
    const dateDir = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const uploadDir = path.join(process.cwd(), "uploads", orgId, dateDir);
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${orgId}/${dateDir}/${fileName}`;

    return NextResponse.json({
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
