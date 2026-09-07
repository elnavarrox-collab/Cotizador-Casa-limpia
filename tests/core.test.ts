import assert from "node:assert/strict";
import test from "node:test";
import { userStorageKey } from "../lib/client-storage.ts";
import { revisionMatches } from "../lib/concurrency.ts";
import { calculateQuote } from "../lib/pricing.ts";
import { createQuoteSchema, quoteDraftSchema, quoteInputSchema, savedQuoteSchema } from "../lib/quote-schema.ts";
import { resetPromiseOnRejection } from "../lib/recoverable-promise.ts";
import { enforceQuoteWriteLimits, getQuoteWriteLimits, WriteLimitError } from "../lib/write-limits.ts";
import { applyMarketPricingV3, applyCommercialV4 } from "../lib/settings-migrations.ts";
import { parseTabHash } from "../lib/navigation.ts";
import { copyText } from "../lib/clipboard.ts";
import { settingsSchema } from "../lib/settings-schema.ts";
import { readJsonBody, withApiErrors } from "../lib/api-errors.ts";
import { enqueueQuote, readQuoteQueue, removeQueuedQuote } from "../lib/offline-queue.ts";

const settings = {
  schemaVersion: 2,
  minimumPrice: 35_000,
  propertyBase: { department: 35_000, house: 45_000, office: 50_000 },
  includedSqm: { department: 40, house: 60, office: 60 },
  extraSqmPrice: 650,
  extraBedroomPrice: 4_000,
  extraBathroomPrice: 6_000,
  conditionPct: { maintenance: 0, normal: 15, accumulated: 35, deep: 60 },
  frequencyDiscountPct: { one: 0, four: 10, eight: 15, twelve: 18 },
  urgencyPct: 20,
  weekendPct: 10,
  workers: 2,
  workerHourlyCost: 6_000,
  productivitySqmPerTeamHour: 22,
  extraBedroomHours: 0.25,
  extraBathroomHours: 0.5,
  conditionExtraHours: { maintenance: 0, normal: 0.5, accumulated: 1.5, deep: 2.5 },
  minimumVisitHours: 2,
  maxTeamHoursPerDay: 6,
  suppliesBaseCost: 3_500,
  suppliesCostPerSqm: 45,
  transportCost: 7_000,
  targetMarginPct: 35,
  defaultManualAdjustment: 0,
  addons: [],
  memberships: [
    { id: "invalid", line: "Hogar", name: "Sin horas", price: 120_000, visits: 4, hours: 0, features: [] },
    { id: "valid", line: "Hogar", name: "Operativo", price: 180_000, visits: 4, hours: 16, features: [] },
  ],
};

const serviceInput = {
  mode: "service" as const,
  property: "department" as const,
  sqm: 50,
  bedrooms: 1,
  bathrooms: 1,
  condition: "normal" as const,
  frequency: "one" as const,
  selectedAddonIds: [],
  urgent: false,
  weekend: false,
  flashDiscountPct: 0 as const,
  plannedDays: 0 as const,
  manualAdjustment: 0,
};

const commercialSettings = () => settingsSchema.parse(applyCommercialV4(settings));

test("v4 aplica paquetes sin duplicar superficie, habitaciones ni recargo profundo", () => {
  const config = commercialSettings();
  for (const [sqm, bedrooms, bathrooms, general, deep] of [[35,1,1,37000,45000],[60,2,2,47000,60000],[85,3,2,57000,72000],[120,3,3,77000,92000],[120,4,3,82000,100000]]) {
    for (const serviceType of ["general", "deep"] as const) {
      const result = calculateQuote({...serviceInput,sqm,bedrooms,bathrooms,serviceType},config);
      assert.equal(result.finalPrice, serviceType === "general" ? general : deep);
      assert.equal(result.roomExtra + result.sizeExtra + result.conditionExtra, 0);
      assert.equal(result.financialsPending, true);
      assert.equal(result.isProfitable, false);
    }
  }
});

test("personal conserva horas-persona, entrega no duplica incluidos y multiplica ventanas", () => {
  const config = commercialSettings();
  config.addons.push({id:"cabinets",name:"Muebles",price:12000,minutes:60},{id:"balcony",name:"Balcón",price:10000,minutes:45},{id:"windows",name:"Ventanales",price:8000,minutes:30});
  const input = {...serviceInput,sqm:35,serviceType:"delivery" as const,selectedAddonIds:["cabinets","balcony","windows"],addonQuantities:{windows:3}};
  const one = calculateQuote({...input,workers:1},config);
  const two = calculateQuote({...input,workers:2},config);
  assert.equal(one.finalPrice,79000);
  assert.equal(one.personHours,two.personHours);
  assert.equal(one.hoursPerVisit, two.hoursPerVisit*2);
  assert.equal(one.addons,24000);
  assert.equal(one.needsReview,true);
});

test("fuera de tabla exige revisión y descuentos no falsean el objetivo", () => {
  const config = commercialSettings();
  assert.equal(calculateQuote({...serviceInput,sqm:180,bedrooms:4,bathrooms:4},config).needsReview,true);
  config.commercial!.costsConfirmed = true;
  config.commercial!.targetTakeHome = 100000;
  const result = calculateQuote({...serviceInput,sqm:35,flashDiscountPct:20},config);
  assert.equal(result.finalPrice,29600);
  assert.equal(result.isProfitable,false);
  assert.equal(result.financialsPending,false);
  assert.ok(result.dailyCapacity <= 2);
});

test("migración v4 es idempotente y conserva personalizaciones posteriores", () => {
  const config = commercialSettings();
  config.commercial!.packages[0].general=39000;
  assert.deepEqual(applyCommercialV4(config),config);
  assert.ok(!config.addons.some(a => a.id === "move"));
});

test("cantidades y personal inválidos se rechazan; borrador conserva nuevos campos", () => {
  for (const workers of [0,3,1.5]) assert.equal(quoteInputSchema.safeParse({...serviceInput,workers}).success,false);
  for (const count of [-1,1.5,101]) assert.equal(quoteInputSchema.safeParse({...serviceInput,addonQuantities:{windows:count}}).success,false);
  const input = {...serviceInput,serviceType:"delivery",workers:2,addonQuantities:{windows:3}};
  const draft = quoteDraftSchema.parse({quoteName:"Prueba",client:"",commune:"Las Condes",input});
  assert.deepEqual(draft.input,input);
});

test("aísla claves locales por usuario", () => {
  assert.notEqual(userStorageKey("user_A", "pricing"), userStorageKey("user_B", "pricing"));
  assert.notEqual(userStorageKey("user_A", "draft"), userStorageKey("user_B", "draft"));
});

test("conserva un borrador incompleto sin convertir vacío en cero", () => {
  const draft = quoteDraftSchema.parse({ quoteName: "Visita", client: "Cliente", commune: "Las Condes", input: { ...serviceInput, sqm: null } });
  assert.equal(draft.input.mode, "service");
  if (draft.input.mode === "service") assert.equal(draft.input.sqm, null);
});

test("rechaza magnitudes físicas inválidas", () => {
  assert.equal(quoteInputSchema.safeParse({ ...serviceInput, sqm: 0 }).success, false);
  assert.equal(quoteInputSchema.safeParse({ ...serviceInput, bedrooms: 1.5 }).success, false);
  assert.equal(quoteInputSchema.safeParse(serviceInput).success, true);
});

test("bloquea membresía sin horas y calcula una operativa", () => {
  assert.throws(() => calculateQuote({ mode: "membership", membershipId: "invalid", manualAdjustment: 0 }, settings), /MEMBERSHIP_INCOMPLETE/);
  const result = calculateQuote({ mode: "membership", membershipId: "valid", manualAdjustment: 0 }, settings);
  assert.equal(result.cost, 138_000);
});

test("el servidor no conserva totales financieros del cliente", () => {
  const parsed = createQuoteSchema.parse({
    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
    name: "", client: "Cliente", commune: "Las Condes", mode: "service", input: serviceInput, summary: "Resumen",
    finalPrice: 1, cost: 0, margin: 100, isProfitable: true,
  });
  assert.equal("finalPrice" in parsed, false);
  assert.equal("cost" in parsed, false);
});

test("rechaza registros históricos corruptos", () => {
  const quote = { _id: "64b64c6f4f1a2b3c4d5e6f70", client: "A", commune: "Las Condes", mode: "service", summary: "x", finalPrice: 10, normalPrice: 10, cost: 5, margin: 50, isProfitable: true, createdAt: "2026-09-04T12:00:00.000Z" };
  assert.equal(savedQuoteSchema.safeParse(quote).success, true);
  assert.equal(savedQuoteSchema.safeParse({ ...quote, margin: "50" }).success, false);
  assert.equal(savedQuoteSchema.safeParse({ ...quote, createdAt: "ayer" }).success, false);
});

test("detecta revisiones concurrentes", () => {
  assert.equal(revisionMatches(3, 3), true);
  assert.equal(revisionMatches(2, 3), false);
});

test("descarta una promesa rechazada y permite reintentar", async () => {
  let cached: Promise<string> | undefined;
  let calls = 0;
  const get = () => {
    if (!cached) {
      const promise = ++calls === 1 ? Promise.reject(new Error("red")) : Promise.resolve("ok");
      cached = resetPromiseOnRejection(promise, (rejected) => { if (cached === rejected) cached = undefined; });
    }
    return cached;
  };
  await assert.rejects(get());
  assert.equal(await get(), "ok");
  assert.equal(calls, 2);
});

test("normaliza límites de escritura", () => {
  assert.deepEqual(getQuoteWriteLimits({}), { perMinute: 20, total: 10_000 });
  assert.deepEqual(getQuoteWriteLimits({ QUOTE_WRITE_LIMIT_PER_MINUTE: "5", MAX_QUOTES_PER_USER: "25" }), { perMinute: 5, total: 25 });
});

test("restaura pestañas válidas desde la URL", () => {
  assert.equal(parseTabHash("#history"), "history");
  assert.equal(parseTabHash("#settings"), "settings");
  assert.equal(parseTabHash("#desconocida"), "quote");
});

test("usa fallback si falla el portapapeles y reporta fallo total", async () => {
  const broken = { writeText: async () => { throw new Error("permiso"); } };
  assert.equal(await copyText("texto", broken, () => true), "fallback");
  await assert.rejects(copyText("texto", broken, () => false), /COPY_FAILED/);
});

test("rechaza IDs duplicados en configuración", () => {
  const duplicate = { ...settings, addons: [{ id: "same", name: "A", price: 1, minutes: 1 }, { id: "same", name: "B", price: 2, minutes: 2 }] };
  assert.equal(settingsSchema.safeParse(duplicate).success, false);
  assert.equal(settingsSchema.safeParse(settings).success, true);
});

test("convierte JSON inválido y fallos de base en errores estructurados", async () => {
  await assert.rejects(readJsonBody(new Request("https://local.test", { method: "POST", body: "{" })), (error: unknown) => error instanceof Error && error.message.includes("JSON válido"));
  const mongoFailure = withApiErrors(async () => { const error = new Error("sin conexión"); error.name = "MongoServerSelectionError"; throw error; });
  const response = await mongoFailure();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "DATABASE_UNAVAILABLE", message: "La base de datos no está disponible temporalmente." });
});

test("encola sin duplicar y reconcilia por clave idempotente", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const quote = createQuoteSchema.parse({ idempotencyKey: "123e4567-e89b-42d3-a456-426614174000", name: "", client: "A", commune: "Las Condes", mode: "service", input: serviceInput, summary: "x" });
  enqueueQuote(storage, "queue", quote);
  enqueueQuote(storage, "queue", quote);
  assert.equal(readQuoteQueue(storage, "queue").length, 1);
  assert.equal(removeQueuedQuote(storage, "queue", quote.idempotencyKey), 0);
  assert.equal(readQuoteQueue(storage, "queue").length, 0);
});

test("reserva atómicamente el último cupo concurrente", async () => {
  const previousLimit = process.env.MAX_QUOTES_PER_USER;
  process.env.MAX_QUOTES_PER_USER = "10";
  let usageCount = 9;
  const database = {
    collection(name: string) {
      if (name === "quotes") return { countDocuments: async () => 9 };
      if (name === "write_rate_limits") return {
        createIndex: async () => "index",
        findOneAndUpdate: async () => ({ count: 1 }),
      };
      return {
        createIndex: async () => "index",
        updateOne: async (_filter: unknown, update: { $inc?: { count?: number } }) => { if (update.$inc?.count === -1) usageCount -= 1; return { matchedCount: 1 }; },
        findOneAndUpdate: async (filter: { count: { $lt: number } }) => {
          if (usageCount >= filter.count.$lt) return null;
          usageCount += 1;
          return { count: usageCount };
        },
      };
    },
  };
  const results = await Promise.allSettled([enforceQuoteWriteLimits(database as never, "user"), enforceQuoteWriteLimits(database as never, "user")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof WriteLimitError);
  if (previousLimit === undefined) delete process.env.MAX_QUOTES_PER_USER;
  else process.env.MAX_QUOTES_PER_USER = previousLimit;
});

test("migra tarifas de mercado v2 a v3 sin alterar valores ya migrados", () => {
  const old = applyMarketPricingV3({ ...settings, addons: [
    { id: "cabinets", name: "Muebles", price: 12_000, minutes: 60 },
    { id: "windows", name: "Ventanas", price: 15_000, minutes: 60 },
    { id: "balcony", name: "Terraza", price: 15_000, minutes: 45 },
    { id: "party", name: "Fiesta", price: 20_000, minutes: 90 },
    { id: "move", name: "Mudanza", price: 30_000, minutes: 120 },
    { id: "oven", name: "Horno", price: 12_000, minutes: 45 },
  ] });
  assert.equal(old.schemaVersion, 3);
  assert.equal(old.minimumPrice, 42_000);
  assert.deepEqual(old.propertyBase, { department: 42_000, house: 55_000, office: 60_000 });
  assert.equal(old.extraBathroomPrice, 8_000);
  assert.equal(old.conditionPct?.accumulated, 45);
  assert.equal(old.conditionPct?.deep, 80);
  assert.equal(old.frequencyDiscountPct?.twelve, 20);
  assert.equal(old.weekendPct, 25);
  assert.deepEqual(Object.fromEntries(old.addons?.map((addon) => [addon.id, addon.price]) ?? []), {
    cabinets: 16_000, windows: 18_000, balcony: 18_000, party: 30_000, move: 60_000, oven: 12_000,
  });
  const alreadyV3 = { ...old, minimumPrice: 50_000 };
  assert.equal(applyMarketPricingV3(alreadyV3).minimumPrice, 50_000);
});
