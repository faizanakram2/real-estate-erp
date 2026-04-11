import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, unauthorizedResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/search?q=keyword&limit=10
 * Global search across customers, plots, bookings, payments, projects
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
