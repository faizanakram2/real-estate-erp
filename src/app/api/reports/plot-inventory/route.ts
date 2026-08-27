import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

/**
 * GET /api/reports/plot-inventory
 * Plot inventory summary by project, block, type, status
 */

/**
 * @swagger
 * /api/reports/plot-inventory:
 *   get:
 *     summary: Get plot inventory report
 *     description: |
 *       Returns a plot inventory summary grouped by status, type, and project.
 *       Includes total plot count, total value, available plots, booked plots,
 *       sold plots, and available plot value.
 *       Optionally filters the report by project.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter inventory by project ID
 *         example: "8f7c6d5e-4a3b-2c1d-9876-123456789abc"
 *
 *     responses:
 *       200:
 *         description: Plot inventory report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalPlots:
 *                       type: integer
 *                       description: Total number of plots
 *                       example: 250
 *                     totalValue:
 *                       type: number
 *                       format: double
 *                       description: Total value of all plots
 *                       example: 125000000
 *
 *                 byStatus:
 *                   type: array
 *                   description: Plot inventory grouped by plot status
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         description: Plot status
 *                         example: "AVAILABLE"
 *                       count:
 *                         type: integer
 *                         example: 120
 *                       value:
 *                         type: number
 *                         format: double
 *                         example: 60000000
 *
 *                 byType:
 *                   type: array
 *                   description: Plot inventory grouped by plot type
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         description: Plot type
 *                         example: "RESIDENTIAL"
 *                       count:
 *                         type: integer
 *                         example: 180
 *                       value:
 *                         type: number
 *                         format: double
 *                         example: 90000000
 *
 *                 byProject:
 *                   type: array
 *                   description: Plot inventory grouped by project
 *                   items:
 *                     type: object
 *                     properties:
 *                       projectId:
 *                         type: string
 *                         example: "8f7c6d5e-4a3b-2c1d-9876-123456789abc"
 *                       projectName:
 *                         type: string
 *                         example: "Green Valley Housing"
 *                       total:
 *                         type: integer
 *                         description: Total plots in the project
 *                         example: 100
 *                       available:
 *                         type: integer
 *                         description: Available plots
 *                         example: 50
 *                       booked:
 *                         type: integer
 *                         description: Booked plots
 *                         example: 30
 *                       sold:
 *                         type: integer
 *                         description: Sold plots
 *                         example: 20
 *                       totalValue:
 *                         type: number
 *                         format: double
 *                         description: Total value of all plots in the project
 *                         example: 50000000
 *                       availableValue:
 *                         type: number
 *                         format: double
 *                         description: Total value of available plots
 *                         example: 25000000
 *
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *
 *       500:
 *         description: Internal server error
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
