# Real Estate Builder ERP - API Documentation

**Base URL:** `http://localhost:3000/api`  
**Auth:** All endpoints (except `/api/auth`) require JWT authentication via NextAuth session.

---

## Setup Instructions

```bash
# 1. Clone repo
git clone https://github.com/faizanakram2/real-estate-erp.git
cd real-estate-erp

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string

# 4. Push database schema
npm run db:push

# 5. Generate Prisma client
npm run db:generate

# 6. Seed sample data
npm run db:seed

# 7. Start dev server
npm run dev
```

### Demo Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@devlayers.org | admin123 |
| Manager | manager@devlayers.org | manager123 |
| Sales Agent | sales@devlayers.org | sales123 |
| Accountant | accounts@devlayers.org | accounts123 |
| Site Engineer | engineer@devlayers.org | engineer123 |

---

## Authentication

### Login
```
POST /api/auth/callback/credentials
Content-Type: application/json

{
  "email": "admin@devlayers.org",
  "password": "admin123"
}
```

For frontend, use NextAuth's `signIn()` function:
```typescript
import { signIn } from "next-auth/react";

await signIn("credentials", {
  email: "admin@devlayers.org",
  password: "admin123",
  redirect: false,
});
```

### Get Session
```typescript
import { useSession } from "next-auth/react";

const { data: session } = useSession();
// session.user => { id, email, name, role, organizationId, organizationName }
```

### Wrap App with Provider
```tsx
// app/providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

---

## Common Response Formats

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response
```json
{
  "error": "Validation failed",
  "details": { "fieldErrors": {...}, "formErrors": [...] }
}
```

### Query Parameters (all list endpoints)
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `search` | string | Search term |
| `sortBy` | string | Sort field (default: createdAt) |
| `sortOrder` | asc/desc | Sort direction (default: desc) |

---

## API Endpoints

### 1. Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Get dashboard stats, recent payments, overdue installments |

**Response includes:** project count, customer count, plot stats by status, booking stats, monthly collections, recent payments, overdue installments list.

---

### 2. Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (filter: `status`, `type`) |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project details with blocks, plots, phases |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project (fails if plots exist) |

**POST body:**
```json
{
  "name": "Green Valley Society",
  "type": "HOUSING_SOCIETY",
  "city": "Lahore",
  "state": "Punjab",
  "totalArea": 500,
  "areaUnit": "kanal",
  "totalPlots": 200,
  "startDate": "2026-01-15T00:00:00.000Z",
  "totalBudget": 500000000
}
```
**Types:** `HOUSING_SOCIETY`, `APARTMENT_BUILDING`, `COMMERCIAL_PLAZA`, `MIXED_USE`, `VILLA_COMMUNITY`, `FARMHOUSE`

---

### 3. Blocks (under Projects)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/blocks` | List blocks with plot stats |
| POST | `/api/projects/:projectId/blocks` | Create block |

**POST body:**
```json
{ "name": "Block A", "description": "5 Marla residential plots" }
```

---

### 4. Plots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plots` | List plots (filter: `projectId`, `blockId`, `status`, `type`) |
| POST | `/api/plots` | Create single plot |
| POST | `/api/plots` | Bulk create plots (set `bulk: true`) |
| GET | `/api/plots/:id` | Get plot with bookings, images |
| PATCH | `/api/plots/:id` | Update plot |

**Single create body:**
```json
{
  "projectId": "...",
  "blockId": "...",
  "plotNumber": "A-1",
  "type": "RESIDENTIAL",
  "size": 5,
  "sizeUnit": "marla",
  "basePrice": 2500000,
  "premiumAmount": 500000,
  "totalPrice": 3000000,
  "facingDirection": "Corner"
}
```

**Bulk create body:**
```json
{
  "bulk": true,
  "projectId": "...",
  "blockId": "...",
  "plotPrefix": "A",
  "startNumber": 1,
  "count": 40,
  "type": "RESIDENTIAL",
  "size": 5,
  "sizeUnit": "marla",
  "basePrice": 2500000
}
```

**Plot types:** `RESIDENTIAL`, `COMMERCIAL`, `INDUSTRIAL`, `FARMHOUSE`, `APARTMENT`, `SHOP`, `OFFICE`, `PENTHOUSE`  
**Statuses:** `AVAILABLE`, `BOOKED`, `SOLD`, `TRANSFERRED`, `CANCELLED`, `ON_HOLD`, `RESERVED`

---

### 5. Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (filter: `status`) |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/:id` | Get customer with bookings, payments, documents |
| PATCH | `/api/customers/:id` | Update customer |

**POST body:**
```json
{
  "firstName": "Muhammad",
  "lastName": "Ali",
  "phone": "+92-321-1234567",
  "cnic": "35201-1234567-1",
  "fatherName": "Ahmed Ali",
  "city": "Lahore",
  "occupation": "Business",
  "monthlyIncome": 250000,
  "source": "walk-in"
}
```

---

### 6. Bookings (Sales)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List bookings (filter: `status`, `projectId`, `customerId`) |
| POST | `/api/bookings` | Create booking (auto-generates installments) |
| GET | `/api/bookings/:id` | Get booking with installments, payments, summary |
| PUT | `/api/bookings/:id` | Transfer booking to new customer |
| DELETE | `/api/bookings/:id` | Cancel booking (releases plot) |

**POST body (creates booking + installment schedule):**
```json
{
  "customerId": "...",
  "plotId": "...",
  "totalPrice": 3000000,
  "bookingAmount": 150000,
  "downPayment": 600000,
  "developmentCharges": 100000,
  "installmentPlanId": "...",
  "installmentMonths": 36
}
```

**Transfer (PUT) body:**
```json
{
  "newCustomerId": "...",
  "transferFee": 50000,
  "notes": "Customer requested transfer"
}
```

**Cancel (DELETE) body:**
```json
{
  "cancellationReason": "Customer request",
  "refundAmount": 500000,
  "deductionAmount": 50000
}
```

**Booking statuses:** `BOOKED`, `CONFIRMED`, `ACTIVE`, `POSSESSION_GIVEN`, `TRANSFERRED`, `CANCELLED`, `DEFAULTER`

---

### 7. Installment Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/installment-plans` | List active plans |
| POST | `/api/installment-plans` | Create plan |

**POST body:**
```json
{
  "name": "3 Year Standard Plan",
  "durationMonths": 36,
  "downPaymentPercent": 15,
  "frequency": "MONTHLY",
  "gracePeriodDays": 7,
  "latePenaltyPercent": 1.5
}
```

---

### 8. Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List payments (filter: `status`, `bookingId`, `customerId`) |
| POST | `/api/payments` | Record payment (auto-generates receipt number) |
| GET | `/api/payments/:id` | Get payment details |
| PATCH | `/api/payments/:id` | Verify/Confirm/Reject payment |

**POST body:**
```json
{
  "customerId": "...",
  "bookingId": "...",
  "installmentId": "...",
  "amount": 100000,
  "paymentMethod": "BANK_TRANSFER",
  "paymentDate": "2026-04-10T00:00:00.000Z",
  "referenceNumber": "TXN-123456",
  "bankName": "HBL"
}
```

**Verify (PATCH) body:**
```json
{ "status": "CONFIRMED" }
// or
{ "status": "REJECTED", "rejectionReason": "Invalid reference number" }
```

**Payment methods:** `CASH`, `BANK_TRANSFER`, `CHEQUE`, `JAZZCASH`, `EASYPAISA`, `ONLINE`, `DEMAND_DRAFT`, `PAY_ORDER`  
**Workflow:** `PENDING` → `VERIFIED` → `CONFIRMED` (or `REJECTED`)

---

### 9. Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List vendors (filter: `category`) |
| POST | `/api/vendors` | Create vendor |
| GET | `/api/vendors/:id` | Get vendor with maintenance requests, transactions |
| PATCH | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Deactivate vendor (soft delete) |

---

### 10. Employees / HR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List employees (filter: `department`, `status`) |
| POST | `/api/employees` | Create employee |
| GET | `/api/employees/:id` | Get employee with attendance, payroll |
| PATCH | `/api/employees/:id` | Update employee |
| GET | `/api/employees/:id/attendance` | Get attendance (filter: `month`, `year`) |
| POST | `/api/employees/:id/attendance` | Record attendance |
| GET | `/api/employees/:id/payroll` | Get payroll history |
| POST | `/api/employees/:id/payroll` | Generate monthly payroll |

---

### 11. Construction Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:projectId/construction-phases` | List phases |
| POST | `/api/projects/:projectId/construction-phases` | Create phase |
| GET | `/api/construction-phases/:id` | Get phase with updates, materials |
| PATCH | `/api/construction-phases/:id` | Update phase (progress, status) |
| POST | `/api/construction-phases/:id/updates` | Post progress update with images |
| GET | `/api/construction-phases/:id/material-requisitions` | List requisitions |
| POST | `/api/construction-phases/:id/material-requisitions` | Create requisition |

---

### 12. Maintenance Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/maintenance-requests` | List requests (filter: `status`, `priority`) |
| POST | `/api/maintenance-requests` | Create request |
| GET | `/api/maintenance-requests/:id` | Get request with images, comments |
| PATCH | `/api/maintenance-requests/:id` | Update (assign, change status) |
| POST | `/api/maintenance-requests/:id/comments` | Add comment |

---

### 13. Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List docs (filter: `type`, `projectId`, `customerId`, `bookingId`) |
| POST | `/api/documents` | Create document record |
| GET | `/api/documents/:id` | Get document |
| DELETE | `/api/documents/:id` | Delete document |

---

### 14. File Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (multipart/form-data) |

```typescript
const formData = new FormData();
formData.append("file", selectedFile);

const res = await fetch("/api/upload", { method: "POST", body: formData });
const { fileUrl, fileName, fileSize, mimeType } = await res.json();
```
**Limits:** 10MB max. Allowed types: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX.

---

### 15. Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications (filter: `unreadOnly=true`) |
| PATCH | `/api/notifications` | Mark all as read |
| PATCH | `/api/notifications/:id` | Mark single as read |
| DELETE | `/api/notifications/:id` | Delete notification |

---

### 16. Notification Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notification-templates` | List templates |
| POST | `/api/notification-templates` | Create template |

---

### 17. Ledger / Accounting
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ledger-accounts` | List accounts (filter: `type`) |
| POST | `/api/ledger-accounts` | Create account |
| GET | `/api/transactions` | List transactions (filter: `type`, `category`, `startDate`, `endDate`) |
| POST | `/api/transactions` | Create transaction |

---

### 18. User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (Admin/Manager only, filter: `role`) |
| POST | `/api/users` | Create user (Admin only) |

---

### 19. Audit Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs` | View logs (Admin only, filter: `entity`, `userId`, `action`) |

---

## User Roles & Permissions

| Role | Access Level |
|------|-------------|
| `SUPER_ADMIN` | Full system access |
| `ADMIN` | Organization admin - manage users, settings, all modules |
| `MANAGER` | Manage projects, bookings, customers, reports |
| `SALES_AGENT` | Create bookings, manage customers, view plots |
| `ACCOUNTANT` | Payments, ledger, transactions, payroll |
| `SITE_ENGINEER` | Construction updates, material requisitions, attendance |
| `STAFF` | Basic read access |
| `CUSTOMER` | Customer portal (own bookings, payments, documents) |

---

## Frontend Integration Tips

1. **Use `fetch` or `axios`** - NextAuth session cookie is sent automatically
2. **Wrap pages in `<SessionProvider>`** for `useSession()` hook
3. **Check `session.user.role`** to show/hide UI elements per role
4. **All list APIs support pagination** - pass `?page=1&limit=20&search=query`
5. **File upload** - use `FormData` with `POST /api/upload`, then save returned `fileUrl` in document/payment records
6. **Payment workflow** - Create (PENDING) → Admin verifies (VERIFIED/CONFIRMED/REJECTED)
7. **Booking creates installments automatically** - just pass `installmentMonths` and `installmentPlanId`
