import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
  getPaginationParams,
  paginatedResponse,
} from "@/lib/api-utils";
import { createCustomerSchema } from "@/lib/validators/customer";

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     description: Returns paginated customers for the authenticated organization.
 *     tags:
 *       - Customers
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: ACTIVE
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } =
      getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");

    const where: any = { organizationId: session.user.organizationId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { cnic: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { bookings: true, paymentRecords: true } },
          bookings: {
            where: { status: { in: ["BOOKED", "CONFIRMED", "ACTIVE"] } },
            select: {
              id: true,
              bookingNumber: true,
              status: true,
              netAmount: true,
              plot: {
                select: {
                  plotNumber: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginatedResponse(customers, total, page, limit);
  } catch (error) {
    return serverErrorResponse(error);
  }
}


/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a customer
 *     tags:
 *       - Customers
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - phone
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Muhammad
 *               lastName:
 *                 type: string
 *                 example: Ahmed
 *               email:
 *                 type: string
 *                 example: muhammad@example.com
 *               phone:
 *                 type: string
 *                 example: "03001234567"
 *               cnic:
 *                 type: string
 *                 example: "35202-1234567-1"
 *               city:
 *                 type: string
 *                 example: Lahore
 *               country:
 *                 type: string
 *                 example: PK
 *               monthlyIncome:
 *                 type: number
 *                 example: 150000
 *               source:
 *                 type: string
 *                 example: Website
 *               notes:
 *                 type: string
 *                 example: Customer created from Swagger
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const data = parsed.data;
    const customer = await prisma.customer.create({
      data: {
        organizationId: session.user.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        cnic: data.cnic,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        fatherName: data.fatherName,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        occupation: data.occupation,
        employer: data.employer,
        monthlyIncome: data.monthlyIncome,
        emergencyName: data.emergencyName,
        emergencyPhone: data.emergencyPhone,
        emergencyRelation: data.emergencyRelation,
        nomineeName: data.nomineeName,
        nomineeCnic: data.nomineeCnic,
        nomineeRelation: data.nomineeRelation,
        source: data.source,
        notes: data.notes,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
