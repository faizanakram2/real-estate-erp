import { z } from "zod";

export const createPlotSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  blockId: z.string().optional(),
  plotNumber: z.string().min(1, "Plot number is required"),
  type: z.enum([
    "RESIDENTIAL",
    "COMMERCIAL",
    "INDUSTRIAL",
    "FARMHOUSE",
    "APARTMENT",
    "SHOP",
    "OFFICE",
    "PENTHOUSE",
  ]),
  size: z.number().positive("Size must be positive"),
  sizeUnit: z.enum(["marla", "kanal", "sqft", "sqm"]).default("marla"),
  frontLength: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  street: z.string().optional(),
  sector: z.string().optional(),
  facingDirection: z.string().optional(),
  basePrice: z.number().positive("Base price must be positive"),
  premiumAmount: z.number().min(0).default(0),
  totalPrice: z.number().positive("Total price must be positive"),
  pricePerUnit: z.number().positive().optional(),
  developmentCharges: z.number().min(0).optional(),
  assignedAgentId: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePlotSchema = createPlotSchema.partial();

export const bulkCreatePlotsSchema = z.object({
  projectId: z.string().min(1),
  blockId: z.string().optional(),
  plotPrefix: z.string().default(""),
  startNumber: z.number().int().min(1),
  count: z.number().int().min(1).max(500),
  type: z.enum([
    "RESIDENTIAL",
    "COMMERCIAL",
    "INDUSTRIAL",
    "FARMHOUSE",
    "APARTMENT",
    "SHOP",
    "OFFICE",
    "PENTHOUSE",
  ]),
  size: z.number().positive(),
  sizeUnit: z.enum(["marla", "kanal", "sqft", "sqm"]).default("marla"),
  basePrice: z.number().positive(),
});

export type CreatePlotInput = z.infer<typeof createPlotSchema>;
