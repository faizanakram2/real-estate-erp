import { z } from "zod";

export const createPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  bookingId: z.string().min(1, "Booking is required"),
  installmentId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CHEQUE",
    "JAZZCASH",
    "EASYPAISA",
    "ONLINE",
    "DEMAND_DRAFT",
    "PAY_ORDER",
  ]),
  paymentDate: z.string().datetime(),
  referenceNumber: z.string().optional(),
  bankName: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  status: z.enum(["VERIFIED", "CONFIRMED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
