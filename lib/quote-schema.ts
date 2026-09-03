import { z } from "zod";

export const createQuoteSchema = z.object({
  client: z.string().trim().max(140).default(""),
  commune: z.enum(["Las Condes", "Providencia"]),
  mode: z.enum(["service", "membership"]),
  summary: z.string().trim().min(1).max(8_000),
  finalPrice: z.number().finite().min(0).max(100_000_000),
  normalPrice: z.number().finite().min(0).max(100_000_000),
  cost: z.number().finite().min(0).max(100_000_000),
  margin: z.number().finite().min(-10_000).max(100),
  isProfitable: z.boolean(),
});

export type CreateQuote = z.infer<typeof createQuoteSchema>;
