import { z } from "zod";

export const createBookingSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  plotId: z.string().min(1, "Plot is required"),
  totalPrice: z.number().positive("Total price must be positive"),
  bookingAmount: z.number().min(0).default(0),
  downPayment: z.number().min(0).default(0),
  developmentCharges: z.number().min(0).default(0),
  possessionCharges: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  installmentPlanId: z.string().optional(),
  installmentMonths: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

export const transferBookingSchema = z.object({
  newCustomerId: z.string().min(1, "New customer is required"),
  transferFee: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const cancelBookingSchema = z.object({
  cancellationReason: z.string().min(1, "Reason is required"),
  refundAmount: z.number().min(0).default(0),
  deductionAmount: z.number().min(0).default(0),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
