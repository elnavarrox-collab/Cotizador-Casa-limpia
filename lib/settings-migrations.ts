import type { PricingSettings } from "./settings-schema.ts";
import { COMMERCIAL_DEFAULTS } from "./commercial.ts";

export function applyCommercialV4(raw: Partial<PricingSettings>): Partial<PricingSettings> {
  if ((raw.schemaVersion ?? 0) >= 4) return raw;
  const stored = applyMarketPricingV3(raw);
  const prices: Record<string, number> = { cabinets: 12000, windows: 8000, balcony: 10000, party: 20000 };
  const names: Record<string, string> = { cabinets: "Interior muebles cocina vacíos (desde)", windows: "Ventanal estándar por unidad, con marco", balcony: "Balcón hasta 5 m²" };
  const addons = stored.addons?.filter(a => a.id !== "move").map(a => ({ ...a, price: prices[a.id] ?? a.price, name: names[a.id] ?? a.name }));
  for (const addon of [
    { id: "window_small", name: "Ventana pequeña por unidad, con marco", price: 4000, minutes: 20 },
    { id: "window_large", name: "Ventanal grande por unidad (desde)", price: 10000, minutes: 45 },
    { id: "balcony_medium", name: "Terraza de más de 5 hasta 10 m²", price: 15000, minutes: 60 },
    { id: "organize_kitchen", name: "Muebles cocina con vaciado y organización (desde)", price: 16000, minutes: 90 },
    { id: "organize_closet", name: "Organización de un módulo de closet (desde)", price: 10000, minutes: 60 },
  ]) if (addons && !addons.some(a => a.id === addon.id)) addons.push(addon);
  return { ...stored, schemaVersion: 4, minimumPrice: 35000, propertyBase: { ...stored.propertyBase!, department: 37000 }, conditionPct: { maintenance: 0, normal: 0, accumulated: 0, deep: 0 }, commercial: structuredClone(COMMERCIAL_DEFAULTS), addons };
}

const MARKET_ADDON_PRICES_V3: Record<string, number> = {
  cabinets: 16_000,
  windows: 18_000,
  balcony: 18_000,
  party: 30_000,
  move: 60_000,
};

export function applyMarketPricingV3(stored: Partial<PricingSettings>): Partial<PricingSettings> {
  if ((stored.schemaVersion ?? 0) >= 3) return stored;

  return {
    ...stored,
    schemaVersion: 3,
    minimumPrice: 42_000,
    propertyBase: { department: 42_000, house: 55_000, office: 60_000 },
    extraBathroomPrice: 8_000,
    conditionPct: {
      maintenance: stored.conditionPct?.maintenance ?? 0,
      normal: stored.conditionPct?.normal ?? 15,
      accumulated: 45,
      deep: 80,
    },
    frequencyDiscountPct: {
      one: stored.frequencyDiscountPct?.one ?? 0,
      four: stored.frequencyDiscountPct?.four ?? 10,
      eight: stored.frequencyDiscountPct?.eight ?? 15,
      twelve: 20,
    },
    weekendPct: 25,
    addons: stored.addons?.map((addon) => ({
      ...addon,
      price: MARKET_ADDON_PRICES_V3[addon.id] ?? addon.price,
    })),
  };
}
