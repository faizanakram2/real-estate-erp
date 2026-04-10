import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthSession, unauthorizedResponse, validationErrorResponse,
  serverErrorResponse, getPaginationParams, paginatedResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const createMaintenanceSchema = z.object({
  plotId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["PLUMBING","ELECTRICAL","HVAC","STRUCTURAL","PEST_CONTROL","LANDSCAPING","PAINTING","FLOORING","GENERAL","EMERGENCY","OTHER"]),
  priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]).default("MEDIUM"),
  assigneeId: z.string().optional(),
  vendorId: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  estimatedCost: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const { page, limit, skip, search, sortBy, sortOrder } = getPaginationParams(request);
    const status = request.nextUrl.searchParams.get("status");
    const priority = request.nextUrl.searchParams.get("priority");

    const where: any = { createdBy: { organizationId: session.user.organizationId } };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where, skip, take: limit,
        include: {
          plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          assignee: { select: { id: true, name: true } },
          vendor: { select: { companyName: true } },
          _count: { select: { comments: true, images: true } },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return paginatedResponse(requests, total, page, limit);
  } catch (error) { return serverErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createMaintenanceSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error.flatten());

    const d = parsed.data;
    const mr = await prisma.maintenanceRequest.create({
      data: {
        ...d,
        createdById: session.user.id,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : undefined,
      },
    });
    return NextResponse.json(mr, { status: 201 });
  } catch (error) { return serverErrorResponse(error); }
}
