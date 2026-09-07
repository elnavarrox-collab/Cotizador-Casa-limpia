import { z } from "zod";

export const serviceQuoteInputSchema = z.object({
  serviceType: z.enum(["general", "deep", "delivery"]).optional(),
  workers: z.number().int().min(1).max(2).optional(),
  addonQuantities: z.record(z.string().max(100), z.number().int().min(0).max(100)).optional(),
  mode: z.literal("service"),
  property: z.enum(["department", "house", "office"]),
  sqm: z.number().finite().min(1, "La superficie debe ser mayor que cero").max(10_000),
  bedrooms: z.number().int("Los dormitorios deben ser enteros").min(0).max(100),
  bathrooms: z.number().int("Los baños deben ser enteros").min(0).max(100),
  condition: z.enum(["maintenance", "normal", "accumulated", "deep"]),
  frequency: z.enum(["one", "four", "eight", "twelve"]),
  selectedAddonIds: z.array(z.string().trim().min(1).max(100)).max(200),
  urgent: z.boolean(),
  weekend: z.boolean(),
  flashDiscountPct: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)]),
  plannedDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  manualAdjustment: z.number().finite().min(-1_000_000).max(10_000_000),
});

export const membershipQuoteInputSchema = z.object({
  mode: z.literal("membership"),
  membershipId: z.string().trim().min(1).max(100),
  manualAdjustment: z.number().finite().min(-1_000_000).max(10_000_000),
});

export const quoteInputSchema = z.discriminatedUnion("mode", [serviceQuoteInputSchema, membershipQuoteInputSchema]);

const draftNumber = z.number().finite().nullable();
const serviceDraftInputSchema = z.object({
  serviceType: z.enum(["general", "deep", "delivery"]).optional(),
  workers: z.number().int().min(1).max(2).optional(),
  addonQuantities: z.record(z.string().max(100), z.number().int().min(0).max(100)).optional(),
  mode: z.literal("service"), property: z.enum(["department", "house", "office"]), sqm: draftNumber,
  bedrooms: draftNumber, bathrooms: draftNumber, condition: z.enum(["maintenance", "normal", "accumulated", "deep"]),
  frequency: z.enum(["one", "four", "eight", "twelve"]), selectedAddonIds: z.array(z.string().max(100)).max(200),
  urgent: z.boolean(), weekend: z.boolean(), flashDiscountPct: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)]),
  plannedDays: z.union([z.literal(0), z.literal(1), z.literal(2)]), manualAdjustment: draftNumber,
});
const membershipDraftInputSchema = z.object({ mode: z.literal("membership"), membershipId: z.string().min(1).max(100), manualAdjustment: draftNumber });
export const quoteDraftSchema = z.object({
  quoteName: z.string().max(140),
  client: z.string().max(140),
  commune: z.enum(["Las Condes", "Providencia"]),
  input: z.discriminatedUnion("mode", [serviceDraftInputSchema, membershipDraftInputSchema]),
});

export const createQuoteSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().max(140).default(""),
  client: z.string().trim().max(140).default(""),
  commune: z.enum(["Las Condes", "Providencia"]),
  mode: z.enum(["service", "membership"]),
  input: quoteInputSchema,
  summary: z.string().trim().min(1).max(8_000),
}).superRefine((quote, context) => {
  if (quote.mode !== quote.input.mode) {
    context.addIssue({ code: "custom", path: ["input", "mode"], message: "El modo no coincide con los datos de entrada" });
  }
});

export const renameQuoteSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Identificador inválido"),
  name: z.string().trim().min(1, "Escribe un nombre").max(140),
});

export const savedQuoteSchema = z.object({
  financialsPending: z.boolean().optional(),
  _id: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().trim().max(140).optional(),
  client: z.string().trim().max(140),
  commune: z.enum(["Las Condes", "Providencia"]),
  mode: z.enum(["service", "membership"]),
  summary: z.string().min(1).max(8_000),
  finalPrice: z.number().finite().min(0).max(100_000_000),
  normalPrice: z.number().finite().min(0).max(100_000_000),
  cost: z.number().finite().min(0).max(100_000_000),
  margin: z.number().finite().min(-10_000).max(100),
  isProfitable: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});

export type CreateQuote = z.infer<typeof createQuoteSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type SavedQuoteView = z.infer<typeof savedQuoteSchema>;
