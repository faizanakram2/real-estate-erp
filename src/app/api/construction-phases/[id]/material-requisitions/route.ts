import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, notFoundResponse,
  validationErrorResponse, serverErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createRequisitionSchema = z.object({
  vendorId: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitCost: z.number().positive(),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/construction/phases/{id}/materials:
 *   get:
 *     tags:
 *       - Construction
 *     summary: Get material requisitions for a construction phase
 *     description: >
 *       Retrieves all material requisitions associated with a specific
 *       construction phase. Only requisitions belonging to projects within
 *       the authenticated user's organization are returned.
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
 *     responses:
 *       200:
 *         description: Material requisitions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "material-requisition-id"
 *                   phaseId:
 *                     type: string
 *                     example: "phase-id-here"
 *                   vendorId:
 *                     type: string
 *                     nullable: true
 *                     example: "vendor-id-here"
 *                   itemName:
 *                     type: string
 *                     example: "Cement"
 *                   quantity:
 *                     type: number
 *                     example: 500
 *                   unit:
 *                     type: string
 *                     example: "Bags"
 *                   unitCost:
 *                     type: number
 *                     example: 1250
 *                   totalCost:
 *                     type: number
 *                     example: 625000
 *                   requestDate:
 *                     type: string
 *                     format: date-time
 *                   deliveryDate:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   notes:
 *                     type: string
 *                     nullable: true
 *                     example: "Required for foundation work"
 *                   vendor:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       companyName:
 *                         type: string
 *                         example: "ABC Building Materials"
 *
 *       401:
 *         description: Unauthorized - Authentication required
 *
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const materials = await prisma.materialRequisition.findMany({
      where: { phaseId: params.id, phase: { project: { organizationId: session.user.organizationId } } },
      include: { vendor: { select: { companyName: true } } },
      orderBy: { requestDate: "desc" },
    });
    return NextResponse.json(materials);
  } catch (error) { return serverErrorResponse(error); }
}

/**
 * @swagger
 * /api/construction/phases/{id}/materials:
 *   post:
 *     tags:
 *       - Construction
 *     summary: Create a material requisition
 *     description: >
 *       Creates a new material requisition for a specific construction phase.
 *       The construction phase must belong to a project within the authenticated
 *       user's organization. The total cost is automatically calculated as
 *       quantity multiplied by unit cost.
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemName
 *               - quantity
 *               - unit
 *               - unitCost
 *             properties:
 *               vendorId:
 *                 type: string
 *                 nullable: true
 *                 description: Optional vendor ID
 *                 example: "vendor-id-here"
 *               itemName:
 *                 type: string
 *                 description: Name of the material
 *                 example: "Cement"
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 example: 500
 *               unit:
 *                 type: string
 *                 example: "Bags"
 *               unitCost:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *                 example: 1250
 *               deliveryDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-09-15T10:00:00.000Z"
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 example: "Required for foundation construction"
 *
 *           example:
 *             vendorId: "vendor-id-here"
 *             itemName: "Cement"
 *             quantity: 500
 *             unit: "Bags"
 *             unitCost: 1250
 *             deliveryDate: "2026-09-15T10:00:00.000Z"
 *             notes: "Required for foundation construction"
 *
 *     responses:
 *       201:
 *         description: Material requisition created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "material-requisition-id"
 *                 phaseId:
 *                   type: string
 *                   example: "phase-id-here"
 *                 vendorId:
 *                   type: string
 *                   nullable: true
 *                 itemName:
 *                   type: string
 *                   example: "Cement"
 *                 quantity:
 *                   type: number
 *                   example: 500
 *                 unit:
 *                   type: string
 *                   example: "Bags"
 *                 unitCost:
 *                   type: number
 *                   example: 1250
 *                 totalCost:
 *                   type: number
 *                   example: 625000
 *                 requestDate:
 *                   type: string
 *                   format: date-time
 *                 deliveryDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 notes:
 *                   type: string
 *                   nullable: true
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
 *                 details:
 *                   type: object
 *
 *       401:
 *         description: Unauthorized - Authentication required
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
    const parsed = createRequisitionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const requisition = await prisma.materialRequisition.create({
      data: {
        phaseId: params.id,
        vendorId: d.vendorId,
        itemName: d.itemName,
        quantity: d.quantity,
        unit: d.unit,
        unitCost: d.unitCost,
        totalCost: d.quantity * d.unitCost,
        deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : undefined,
        notes: d.notes,
      },
    });
    return NextResponse.json(requisition, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
