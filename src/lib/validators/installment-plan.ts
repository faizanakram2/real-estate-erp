import { z } from "zod";

export const createInstallmentPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  durationMonths: z.number().int().min(1).max(240),
  downPaymentPercent: z.number().min(0).max(100),
  frequency: z
    .enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"])
    .default("MONTHLY"),
  gracePeriodDays: z.number().int().min(0).max(90).default(7),
  latePenaltyPercent: z.number().min(0).max(100).default(0),
});

export const updateInstallmentPlanSchema =
  createInstallmentPlanSchema.partial();

export const rescheduleInstallmentSchema = z.object({
  installmentId: z.string().min(1),
  newDueDate: z.string().datetime(),
  reason: z.string().optional(),
});

export const waivePenaltySchema = z.object({
  installmentId: z.string().min(1),
  waiveAmount: z.number().positive(),
  reason: z.string().min(1, "Reason is required"),
});

export type CreateInstallmentPlanInput = z.infer<
  typeof createInstallmentPlanSchema
>;
