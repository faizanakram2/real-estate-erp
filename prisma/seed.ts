import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // ═══════════════════════════════════
  // 1. Organization
  // ═══════════════════════════════════
  const org = await prisma.organization.upsert({
    where: { slug: "devlayers-builders" },
    update: {},
    create: {
      name: "Devlayers Builders & Developers",
      slug: "devlayers-builders",
      phone: "+92-300-1234567",
      email: "info@devlayers.org",
      website: "https://devlayers.org",
      addressLine1: "45-A, Main Boulevard, Gulberg III",
      city: "Lahore",
      state: "Punjab",
      country: "PK",
      postalCode: "54000",
      taxId: "1234567-8",
      subscriptionPlan: "PROFESSIONAL",
      smsQuota: 500,
      storageQuotaMb: 10240,
    },
  });
  console.log(`Organization: ${org.name}`);

  // Bank accounts
  await prisma.organizationBankAccount.createMany({
    data: [
      {
        organizationId: org.id,
        bankName: "HBL",
        accountTitle: "Devlayers Builders Pvt Ltd",
        accountNumber: "1234-5678-9012-3456",
        iban: "PK36HABB0012345678901234",
        accountType: "current",
      },
      {
        organizationId: org.id,
        bankName: "JazzCash",
        accountTitle: "Devlayers Builders",
        accountNumber: "0300-1234567",
        accountType: "jazzcash",
      },
    ],
    skipDuplicates: true,
  });

  // ═══════════════════════════════════
  // 2. Users
  // ═══════════════════════════════════
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@devlayers.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@devlayers.org",
      name: "Ahmed Khan",
      passwordHash,
      phone: "+92-300-1234567",
      role: "ADMIN",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@devlayers.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "manager@devlayers.org",
      name: "Fatima Zahra",
      passwordHash: await bcrypt.hash("manager123", 12),
      phone: "+92-301-2345678",
      role: "MANAGER",
    },
  });

  const salesAgent = await prisma.user.upsert({
    where: { email: "sales@devlayers.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "sales@devlayers.org",
      name: "Ali Raza",
      passwordHash: await bcrypt.hash("sales123", 12),
      phone: "+92-302-3456789",
      role: "SALES_AGENT",
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "accounts@devlayers.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "accounts@devlayers.org",
      name: "Hassan Ali",
      passwordHash: await bcrypt.hash("accounts123", 12),
      phone: "+92-303-4567890",
      role: "ACCOUNTANT",
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: "engineer@devlayers.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "engineer@devlayers.org",
      name: "Usman Tariq",
      passwordHash: await bcrypt.hash("engineer123", 12),
      phone: "+92-304-5678901",
      role: "SITE_ENGINEER",
    },
  });

  console.log("Users created: admin, manager, sales, accountant, engineer");

  // ═══════════════════════════════════
  // 3. Projects
  // ═══════════════════════════════════
  const project1 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: "Green Valley Housing Society",
      slug: "green-valley",
      description:
        "Premium housing society with modern amenities, parks, and commercial areas. Located near the main GT Road with easy access to the motorway.",
      type: "HOUSING_SOCIETY",
      status: "IN_DEVELOPMENT",
      addressLine1: "GT Road, Near Kala Shah Kaku",
      city: "Lahore",
      state: "Punjab",
      country: "PK",
      latitude: 31.7,
      longitude: 74.25,
      totalArea: 500,
      areaUnit: "kanal",
      totalPlots: 200,
      startDate: new Date("2025-01-15"),
      expectedCompletion: new Date("2028-06-30"),
      totalBudget: 500000000,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: "City Center Commercial Plaza",
      slug: "city-center-plaza",
      description:
        "Modern commercial plaza in the heart of the city with shops, offices, and food court.",
      type: "COMMERCIAL_PLAZA",
      status: "PLANNING",
      addressLine1: "Mall Road, Liberty Chowk",
      city: "Lahore",
      state: "Punjab",
      country: "PK",
      totalArea: 2,
      areaUnit: "kanal",
      totalPlots: 50,
      startDate: new Date("2026-03-01"),
      totalBudget: 200000000,
    },
  });

  console.log(`Projects: ${project1.name}, ${project2.name}`);

  // ═══════════════════════════════════
  // 4. Blocks
  // ═══════════════════════════════════
  const blockA = await prisma.block.create({
    data: { projectId: project1.id, name: "Block A" },
  });
  const blockB = await prisma.block.create({
    data: { projectId: project1.id, name: "Block B" },
  });
  const blockC = await prisma.block.create({
    data: { projectId: project1.id, name: "Block C - Commercial" },
  });

  // ═══════════════════════════════════
  // 5. Plots
  // ═══════════════════════════════════
  const plots: any[] = [];

  // Block A - 5 Marla Residential (40 plots)
  for (let i = 1; i <= 40; i++) {
    const isCorner = i % 10 === 1 || i % 10 === 0;
    const basePrice = 2500000;
    const premium = isCorner ? 500000 : 0;
    plots.push({
      projectId: project1.id,
      blockId: blockA.id,
      plotNumber: `A-${i}`,
      type: "RESIDENTIAL",
      size: 5,
      sizeUnit: "marla",
      street: `Street ${Math.ceil(i / 10)}`,
      facingDirection: isCorner ? "Corner" : i % 2 === 0 ? "East" : "West",
      basePrice,
      premiumAmount: premium,
      totalPrice: basePrice + premium,
      pricePerUnit: (basePrice + premium) / 5,
      status: i <= 25 ? "BOOKED" : i <= 30 ? "SOLD" : "AVAILABLE",
    });
  }

  // Block B - 10 Marla Residential (30 plots)
  for (let i = 1; i <= 30; i++) {
    const isCorner = i % 10 === 1 || i % 10 === 0;
    const basePrice = 5500000;
    const premium = isCorner ? 1000000 : 0;
    plots.push({
      projectId: project1.id,
      blockId: blockB.id,
      plotNumber: `B-${i}`,
      type: "RESIDENTIAL",
      size: 10,
      sizeUnit: "marla",
      street: `Street ${Math.ceil(i / 10)}`,
      facingDirection: isCorner ? "Corner" : i % 2 === 0 ? "North" : "South",
      basePrice,
      premiumAmount: premium,
      totalPrice: basePrice + premium,
      pricePerUnit: (basePrice + premium) / 10,
      status: i <= 15 ? "BOOKED" : i <= 20 ? "SOLD" : "AVAILABLE",
    });
  }

  // Block C - Commercial (20 plots)
  for (let i = 1; i <= 20; i++) {
    const basePrice = 8000000;
    plots.push({
      projectId: project1.id,
      blockId: blockC.id,
      plotNumber: `C-${i}`,
      type: "COMMERCIAL",
      size: 4,
      sizeUnit: "marla",
      street: "Main Boulevard",
      basePrice,
      premiumAmount: 0,
      totalPrice: basePrice,
      pricePerUnit: basePrice / 4,
      status: i <= 8 ? "BOOKED" : i <= 12 ? "SOLD" : "AVAILABLE",
    });
  }

  await prisma.plot.createMany({ data: plots });
  console.log(`Plots: ${plots.length} created across 3 blocks`);

  // ═══════════════════════════════════
  // 6. Installment Plans
  // ═══════════════════════════════════
  const plan1Y = await prisma.installmentPlan.create({
    data: {
      name: "1 Year Easy Plan",
      description: "12 monthly installments with 20% down payment",
      durationMonths: 12,
      downPaymentPercent: 20,
      frequency: "MONTHLY",
      gracePeriodDays: 7,
      latePenaltyPercent: 2,
    },
  });

  const plan3Y = await prisma.installmentPlan.create({
    data: {
      name: "3 Year Standard Plan",
      description: "36 monthly installments with 15% down payment",
      durationMonths: 36,
      downPaymentPercent: 15,
      frequency: "MONTHLY",
      gracePeriodDays: 7,
      latePenaltyPercent: 1.5,
    },
  });

  const plan5Y = await prisma.installmentPlan.create({
    data: {
      name: "5 Year Extended Plan",
      description: "60 monthly installments with 10% down payment",
      durationMonths: 60,
      downPaymentPercent: 10,
      frequency: "MONTHLY",
      gracePeriodDays: 10,
      latePenaltyPercent: 1,
    },
  });

  console.log("Installment plans: 1Y, 3Y, 5Y");

  // ═══════════════════════════════════
  // 7. Customers
  // ═══════════════════════════════════
  const customerData = [
    { firstName: "Muhammad", lastName: "Imran", phone: "+92-321-1111111", cnic: "35201-1234567-1", city: "Lahore", occupation: "Business" },
    { firstName: "Ayesha", lastName: "Siddiqui", phone: "+92-322-2222222", cnic: "35201-2345678-2", city: "Lahore", occupation: "Doctor" },
    { firstName: "Bilal", lastName: "Ahmed", phone: "+92-323-3333333", cnic: "35201-3456789-3", city: "Islamabad", occupation: "Engineer" },
    { firstName: "Sana", lastName: "Malik", phone: "+92-324-4444444", cnic: "35201-4567890-4", city: "Karachi", occupation: "Lawyer" },
    { firstName: "Usman", lastName: "Shah", phone: "+92-325-5555555", cnic: "35201-5678901-5", city: "Lahore", occupation: "Businessman" },
    { firstName: "Hira", lastName: "Farooq", phone: "+92-326-6666666", cnic: "35201-6789012-6", city: "Faisalabad", occupation: "Teacher" },
    { firstName: "Zain", lastName: "Abbas", phone: "+92-327-7777777", cnic: "35201-7890123-7", city: "Multan", occupation: "IT Professional" },
    { firstName: "Mariam", lastName: "Khan", phone: "+92-328-8888888", cnic: "35201-8901234-8", city: "Lahore", occupation: "Banker" },
  ];

  const customers = [];
  for (const c of customerData) {
    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        ...c,
        country: "PK",
        source: "walk-in",
        monthlyIncome: 100000 + Math.floor(Math.random() * 400000),
      },
    });
    customers.push(customer);
  }
  console.log(`Customers: ${customers.length} created`);

  // ═══════════════════════════════════
  // 8. Sample Bookings with Installments
  // ═══════════════════════════════════
  const allPlots = await prisma.plot.findMany({
    where: { projectId: project1.id, status: "BOOKED" },
    take: 5,
  });

  for (let i = 0; i < Math.min(5, allPlots.length, customers.length); i++) {
    const plot = allPlots[i];
    const customer = customers[i];
    const plan = i % 2 === 0 ? plan3Y : plan1Y;
    const totalPrice = Number(plot.totalPrice);
    const bookingAmount = totalPrice * 0.05;
    const downPayment = totalPrice * (plan.downPaymentPercent / 100);
    const netAmount = totalPrice;
    const installableAmount = netAmount - bookingAmount - downPayment;
    const monthlyInstallment = installableAmount / plan.durationMonths;

    const bookingNumber = `BK-2026-${String(i + 1).padStart(4, "0")}`;

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        customerId: customer.id,
        plotId: plot.id,
        createdById: salesAgent.id,
        status: "ACTIVE",
        totalPrice,
        bookingAmount,
        downPayment,
        netAmount,
        installmentPlanId: plan.id,
        installmentMonths: plan.durationMonths,
        monthlyInstallment,
      },
    });

    // Generate installment schedule
    const installments = [];

    // Booking amount (already paid)
    installments.push({
      bookingId: booking.id,
      installmentNo: 0,
      type: "BOOKING" as const,
      amount: bookingAmount,
      dueDate: new Date("2026-01-15"),
      status: "PAID" as const,
      paidAmount: bookingAmount,
      paidDate: new Date("2026-01-15"),
      balanceAmount: 0,
    });

    // Down payment
    installments.push({
      bookingId: booking.id,
      installmentNo: 1,
      type: "DOWN_PAYMENT" as const,
      amount: downPayment,
      dueDate: new Date("2026-02-15"),
      status: i < 3 ? ("PAID" as const) : ("PENDING" as const),
      paidAmount: i < 3 ? downPayment : 0,
      paidDate: i < 3 ? new Date("2026-02-10") : undefined,
      balanceAmount: i < 3 ? 0 : downPayment,
    });

    // Monthly installments
    for (let m = 0; m < plan.durationMonths; m++) {
      const dueDate = new Date("2026-03-01");
      dueDate.setMonth(dueDate.getMonth() + m);

      const isPast = dueDate < new Date();
      const isPaid = isPast && m < 2; // first 2 months paid

      installments.push({
        bookingId: booking.id,
        installmentNo: m + 2,
        type: "MONTHLY" as const,
        amount: monthlyInstallment,
        dueDate,
        status: isPaid
          ? ("PAID" as const)
          : isPast
            ? ("OVERDUE" as const)
            : ("PENDING" as const),
        paidAmount: isPaid ? monthlyInstallment : 0,
        paidDate: isPaid ? dueDate : undefined,
        balanceAmount: isPaid ? 0 : monthlyInstallment,
      });
    }

    await prisma.installment.createMany({ data: installments });

    // Create payment records for paid installments
    const paidInstallments = installments.filter((i) => i.status === "PAID");
    let receiptIdx = 1;
    for (const inst of paidInstallments) {
      await prisma.paymentRecord.create({
        data: {
          receiptNumber: `REC-2026-${String((i + 1) * 100 + receiptIdx).padStart(5, "0")}`,
          customerId: customer.id,
          bookingId: booking.id,
          amount: inst.amount,
          paymentMethod: receiptIdx % 2 === 0 ? "BANK_TRANSFER" : "CASH",
          status: "CONFIRMED",
          paymentDate: inst.paidDate!,
          verifiedById: accountant.id,
          verifiedAt: inst.paidDate!,
        },
      });
      receiptIdx++;
    }
  }
  console.log("Bookings: 5 created with installment schedules and payments");

  // ═══════════════════════════════════
  // 9. Construction Phases
  // ═══════════════════════════════════
  const phases = [
    { name: "Land Clearing & Leveling", sortOrder: 1, progress: 100, status: "COMPLETED" as const },
    { name: "Road Network & Infrastructure", sortOrder: 2, progress: 75, status: "IN_PROGRESS" as const },
    { name: "Underground Utilities (Water, Gas, Sewerage)", sortOrder: 3, progress: 40, status: "IN_PROGRESS" as const },
    { name: "Electrical Grid & Street Lights", sortOrder: 4, progress: 10, status: "IN_PROGRESS" as const },
    { name: "Boundary Wall & Main Gate", sortOrder: 5, progress: 0, status: "NOT_STARTED" as const },
    { name: "Parks & Green Areas", sortOrder: 6, progress: 0, status: "NOT_STARTED" as const },
    { name: "Commercial Area Development", sortOrder: 7, progress: 0, status: "NOT_STARTED" as const },
  ];

  for (const phase of phases) {
    await prisma.constructionPhase.create({
      data: {
        projectId: project1.id,
        ...phase,
        budget: 10000000 + Math.floor(Math.random() * 40000000),
        actualCost:
          phase.progress > 0
            ? 5000000 + Math.floor(Math.random() * 20000000)
            : undefined,
      },
    });
  }
  console.log("Construction phases: 7 created");

  // ═══════════════════════════════════
  // 10. Vendors
  // ═══════════════════════════════════
  const vendors = [
    { companyName: "Punjab Builders", contactName: "Khalid Mehmood", category: "construction", phone: "+92-311-1111111" },
    { companyName: "Elite Electricals", contactName: "Naveed Akhtar", category: "electrical", phone: "+92-312-2222222" },
    { companyName: "AquaFlow Plumbing", contactName: "Sajid Ali", category: "plumbing", phone: "+92-313-3333333" },
    { companyName: "Green Landscapes", contactName: "Tariq Mahmood", category: "landscaping", phone: "+92-314-4444444" },
    { companyName: "Star Cement Supplier", contactName: "Asif Raza", category: "material_supplier", phone: "+92-315-5555555" },
  ];

  for (const v of vendors) {
    await prisma.vendor.create({
      data: {
        organizationId: org.id,
        ...v,
        city: "Lahore",
        state: "Punjab",
        rating: 3.5 + Math.random() * 1.5,
      },
    });
  }
  console.log(`Vendors: ${vendors.length} created`);

  // ═══════════════════════════════════
  // 11. Notification Templates
  // ═══════════════════════════════════
  await prisma.notificationTemplate.createMany({
    data: [
      {
        organizationId: org.id,
        name: "payment_reminder_7days",
        channel: "SMS",
        body: "Dear {{customerName}}, your installment of PKR {{amount}} for {{plotNumber}} is due on {{dueDate}}. Please ensure timely payment. - {{orgName}}",
      },
      {
        organizationId: org.id,
        name: "payment_reminder_3days",
        channel: "SMS",
        body: "Reminder: PKR {{amount}} installment for {{plotNumber}} is due in 3 days ({{dueDate}}). Pay now to avoid late charges. - {{orgName}}",
      },
      {
        organizationId: org.id,
        name: "payment_overdue",
        channel: "SMS",
        body: "OVERDUE: Your installment of PKR {{amount}} for {{plotNumber}} was due on {{dueDate}}. Late penalty of {{penaltyPercent}}% applies. Please pay immediately. - {{orgName}}",
      },
      {
        organizationId: org.id,
        name: "payment_confirmed",
        channel: "SMS",
        body: "Payment Confirmed: PKR {{amount}} received for {{plotNumber}} (Receipt: {{receiptNumber}}). Thank you! - {{orgName}}",
      },
      {
        organizationId: org.id,
        name: "booking_confirmed",
        channel: "EMAIL",
        subject: "Booking Confirmation - {{plotNumber}}",
        body: "Dear {{customerName}},\n\nYour booking for {{plotNumber}} in {{projectName}} has been confirmed.\n\nBooking Number: {{bookingNumber}}\nTotal Amount: PKR {{totalAmount}}\nDown Payment: PKR {{downPayment}}\nMonthly Installment: PKR {{monthlyInstallment}}\n\nThank you for choosing {{orgName}}.",
      },
    ],
    skipDuplicates: true,
  });
  console.log("Notification templates: 5 created");

  // ═══════════════════════════════════
  // Done
  // ═══════════════════════════════════
  console.log("\n========================================");
  console.log("  Seeding completed successfully!");
  console.log("========================================\n");
  console.log("Login credentials:");
  console.log("  Admin:      admin@devlayers.org / admin123");
  console.log("  Manager:    manager@devlayers.org / manager123");
  console.log("  Sales:      sales@devlayers.org / sales123");
  console.log("  Accountant: accounts@devlayers.org / accounts123");
  console.log("  Engineer:   engineer@devlayers.org / engineer123");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
