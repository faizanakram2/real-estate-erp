import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from "@/lib/api-utils";
import { createInstallmentPlanSchema } from "@/lib/validators/installment-plan";

/**
 * @swagger
 * /api/installment-plans:
 *   get:
 *     summary: Get active installment plans
 *     description: |
 *       Returns all active installment plans.
 *       Plans are ordered by duration in ascending order.
 *     tags:
 *       - Installment Plans
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Active installment plans retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "clx123abc456"
 *
 *                   name:
 *                     type: string
 *                     example: "3 Year Plan"
 *
 *                   description:
 *                     type: string
 *                     nullable: true
 *                     example: "Flexible 3 year installment plan"
 *
 *                   durationMonths:
 *                     type: integer
 *                     example: 36
 *
 *                   downPaymentPercent:
 *                     type: number
 *                     format: float
 *                     example: 20
 *
 *                   frequency:
 *                     type: string
 *                     enum:
 *                       - MONTHLY
 *                       - QUARTERLY
 *                       - YEARLY
 *                     example: "MONTHLY"
 *
 *                   gracePeriodDays:
 *                     type: integer
 *                     example: 7
 *
 *                   latePenaltyPercent:
 *                     type: number
 *                     format: float
 *                     example: 2
 *
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-08-27T10:00:00.000Z"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const plans = await prisma.installmentPlan.findMany({
      where: { isActive: true },
      orderBy: { durationMonths: "asc" },
    });

    return NextResponse.json(plans);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

/**
 * @swagger
 * /api/installment-plans:
 *   post:
 *     summary: Create installment plan
 *     description: |
 *       Creates a new installment plan.
 *       The plan can later be associated with bookings.
 *     tags:
 *       - Installment Plans
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - durationMonths
 *               - downPaymentPercent
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: "3 Year Plan"
 *                 description: Name of the installment plan.
 *
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Flexible 3 year installment plan"
 *                 description: Optional description of the plan.
 *
 *               durationMonths:
 *                 type: integer
 *                 minimum: 1
 *                 example: 36
 *                 description: Duration of the plan in months.
 *
 *               downPaymentPercent:
 *                 type: number
 *                 format: float
 *                 example: 20
 *                 description: Down payment percentage.
 *
 *               frequency:
 *                 type: string
 *                 enum:
 *                   - MONTHLY
 *                   - QUARTERLY
 *                   - HALF_YEARLY
 *                   - YEARLY
 *                 default: MONTHLY
 *                 example: "MONTHLY"
 *                 description: Frequency of installment payments.
 *
 *               gracePeriodDays:
 *                 type: integer
 *                 default: 7
 *                 example: 7
 *                 description: Number of grace-period days allowed after the due date.
 *
 *               latePenaltyPercent:
 *                 type: number
 *                 format: float
 *                 default: 0
 *                 example: 2
 *                 description: Late-payment penalty percentage.
 *
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Whether the installment plan is active.
 *
 *     responses:
 *       201:
 *         description: Installment plan created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "clx123abc456"
 *
 *                 name:
 *                   type: string
 *                   example: "3 Year Plan"
 *
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Flexible 3 year installment plan"
 *
 *                 durationMonths:
 *                   type: integer
 *                   example: 36
 *
 *                 downPaymentPercent:
 *                   type: number
 *                   format: float
 *                   example: 20
 *
 *                 frequency:
 *                   type: string
 *                   enum:
 *                     - MONTHLY
 *                     - QUARTERLY
 *                     - HALF_YEARLY
 *                     - YEARLY
 *                   example: "MONTHLY"
 *
 *                 gracePeriodDays:
 *                   type: integer
 *                   example: 7
 *
 *                 latePenaltyPercent:
 *                   type: number
 *                   format: float
 *                   example: 2
 *
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-08-27T10:00:00.000Z"
 *
 *       400:
 *         description: Validation error.
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       500:
 *         description: Internal server error.
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createInstallmentPlanSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const plan = await prisma.installmentPlan.create({
      data: parsed.data,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
