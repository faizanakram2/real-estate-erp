import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/search?q=keyword&limit=10
 * Global search across customers, plots, bookings, payments, projects
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global search
 *     description: >
 *       Performs a global search across customers, plots, bookings,
 *       payments, and projects belonging to the authenticated user's
 *       organization.
 *     tags:
 *       - Search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search keyword. Must contain at least 2 characters.
 *         example: "Ahmed"
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Maximum number of results returned for each result category. Values above 20 are limited to 20.
 *         example: 10
 *     responses:
 *       200:
 *         description: Search results returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                   example: "Ahmed"
 *                 totalResults:
 *                   type: integer
 *                   example: 12
 *                 results:
 *                   type: object
 *                   properties:
 *                     customers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           firstName:
 *                             type: string
 *                             example: "Ahmed"
 *                           lastName:
 *                             type: string
 *                             example: "Raza"
 *                           phone:
 *                             type: string
 *                             example: "+923001234567"
 *                           cnic:
 *                             type: string
 *                             example: "35202-1234567-1"
 *                           status:
 *                             type: string
 *                             example: "ACTIVE"
 *                           _type:
 *                             type: string
 *                             example: "customer"
 *                     plots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           plotNumber:
 *                             type: string
 *                             example: "A-102"
 *                           type:
 *                             type: string
 *                             example: "RESIDENTIAL"
 *                           status:
 *                             type: string
 *                             example: "AVAILABLE"
 *                           size:
 *                             type: number
 *                             format: double
 *                             example: 5
 *                           sizeUnit:
 *                             type: string
 *                             example: "MARLA"
 *                           totalPrice:
 *                             type: number
 *                             format: double
 *                             example: 4500000
 *                           project:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Green Valley Housing"
 *                           block:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "Block A"
 *                           _type:
 *                             type: string
 *                             example: "plot"
 *                     bookings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           bookingNumber:
 *                             type: string
 *                             example: "BK-2026-00025"
 *                           status:
 *                             type: string
 *                             example: "CONFIRMED"
 *                           netAmount:
 *                             type: number
 *                             format: double
 *                             example: 5000000
 *                           customer:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                                 example: "Ahmed"
 *                               lastName:
 *                                 type: string
 *                                 example: "Raza"
 *                           plot:
 *                             type: object
 *                             properties:
 *                               plotNumber:
 *                                 type: string
 *                                 example: "A-102"
 *                               project:
 *                                 type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Green Valley Housing"
 *                           _type:
 *                             type: string
 *                             example: "booking"
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           receiptNumber:
 *                             type: string
 *                             example: "REC-2026-00025"
 *                           amount:
 *                             type: number
 *                             format: double
 *                             example: 500000
 *                           status:
 *                             type: string
 *                             example: "CONFIRMED"
 *                           paymentMethod:
 *                             type: string
 *                             example: "BANK_TRANSFER"
 *                           paymentDate:
 *                             type: string
 *                             format: date-time
 *                           customer:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                                 example: "Ahmed"
 *                               lastName:
 *                                 type: string
 *                                 example: "Raza"
 *                           _type:
 *                             type: string
 *                             example: "payment"
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                             example: "Green Valley Housing"
 *                           type:
 *                             type: string
 *                             example: "RESIDENTIAL"
 *                           status:
 *                             type: string
 *                             example: "ACTIVE"
 *                           city:
 *                             type: string
 *                             example: "Lahore"
 *                           _type:
 *                             type: string
 *                             example: "project"
 *       400:
 *         description: Invalid search query. Query must contain at least 2 characters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Search query must be at least 2 characters"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const q = request.nextUrl.searchParams.get("q");
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "5"), 20);

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
    }

    const orgId = session.user.organizationId;

    const [customers, plots, bookings, payments, projects] = await Promise.all([
      prisma.customer.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { cnic: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, phone: true, cnic: true, status: true },
        take: limit,
      }),

      prisma.plot.findMany({
        where: {
          project: { organizationId: orgId },
          OR: [
            { plotNumber: { contains: q, mode: "insensitive" } },
            { street: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, plotNumber: true, type: true, status: true, size: true, sizeUnit: true, totalPrice: true,
          project: { select: { name: true } },
          block: { select: { name: true } },
        },
        take: limit,
      }),

      prisma.booking.findMany({
        where: {
          plot: { project: { organizationId: orgId } },
          OR: [
            { bookingNumber: { contains: q, mode: "insensitive" } },
            { customer: { OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ]}},
          ],
        },
        select: {
          id: true, bookingNumber: true, status: true, netAmount: true,
          customer: { select: { firstName: true, lastName: true } },
          plot: { select: { plotNumber: true, project: { select: { name: true } } } },
        },
        take: limit,
      }),

      prisma.paymentRecord.findMany({
        where: {
          booking: { plot: { project: { organizationId: orgId } } },
          OR: [
            { receiptNumber: { contains: q, mode: "insensitive" } },
            { referenceNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, receiptNumber: true, amount: true, status: true, paymentMethod: true, paymentDate: true,
          customer: { select: { firstName: true, lastName: true } },
        },
        take: limit,
      }),

      prisma.project.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, type: true, status: true, city: true },
        take: limit,
      }),
    ]);

    const totalResults = customers.length + plots.length + bookings.length + payments.length + projects.length;

    return NextResponse.json({
      query: q,
      totalResults,
      results: {
        customers: customers.map((c) => ({ ...c, _type: "customer" })),
        plots: plots.map((p) => ({ ...p, _type: "plot" })),
        bookings: bookings.map((b) => ({ ...b, _type: "booking" })),
        payments: payments.map((p) => ({ ...p, _type: "payment" })),
        projects: projects.map((p) => ({ ...p, _type: "project" })),
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
