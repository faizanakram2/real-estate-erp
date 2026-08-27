import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  getAuthSession, unauthorizedResponse, forbiddenResponse,
  validationErrorResponse, serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  role: z.enum(["ADMIN","MANAGER","SALES_AGENT","ACCOUNTANT","SITE_ENGINEER","STAFF","CUSTOMER"]).default("STAFF"),
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get organization users
 *     description: Returns a paginated list of users belonging to the authenticated user's organization. Only ADMIN, SUPER_ADMIN, and MANAGER users can access this endpoint.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by name or email
 *
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - SUPER_ADMIN
 *             - MANAGER
 *             - SALES_AGENT
 *             - ACCOUNTANT
 *             - SITE_ENGINEER
 *             - STAFF
 *             - CUSTOMER
 *         description: Filter users by role
 *
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *
 *       401:
 *         description: Unauthorized
 *
 *       403:
 *         description: Forbidden - insufficient permissions
 *
 *       500:
 *         description: Internal server error
 *
 *   post:
 *     summary: Create organization user
 *     description: Creates a new user within the authenticated user's organization. Only ADMIN and SUPER_ADMIN users can create users.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           example:
 *             email: "john.doe@example.com"
 *             name: "John Doe"
 *             password: "Password123"
 *             phone: "+923001234567"
 *             cnic: "35202-1234567-1"
 *             role: "STAFF"
 *
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserCreated'
 *
 *       400:
 *         description: Validation error
 *
 *       401:
 *         description: Unauthorized
 *
 *       403:
 *         description: Forbidden - only ADMIN and SUPER_ADMIN can create users
 *
 *       500:
 *         description: Internal server error
 *
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - email
 *         - name
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: "john.doe@example.com"
 *         name:
 *           type: string
 *           minLength: 1
 *           description: User's full name
 *           example: "John Doe"
 *         password:
 *           type: string
 *           minLength: 6
 *           format: password
 *           description: User password
 *           example: "Password123"
 *         phone:
 *           type: string
 *           description: User phone number
 *           example: "+923001234567"
 *         cnic:
 *           type: string
 *           description: User CNIC
 *           example: "35202-1234567-1"
 *         role:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - MANAGER
 *             - SALES_AGENT
 *             - ACCOUNTANT
 *             - SITE_ENGINEER
 *             - STAFF
 *             - CUSTOMER
 *           default: STAFF
 *           example: STAFF
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "user_123"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+923001234567"
 *         role:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - SUPER_ADMIN
 *             - MANAGER
 *             - SALES_AGENT
 *             - ACCOUNTANT
 *             - SITE_ENGINEER
 *             - STAFF
 *             - CUSTOMER
 *         isActive:
 *           type: boolean
 *           example: true
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     UserCreated:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "user_123"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         role:
 *           type: string
 *           enum:
 *             - ADMIN
 *             - SUPER_ADMIN
 *             - MANAGER
 *             - SALES_AGENT
 *             - ACCOUNTANT
 *             - SITE_ENGINEER
 *             - STAFF
 *             - CUSTOMER
 *         createdAt:
 *           type: string
 *           format: date-time
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    if (!["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.user.role)) return forbiddenResponse();

    const { page, limit, skip, search } = getPaginationParams(request);
    const role = request.nextUrl.searchParams.get("role");

    const where: any = { organizationId: session.user.organizationId };
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, lastLogin: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(users, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) return forbiddenResponse();

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const passwordHash = await bcrypt.hash(d.password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: session.user.organizationId,
        email: d.email,
        name: d.name,
        passwordHash,
        phone: d.phone,
        cnic: d.cnic,
        role: d.role,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
