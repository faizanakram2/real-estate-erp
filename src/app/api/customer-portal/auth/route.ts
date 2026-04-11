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
