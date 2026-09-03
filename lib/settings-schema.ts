import { z } from "zod";

const nonNegativeMoney = z.number().finite().min(0).max(100_000_000);
const nonNegativeHours = z.number().finite().min(0).max(1_000);
const percentage = z.number().finite().min(0).max(100);

export const addonSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(140),
  price: nonNegativeMoney,
  minutes: z.number().finite().min(0).max(10_000),
});

export const membershipSchema = z.object({
  id: z.string().trim().min(1).max(100),
  line: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  price: nonNegativeMoney,
  visits: z.number().int().min(1).max(100),
  hours: nonNegativeHours,
  features: z.array(z.string().trim().min(1).max(240)).max(40),
});

export const settingsSchema = z.object({
  schemaVersion: z.number().int().min(1).max(100),
  minimumPrice: nonNegativeMoney,
  propertyBase: z.object({ department: nonNegativeMoney, house: nonNegativeMoney, office: nonNegativeMoney }),
  includedSqm: z.object({ department: nonNegativeHours, house: nonNegativeHours, office: nonNegativeHours }),
  extraSqmPrice: nonNegativeMoney,
  extraBedroomPrice: nonNegativeMoney,
  extraBathroomPrice: nonNegativeMoney,
  conditionPct: z.object({ maintenance: percentage, normal: percentage, accumulated: percentage, deep: percentage }),
  frequencyDiscountPct: z.object({ one: percentage, four: percentage, eight: percentage, twelve: percentage }),
  urgencyPct: percentage,
  weekendPct: percentage,
  workers: z.number().int().min(1).max(20),
  workerHourlyCost: nonNegativeMoney,
  productivitySqmPerTeamHour: z.number().finite().positive().max(1_000),
  extraBedroomHours: nonNegativeHours,
  extraBathroomHours: nonNegativeHours,
  conditionExtraHours: z.object({ maintenance: nonNegativeHours, normal: nonNegativeHours, accumulated: nonNegativeHours, deep: nonNegativeHours }),
  minimumVisitHours: z.number().finite().positive().max(48),
  maxTeamHoursPerDay: z.number().finite().positive().max(24),
  suppliesBaseCost: nonNegativeMoney,
  suppliesCostPerSqm: nonNegativeMoney,
  transportCost: nonNegativeMoney,
  targetMarginPct: z.number().finite().min(0).max(95),
  defaultManualAdjustment: z.number().finite().min(-10_000_000).max(10_000_000),
  addons: z.array(addonSchema).max(200),
  memberships: z.array(membershipSchema).min(1).max(100),
});

export type PricingSettings = z.infer<typeof settingsSchema>;
