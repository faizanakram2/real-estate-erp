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
