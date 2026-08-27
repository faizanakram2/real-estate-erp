import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, isErrorResponse } from "@/lib/rbac";
import { serverErrorResponse } from "@/lib/api-utils";

function toCSV(headers: string[], rows: any[][]): string {
  const escape = (val: any) => {
    const str = val === null || val === undefined ? "" : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

/**
 * GET /api/export/:type
 * Export data as CSV. Types: customers, plots, bookings, payments, installments, employees
 */

/**
 * @swagger
 * /api/export/{type}:
 *   get:
 *     summary: Export data as CSV
 *     description: |
 *       Exports organization data as a CSV file.
 *
 *       Supported export types:
 *       - customers
 *       - plots
 *       - bookings
 *       - payments
 *       - installments
 *       - employees
 *
 *       The authenticated user must have the reports:read permission.
 *     tags:
 *       - Exports
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - customers
 *             - plots
 *             - bookings
 *             - payments
 *             - installments
 *             - employees
 *         description: Type of data to export.
 *         example: customers
 *
 *       - in: query
 *         name: projectId
 *         required: false
 *         schema:
 *           type: string
 *         description: |
 *           Project ID used when exporting plots.
 *           If provided, only plots belonging to this project are exported.
 *         example: "project_123"
 *
 *       - in: query
 *         name: bookingId
 *         required: false
 *         schema:
 *           type: string
 *         description: |
 *           Booking ID used when exporting installments.
 *           If provided, only installments belonging to this booking are exported.
 *         example: "booking_123"
 *
 *     responses:
 *       200:
 *         description: CSV file generated successfully.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: CSV file download header.
 *             example: 'attachment; filename="customers.csv"'
 *
 *       400:
 *         description: |
 *           Invalid export type. Valid types are customers, plots, bookings,
 *           payments, installments, and employees.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unknown export type: invalid. Valid: customers, plots, bookings, payments, installments, employees"
 *
 *       401:
 *         description: Unauthorized. Authentication is required.
 *
 *       403:
 *         description: Forbidden. The user does not have the reports:read permission.
 *
 *       500:
 *         description: Internal server error.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const auth = await authorize("reports:read");
    if (isErrorResponse(auth)) return auth;
    const { session } = auth;

    const orgId = session.user.organizationId;
    let csv = "";
    let filename = "";

    switch (params.type) {
      case "customers": {
        const data = await prisma.customer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(
          ["ID", "First Name", "Last Name", "Phone", "CNIC", "Email", "City", "Status", "Source", "Created"],
          data.map((c) => [c.id, c.firstName, c.lastName, c.phone, c.cnic, c.email, c.city, c.status, c.source, c.createdAt.toISOString()])
        );
        filename = "customers.csv";
        break;
      }

      case "plots": {
        const projectId = request.nextUrl.searchParams.get("projectId");
        const where: any = { project: { organizationId: orgId } };
        if (projectId) where.projectId = projectId;

        const data = await prisma.plot.findMany({
          where,
          include: { project: { select: { name: true } }, block: { select: { name: true } } },
          orderBy: { plotNumber: "asc" },
        });
        csv = toCSV(
          ["Plot #", "Project", "Block", "Type", "Size", "Unit", "Base Price", "Premium", "Total Price", "Status", "Direction"],
          data.map((p) => [p.plotNumber, p.project.name, p.block?.name, p.type, p.size, p.sizeUnit, p.basePrice, p.premiumAmount, p.totalPrice, p.status, p.facingDirection])
        );
        filename = "plots.csv";
        break;
      }

      case "bookings": {
        const data = await prisma.booking.findMany({
          where: { plot: { project: { organizationId: orgId } } },
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
            plot: { select: { plotNumber: true, project: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(
          ["Booking #", "Customer", "Phone", "Project", "Plot", "Total Price", "Net Amount", "Status", "Booking Date"],
          data.map((b) => [b.bookingNumber, `${b.customer.firstName} ${b.customer.lastName}`, b.customer.phone, b.plot.project.name, b.plot.plotNumber, b.totalPrice, b.netAmount, b.status, b.bookingDate.toISOString().split("T")[0]])
        );
        filename = "bookings.csv";
        break;
      }

      case "payments": {
        const data = await prisma.paymentRecord.findMany({
          where: { booking: { plot: { project: { organizationId: orgId } } } },
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
            booking: { select: { bookingNumber: true } },
          },
          orderBy: { paymentDate: "desc" },
        });
        csv = toCSV(
          ["Receipt #", "Customer", "Phone", "Booking #", "Amount", "Method", "Status", "Reference", "Payment Date"],
          data.map((p) => [p.receiptNumber, `${p.customer.firstName} ${p.customer.lastName}`, p.customer.phone, p.booking.bookingNumber, p.amount, p.paymentMethod, p.status, p.referenceNumber, p.paymentDate.toISOString().split("T")[0]])
        );
        filename = "payments.csv";
        break;
      }

      case "installments": {
        const bookingId = request.nextUrl.searchParams.get("bookingId");
        const where: any = { booking: { plot: { project: { organizationId: orgId } } } };
        if (bookingId) where.bookingId = bookingId;

        const data = await prisma.installment.findMany({
          where,
          include: { booking: { select: { bookingNumber: true, customer: { select: { firstName: true, lastName: true } } } } },
          orderBy: [{ bookingId: "asc" }, { dueDate: "asc" }],
        });
        csv = toCSV(
          ["Booking #", "Customer", "Inst #", "Type", "Amount", "Due Date", "Status", "Paid Amount", "Paid Date", "Penalty", "Balance"],
          data.map((i) => [i.booking.bookingNumber, `${i.booking.customer.firstName} ${i.booking.customer.lastName}`, i.installmentNo, i.type, i.amount, i.dueDate.toISOString().split("T")[0], i.status, i.paidAmount, i.paidDate?.toISOString().split("T")[0], i.latePenalty, i.balanceAmount])
        );
        filename = "installments.csv";
        break;
      }

      case "employees": {
        const data = await prisma.employee.findMany({
          where: { organizationId: orgId },
          orderBy: { employeeCode: "asc" },
        });
        csv = toCSV(
          ["Code", "First Name", "Last Name", "Phone", "CNIC", "Department", "Designation", "Type", "Base Salary", "Status", "Joining Date"],
          data.map((e) => [e.employeeCode, e.firstName, e.lastName, e.phone, e.cnic, e.department, e.designation, e.employmentType, e.baseSalary, e.status, e.joiningDate.toISOString().split("T")[0]])
        );
        filename = "employees.csv";
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown export type: ${params.type}. Valid: customers, plots, bookings, payments, installments, employees` }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
