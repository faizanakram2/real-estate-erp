import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api-utils";
import { z } from "zod";
import jwt from "jsonwebtoken";

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(1),
});

const registerSchema = z.object({
  phone: z.string().min(10),
  cnic: z.string().min(1, "CNIC is required for verification"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * POST /api/customer-portal/auth
 * Customer portal login via phone + password
 */

/**
 * @swagger
 * /api/customer-portal/auth:
 *   post:
 *     tags:
 *       - Customer Portal
 *     summary: Customer portal authentication
 *     description: >
 *       Handles customer portal registration and login.
 *
 *       Registration verifies the customer's phone number and CNIC against
 *       an existing customer record before creating a portal account.
 *
 *       Login authenticates an existing portal customer using their phone
 *       number and password and returns a JWT token.
 *
 *       Use `action: "register"` for registration.
 *       Omit the `action` field for login.
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - action
 *                   - phone
 *                   - cnic
 *                   - password
 *                 properties:
 *                   action:
 *                     type: string
 *                     enum:
 *                       - register
 *                     example: register
 *                   phone:
 *                     type: string
 *                     description: Customer phone number
 *                     example: "03001234567"
 *                   cnic:
 *                     type: string
 *                     description: Customer CNIC used for verification
 *                     example: "35202-1234567-1"
 *                   password:
 *                     type: string
 *                     format: password
 *                     minLength: 6
 *                     example: "securepassword123"
 *
 *               - type: object
 *                 required:
 *                   - phone
 *                   - password
 *                 properties:
 *                   phone:
 *                     type: string
 *                     description: Customer registered phone number
 *                     example: "03001234567"
 *                   password:
 *                     type: string
 *                     format: password
 *                     example: "securepassword123"
 *
 *           examples:
 *             register:
 *               summary: Create customer portal account
 *               value:
 *                 action: "register"
 *                 phone: "03001234567"
 *                 cnic: "35202-1234567-1"
 *                 password: "securepassword123"
 *
 *             login:
 *               summary: Login to customer portal
 *               value:
 *                 phone: "03001234567"
 *                 password: "securepassword123"
 *
 *     responses:
 *       200:
 *         description: Registration successful or login successful
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Portal account created. You can now login."
 *
 *                 - type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token for customer portal authentication
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *
 *                     customer:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "customer-id-here"
 *
 *                         firstName:
 *                           type: string
 *                           example: "Ahmed"
 *
 *                         lastName:
 *                           type: string
 *                           example: "Khan"
 *
 *                         phone:
 *                           type: string
 *                           example: "03001234567"
 *
 *                         email:
 *                           type: string
 *                           nullable: true
 *                           example: "ahmed@example.com"
 *
 *                         organization:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: "organization-id-here"
 *
 *                             name:
 *                               type: string
 *                               example: "ABC Housing Society"
 *
 *           examples:
 *             registrationSuccess:
 *               summary: Portal account created
 *               value:
 *                 message: "Portal account created. You can now login."
 *
 *             loginSuccess:
 *               summary: Login successful
 *               value:
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 customer:
 *                   id: "customer-id-here"
 *                   firstName: "Ahmed"
 *                   lastName: "Khan"
 *                   phone: "03001234567"
 *                   email: "ahmed@example.com"
 *                   organization:
 *                     id: "organization-id-here"
 *                     name: "ABC Housing Society"
 *
 *       400:
 *         description: Validation error or portal account already exists
 *         content:
 *           application/json:
 *             examples:
 *               validationError:
 *                 summary: Invalid request data
 *                 value:
 *                   error: "Validation failed"
 *
 *               alreadyRegistered:
 *                 summary: Portal account already exists
 *                 value:
 *                   error: "Portal account already exists. Please login."
 *
 *       401:
 *         description: Invalid login credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid credentials"
 *
 *       404:
 *         description: Customer not found during registration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No customer found with this phone and CNIC combination"
 *
 *       500:
 *         description: Internal server error
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Registration flow
    if (body.action === "register") {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

      const customer = await prisma.customer.findFirst({
        where: { phone: parsed.data.phone, cnic: parsed.data.cnic },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "No customer found with this phone and CNIC combination" },
          { status: 404 }
        );
      }
      if (customer.portalEnabled) {
        return NextResponse.json(
          { error: "Portal account already exists. Please login." },
          { status: 400 }
        );
      }

      const hash = await bcrypt.hash(parsed.data.password, 12);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { portalPassword: hash, portalEnabled: true },
      });

      return NextResponse.json({ message: "Portal account created. You can now login." });
    }

    // Login flow
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const customer = await prisma.customer.findFirst({
      where: { phone: parsed.data.phone, portalEnabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!customer || !customer.portalPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(parsed.data.password, customer.portalPassword);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
    const token = jwt.sign(
      {
        customerId: customer.id,
        organizationId: customer.organizationId,
        phone: customer.phone,
        name: `${customer.firstName} ${customer.lastName}`,
        type: "customer_portal",
      },
      secret,
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        organization: customer.organization,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
