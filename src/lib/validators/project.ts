import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  type: z.enum([
    "HOUSING_SOCIETY",
    "APARTMENT_BUILDING",
    "COMMERCIAL_PLAZA",
    "MIXED_USE",
    "VILLA_COMMUNITY",
    "FARMHOUSE",
  ]),
  description: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("PK"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  totalArea: z.number().positive().optional(),
  areaUnit: z.enum(["marla", "kanal", "sqft", "sqm"]).default("marla"),
  totalPlots: z.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  expectedCompletion: z.string().datetime().optional(),
  totalBudget: z.number().positive().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
