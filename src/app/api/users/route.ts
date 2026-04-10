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
