import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/plot-inventory
 * Plot inventory summary by project, block, type, status
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const projectId = request.nextUrl.searchParams.get("projectId");

    const where: any = { project: { organizationId: session.user.organizationId } };
    if (projectId) where.projectId = projectId;

    // By status
    const byStatus = await prisma.plot.groupBy({
      by: ["status"],
      where,
      _count: true,
      _sum: { totalPrice: true },
    });

    // By type
    const byType = await prisma.plot.groupBy({
      by: ["type"],
      where,
      _count: true,
      _sum: { totalPrice: true },
    });

    // By project
    const projects = await prisma.project.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true, name: true,
        plots: { select: { status: true, totalPrice: true } },
      },
    });

    const byProject = projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      total: p.plots.length,
      available: p.plots.filter((pl) => pl.status === "AVAILABLE").length,
      booked: p.plots.filter((pl) => pl.status === "BOOKED").length,
      sold: p.plots.filter((pl) => pl.status === "SOLD").length,
      totalValue: p.plots.reduce((sum, pl) => sum + Number(pl.totalPrice), 0),
      availableValue: p.plots.filter((pl) => pl.status === "AVAILABLE").reduce((sum, pl) => sum + Number(pl.totalPrice), 0),
    }));

    const totalPlots = byStatus.reduce((sum, s) => sum + s._count, 0);
    const totalValue = byStatus.reduce((sum, s) => sum + Number(s._sum.totalPrice || 0), 0);

    return NextResponse.json({
      summary: { totalPlots, totalValue },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count, value: Number(s._sum.totalPrice || 0) })),
      byType: byType.map((t) => ({ type: t.type, count: t._count, value: Number(t._sum.totalPrice || 0) })),
      byProject,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
