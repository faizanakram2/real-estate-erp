import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Real Estate Builder ERP API",
      version: "1.0.0",
      description: `
API documentation for the Real Estate Builder ERP backend.

Authentication is handled using NextAuth Credentials Provider.
Login requires email and password.
Authenticated API endpoints require a valid NextAuth session.
      `,
    },

    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Development Server",
      },
    ],

    tags: [
      {
        name: "Authentication",
        description: "Authentication and session management",
      },
      {
        name: "Activity",
        description: "Activity timelines, audit logs, payments, and entity history",
      },
      {
        name: "Audit Logs",
        description: "System audit logs and administrative activity tracking",
      },
      {
        name: "Bookings",
        description: "Booking management, cancellation, and transfer operations",
      },
      {
        name: "Bulk Operations",
        description: "Bulk attendence management for employees",
      },
      {
        name: "Customers",
        description: "Customers management",
      },
      {
        name: "Customer Portal",
        description:
          "APIs for customers to access their own bookings, installment schedules, payments, and portal account information.",
      },
      {
        name: "Commissions",
        description:
          "Manage sales agent commissions, including commission records, calculation, status tracking, and payment summaries.",
      },
      {
        name: "Construction",
        description:
          "Manage construction projects, phases, progress updates, materials, and related construction activities.",
      },
      {
        name: "Dashboard",
        description: "Dashboard stats",
      },
      {
        name: "Documents",
        description: "Document management APIs",
      },
      {
        name: "Employees",
        description: "Employee management APIs",
      },
      {
        name: "Exports",
        description: "CSV data export APIs",
      },
      {
        name: "Installment Plans",
        description: "Installment plan management APIs",
      },
      {
        name: "Installments",
        description: "Installment management APIs",
      },
      {
        name: "Ledger Accounts",
        description: "Chart of accounts and ledger account management APIs",
      },
      {
        name: "Maintenance",
        description: "Maintenance request management APIs",
      },
      {
        name: "Notification Templates",
        description: "Notification template management APIs",
      },
      {
        name: "Notifications",
        description: "User notification management APIs",
      },
      {
        name: "Organization",
        description: "Organization profile and settings APIs",
      },
      {
        name: "Payments",
        description: "Payment records, receipts, and payment management APIs",
      },
      {
        name: "Plots",
        description: "Plot management, availability, and plot creation APIs",
      },
      {
        name: "Projects",
        description: "Project management APIs",
      },
      {
        name: "Reminders",
        description: "Payment reminder generation and preview endpoints",
      },
      {
        name: "Reports",
        description: "Financial and business reports",
      },
      {
        name: "Search",
        description: "Search...",
      },
      {
        name: "Transactions",
        description: "Transactions...",
      },
      {
        name: "Upload",
        description: "Upload...",
      },
      {
        name: "Users",
        description: "Users...",
      },
      {
        name: "Vendors",
        description: "Vendors...",
      },
    ],

    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "next-auth.session-token",
          description:
            "NextAuth JWT session cookie. This cookie is automatically created after successful login.",
        },
        CustomerPortalAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Customer Portal JWT token returned from POST /api/customer-portal/auth",
        },
      },

      schemas: {
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "admin@devlayers.org",
            },
            password: {
              type: "string",
              format: "password",
              example: "admin123",
            },
          },
        },

        UserSession: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  example: "user-id",
                },
                name: {
                  type: "string",
                  example: "Admin User",
                },
                email: {
                  type: "string",
                  format: "email",
                  example: "admin@devlayers.org",
                },
                role: {
                  type: "string",
                  example: "ADMIN",
                },
                organizationId: {
                  type: "string",
                  example: "organization-id",
                },
                organizationName: {
                  type: "string",
                  example: "Devlayers Builders & Developers",
                },
              },
            },
            expires: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Document: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "doc_123",
            },
            name: {
              type: "string",
              example: "Booking Agreement",
            },
            description: {
              type: "string",
              nullable: true,
              example: "Signed booking agreement",
            },
            type: {
              type: "string",
              enum: [
                "BOOKING_FORM",
                "ALLOTMENT_LETTER",
                "TRANSFER_DEED",
                "PAYMENT_RECEIPT",
                "CNIC_COPY",
                "MAP",
                "AGREEMENT",
                "NOC",
                "POSSESSION_LETTER",
                "INSPECTION_REPORT",
                "INSURANCE",
                "TAX_DOCUMENT",
                "OTHER",
              ],
              example: "AGREEMENT",
            },
            category: {
              type: "string",
              nullable: true,
              example: "Legal",
            },
            fileUrl: {
              type: "string",
              example: "https://example.com/documents/agreement.pdf",
            },
            fileSize: {
              type: "integer",
              nullable: true,
              example: 245760,
            },
            mimeType: {
              type: "string",
              nullable: true,
              example: "application/pdf",
            },
            projectId: {
              type: "string",
              nullable: true,
              example: "project_123",
            },
            customerId: {
              type: "string",
              nullable: true,
              example: "customer_123",
            },
            bookingId: {
              type: "string",
              nullable: true,
              example: "booking_123",
            },
            vendorId: {
              type: "string",
              nullable: true,
              example: "vendor_123",
            },
            uploadedById: {
              type: "string",
              example: "user_123",
            },
            expiryDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2027-08-27T00:00:00.000Z",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T10:30:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T10:30:00.000Z",
            },
          },
        },

        CreateDocumentRequest: {
          type: "object",
          required: [
            "name",
            "type",
            "fileUrl",
          ],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              example: "Booking Agreement",
            },
            description: {
              type: "string",
              example: "Signed booking agreement",
            },
            type: {
              type: "string",
              enum: [
                "BOOKING_FORM",
                "ALLOTMENT_LETTER",
                "TRANSFER_DEED",
                "PAYMENT_RECEIPT",
                "CNIC_COPY",
                "MAP",
                "AGREEMENT",
                "NOC",
                "POSSESSION_LETTER",
                "INSPECTION_REPORT",
                "INSURANCE",
                "TAX_DOCUMENT",
                "OTHER",
              ],
              example: "AGREEMENT",
            },
            category: {
              type: "string",
              example: "Legal",
            },
            fileUrl: {
              type: "string",
              minLength: 1,
              example: "https://example.com/documents/agreement.pdf",
            },
            fileSize: {
              type: "integer",
              example: 245760,
            },
            mimeType: {
              type: "string",
              example: "application/pdf",
            },
            projectId: {
              type: "string",
              example: "project_123",
            },
            customerId: {
              type: "string",
              example: "customer_123",
            },
            bookingId: {
              type: "string",
              example: "booking_123",
            },
            vendorId: {
              type: "string",
              example: "vendor_123",
            },
            expiryDate: {
              type: "string",
              format: "date-time",
              example: "2027-08-27T00:00:00.000Z",
            },
          },
        },

        Employee: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "emp_123",
            },

            organizationId: {
              type: "string",
              example: "org_123",
            },

            employeeCode: {
              type: "string",
              example: "EMP-001",
            },

            firstName: {
              type: "string",
              example: "Ahmed",
            },

            lastName: {
              type: "string",
              example: "Khan",
            },

            email: {
              type: "string",
              format: "email",
              nullable: true,
              example: "ahmed.khan@example.com",
            },

            phone: {
              type: "string",
              nullable: true,
              example: "+923001234567",
            },

            cnic: {
              type: "string",
              nullable: true,
              example: "35202-1234567-1",
            },

            dateOfBirth: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "1995-05-15T00:00:00.000Z",
            },

            joiningDate: {
              type: "string",
              format: "date-time",
              example: "2026-08-01T00:00:00.000Z",
            },

            department: {
              type: "string",
              nullable: true,
              example: "Finance",
            },

            designation: {
              type: "string",
              nullable: true,
              example: "Accountant",
            },

            employmentType: {
              type: "string",
              enum: [
                "FULL_TIME",
                "PART_TIME",
                "CONTRACT",
                "DAILY_WAGE",
              ],
              example: "FULL_TIME",
            },

            baseSalary: {
              type: "number",
              format: "double",
              example: 75000,
            },

            allowances: {
              type: "number",
              format: "double",
              example: 10000,
            },

            deductions: {
              type: "number",
              format: "double",
              example: 5000,
            },

            bankName: {
              type: "string",
              nullable: true,
              example: "Meezan Bank",
            },

            bankAccount: {
              type: "string",
              nullable: true,
              example: "PK12MEZN0000001234567890",
            },

            address: {
              type: "string",
              nullable: true,
              example: "Gulberg, Lahore",
            },

            emergencyName: {
              type: "string",
              nullable: true,
              example: "Ali Khan",
            },

            emergencyPhone: {
              type: "string",
              nullable: true,
              example: "+923111234567",
            },

            status: {
              type: "string",
              example: "ACTIVE",
            },

            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T10:30:00.000Z",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T10:30:00.000Z",
            },
          },
        },

        CreateEmployeeRequest: {
          type: "object",

          required: [
            "employeeCode",
            "firstName",
            "lastName",
            "joiningDate",
            "employmentType",
            "baseSalary",
          ],

          properties: {
            employeeCode: {
              type: "string",
              minLength: 1,
              example: "EMP-001",
            },

            firstName: {
              type: "string",
              minLength: 1,
              example: "Ahmed",
            },

            lastName: {
              type: "string",
              minLength: 1,
              example: "Khan",
            },

            email: {
              type: "string",
              format: "email",
              example: "ahmed.khan@example.com",
            },

            phone: {
              type: "string",
              example: "+923001234567",
            },

            cnic: {
              type: "string",
              example: "35202-1234567-1",
            },

            dateOfBirth: {
              type: "string",
              format: "date-time",
              example: "1995-05-15T00:00:00.000Z",
            },

            joiningDate: {
              type: "string",
              format: "date-time",
              example: "2026-08-01T00:00:00.000Z",
            },

            department: {
              type: "string",
              example: "Finance",
            },

            designation: {
              type: "string",
              example: "Accountant",
            },

            employmentType: {
              type: "string",
              enum: [
                "FULL_TIME",
                "PART_TIME",
                "CONTRACT",
                "DAILY_WAGE",
              ],
              default: "FULL_TIME",
              example: "FULL_TIME",
            },

            baseSalary: {
              type: "number",
              format: "double",
              exclusiveMinimum: 0,
              example: 75000,
            },

            allowances: {
              type: "number",
              format: "double",
              minimum: 0,
              default: 0,
              example: 10000,
            },

            deductions: {
              type: "number",
              format: "double",
              minimum: 0,
              default: 0,
              example: 5000,
            },

            bankName: {
              type: "string",
              example: "Meezan Bank",
            },

            bankAccount: {
              type: "string",
              example: "PK12MEZN0000001234567890",
            },

            address: {
              type: "string",
              example: "Gulberg, Lahore",
            },

            emergencyName: {
              type: "string",
              example: "Ali Khan",
            },

            emergencyPhone: {
              type: "string",
              example: "+923111234567",
            },
          },
        },

        Attendance: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "attendance_123",
            },

            employeeId: {
              type: "string",
              example: "emp_123",
            },

            date: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T00:00:00.000Z",
            },

            checkIn: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2026-08-27T09:00:00.000Z",
            },

            checkOut: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: "2026-08-27T17:30:00.000Z",
            },

            status: {
              type: "string",
              enum: [
                "PRESENT",
                "ABSENT",
                "HALF_DAY",
                "LEAVE",
                "HOLIDAY",
              ],
              example: "PRESENT",
            },

            hoursWorked: {
              type: "number",
              format: "double",
              nullable: true,
              example: 8.5,
            },

            overtime: {
              type: "number",
              format: "double",
              nullable: true,
              example: 1.5,
            },

            latitude: {
              type: "number",
              format: "double",
              nullable: true,
              example: 30.0444,
            },

            longitude: {
              type: "number",
              format: "double",
              nullable: true,
              example: 31.2357,
            },

            notes: {
              type: "string",
              nullable: true,
              example: "Employee arrived late due to traffic.",
            },

            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T09:00:00.000Z",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T17:30:00.000Z",
            },
          },
        },

        CreateAttendanceRequest: {
          type: "object",

          required: [
            "date",
          ],

          properties: {
            date: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T00:00:00.000Z",
            },

            checkIn: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T09:00:00.000Z",
            },

            checkOut: {
              type: "string",
              format: "date-time",
              example: "2026-08-27T17:30:00.000Z",
            },

            status: {
              type: "string",
              enum: [
                "PRESENT",
                "ABSENT",
                "HALF_DAY",
                "LEAVE",
                "HOLIDAY",
              ],
              default: "PRESENT",
              example: "PRESENT",
            },

            hoursWorked: {
              type: "number",
              format: "double",
              minimum: 0,
              example: 8.5,
            },

            overtime: {
              type: "number",
              format: "double",
              minimum: 0,
              example: 1.5,
            },

            latitude: {
              type: "number",
              format: "double",
              example: 30.0444,
            },

            longitude: {
              type: "number",
              format: "double",
              example: 31.2357,
            },

            notes: {
              type: "string",
              example: "Employee arrived late due to traffic.",
            },
          },
        },
      },
    },
  },

  apis: [
    "./src/app/api/**/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);