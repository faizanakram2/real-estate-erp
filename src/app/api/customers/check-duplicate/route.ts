import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/customers/check-duplicate?phone=xxx&cnic=xxx
 * Check if a customer already exists before creating
 */

/**
 * @swagger
 * /api/customers/check-duplicate:
 *   get:
 *     summary: Check duplicate customer
 *     description: Checks whether a customer already exists using phone, CNIC, or email.
 *     tags:
 *       - Customers
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *       - in: query
 *         name: cnic
 *         schema:
 *           type: string
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Duplicate check completed
 *       400:
 *         description: At least one parameter is required
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const phone = request.nextUrl.searchParams.get("phone");
    const cnic = request.nextUrl.searchParams.get("cnic");
    const email = request.nextUrl.searchParams.get("email");

    if (!phone && !cnic && !email) {
      return NextResponse.json({ error: "Provide at least one of: phone, cnic, email" }, { status: 400 });
    }

    const conditions: any[] = [];
    if (phone) conditions.push({ phone: { contains: phone.replace(/\D/g, "").slice(-10) } });
    if (cnic) conditions.push({ cnic });
    if (email) conditions.push({ email: { equals: email, mode: "insensitive" } });

    const matches = await prisma.customer.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: conditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        cnic: true,
        email: true,
        status: true,
        _count: { select: { bookings: true } },
      },
      take: 10,
    });

    const isDuplicate = matches.length > 0;

    return NextResponse.json({
      isDuplicate,
      matchCount: matches.length,
      matches: matches.map((m) => ({
        ...m,
        matchedOn: [
          phone && m.phone?.includes(phone.replace(/\D/g, "").slice(-10)) ? "phone" : null,
          cnic && m.cnic === cnic ? "cnic" : null,
          email && m.email?.toLowerCase() === email.toLowerCase() ? "email" : null,
        ].filter(Boolean),
      })),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
