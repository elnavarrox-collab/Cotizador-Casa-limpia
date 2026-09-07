import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { createQuoteSchema, renameQuoteSchema, savedQuoteSchema } from "@/lib/quote-schema";
import { isMembershipOperational } from "@/lib/settings-schema";
import { settingsSchema } from "@/lib/settings-schema";
import { calculateQuote } from "@/lib/pricing";
import { enforceQuoteWriteLimits, WriteLimitError } from "@/lib/write-limits";
import { readJsonBody, withApiErrors } from "@/lib/api-errors";
import { applyCommercialV4 } from "@/lib/settings-migrations";

export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (request: Request) => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25) || 25));
  const cursor = url.searchParams.get("cursor");
  if (cursor && !ObjectId.isValid(cursor)) {
    return Response.json({ error: "INVALID_CURSOR", message: "El cursor del historial no es válido." }, { status: 400 });
  }

  const database = await getDatabase();
  const filter = cursor ? { userId, _id: { $lt: new ObjectId(cursor) } } : { userId };
  const quotes = await database.collection("quotes")
    .find(filter, { projection: { userId: 0 } })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();

  const parsedQuotes = quotes.map((quote) => savedQuoteSchema.safeParse({
    ...quote,
    _id: quote._id.toString(),
    createdAt: quote.createdAt instanceof Date ? quote.createdAt.toISOString() : quote.createdAt,
  }));
  const validQuotes = parsedQuotes.flatMap((result) => result.success ? [result.data] : []);
  return Response.json({ quotes: validQuotes, invalidCount: parsedQuotes.length - validQuotes.length, nextCursor: quotes.length === limit ? quotes.at(-1)?._id.toString() ?? null : null });
});

export const POST = withApiErrors(async (request: Request) => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = createQuoteSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return Response.json({ error: "Cotización inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  const database = await getDatabase();
  const collection = database.collection("quotes");
  await collection.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true, name: "unique_quote_intent" });
  const existingQuote = await collection.findOne(
    { userId, idempotencyKey: parsed.data.idempotencyKey },
    { projection: { userId: 0 } },
  );
  if (existingQuote) {
    const serialized = savedQuoteSchema.parse({ ...existingQuote, _id: existingQuote._id.toString(), createdAt: existingQuote.createdAt.toISOString() });
    return Response.json({ saved: true, duplicate: true, quote: serialized });
  }
  const settingsDocument = await database.collection("user_settings").findOne(
    { userId },
    { projection: { settings: 1 } },
  );
  const parsedSettings = settingsSchema.safeParse(applyCommercialV4(settingsDocument?.settings ?? {}));
  if (!parsedSettings.success) {
    return Response.json({ error: "SETTINGS_NOT_READY", message: "Guarda una configuración válida antes de crear cotizaciones." }, { status: 422 });
  }
  if (parsed.data.input.mode === "membership") {
    const membershipId = parsed.data.input.membershipId;
    const memberships = parsedSettings.data.memberships;
    const plan = Array.isArray(memberships)
      ? memberships.find((candidate: { id?: unknown }) => candidate.id === membershipId)
      : null;
    if (!isMembershipOperational(plan)) {
      return Response.json(
        { error: "MEMBERSHIP_INCOMPLETE", message: "Configura horas y visitas válidas antes de cotizar este plan." },
        { status: 422 },
      );
    }
  }
  const calculated = calculateQuote(parsed.data.input, parsedSettings.data);
  let quotaReservation: Awaited<ReturnType<typeof enforceQuoteWriteLimits>>;
  try {
    quotaReservation = await enforceQuoteWriteLimits(database, userId);
  } catch (error) {
    if (error instanceof WriteLimitError) {
      return Response.json({ error: error.code, message: error.code === "RATE_LIMITED" ? "Demasiados guardados en un minuto. Intenta nuevamente pronto." : "Se alcanzó la cuota de cotizaciones de esta cuenta." }, { status: error.status });
    }
    throw error;
  }
  const createdAt = new Date();
  const automaticName = `${parsed.data.client || "Cliente sin nombre"} · ${parsed.data.commune} · ${new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" }).format(createdAt)}`;
  const name = parsed.data.name || automaticName.slice(0, 140);
  let result;
  try {
    result = await collection.updateOne(
      { userId, idempotencyKey: parsed.data.idempotencyKey },
      { $setOnInsert: {
        userId,
        ...parsed.data,
        name,
        finalPrice: calculated.finalPrice,
        normalPrice: calculated.priceBeforeDiscount,
        cost: calculated.cost,
        margin: calculated.margin,
        isProfitable: calculated.isProfitable,
        financialsPending: calculated.financialsPending,
        createdAt,
      } },
      { upsert: true },
    );
    if (!result.upsertedCount) await quotaReservation.release();
  } catch (error) {
    await quotaReservation.release();
    throw error;
  }
  const saved = await collection.findOne(
    { userId, idempotencyKey: parsed.data.idempotencyKey },
    { projection: { userId: 0 } },
  );
  if (!saved) throw new Error("No se pudo recuperar la cotización idempotente.");

  const serialized = savedQuoteSchema.parse({ ...saved, _id: saved._id.toString(), createdAt: saved.createdAt.toISOString() });
  return Response.json({ saved: true, duplicate: result.upsertedCount === 0, quote: serialized }, { status: result.upsertedCount ? 201 : 200 });
});

export const PATCH = withApiErrors(async (request: Request) => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = renameQuoteSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return Response.json({ error: "Nombre inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const database = await getDatabase();
  const result = await database.collection("quotes").updateOne(
    { _id: new ObjectId(parsed.data.id), userId },
    { $set: { name: parsed.data.name, updatedAt: new Date() } },
  );

  if (!result.matchedCount) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  return Response.json({ renamed: true, name: parsed.data.name });
});
