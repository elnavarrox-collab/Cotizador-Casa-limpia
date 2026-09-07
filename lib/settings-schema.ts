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
  // Zero is allowed while a plan is being configured. The quotes endpoint
  // rejects using that plan until real monthly hours have been supplied.
  hours: nonNegativeHours,
  features: z.array(z.string().trim().min(1).max(240)).max(40),
});

export const settingsSchema = z.object({
  commercial: z.object({
    packages: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(100), sqm: z.number().positive(), bedrooms: z.number().int().min(0), bathrooms: z.number().int().min(0), general: nonNegativeMoney, deep: nonNegativeMoney, delivery: nonNegativeMoney.nullable() })).length(5),
    costsConfirmed: z.boolean(), targetTakeHome: nonNegativeMoney, parkingCost: nonNegativeMoney, otherCost: nonNegativeMoney, maxPropertiesPerDay: z.literal(2),
  }).optional(),
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
}).superRefine((settings, context) => {
  if (settings.schemaVersion >= 4 && !settings.commercial) context.addIssue({ code: "custom", path: ["commercial"], message: "La configuración v4 requiere paquetes y objetivos comerciales" });
  if (settings.commercial && new Set(settings.commercial.packages.map(p => p.id)).size !== 5) context.addIssue({ code: "custom", path: ["commercial", "packages"], message: "Los paquetes deben tener identificadores únicos" });
  const duplicateAddonIds = settings.addons.filter((addon, index, all) => all.findIndex((candidate) => candidate.id === addon.id) !== index);
  const duplicateMembershipIds = settings.memberships.filter((plan, index, all) => all.findIndex((candidate) => candidate.id === plan.id) !== index);
  if (duplicateAddonIds.length) context.addIssue({ code: "custom", path: ["addons"], message: "Los IDs de adicionales deben ser únicos" });
  if (duplicateMembershipIds.length) context.addIssue({ code: "custom", path: ["memberships"], message: "Los IDs de membresías deben ser únicos" });
});

export const settingsUpdateSchema = z.object({
  settings: settingsSchema,
  baseRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export type PricingSettings = z.infer<typeof settingsSchema>;

export function isMembershipOperational(plan: unknown): plan is z.infer<typeof membershipSchema> {
  const parsed = membershipSchema.safeParse(plan);
  return parsed.success && parsed.data.hours > 0 && parsed.data.visits > 0;
}
