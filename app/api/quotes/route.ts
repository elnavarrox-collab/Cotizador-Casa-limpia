import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/mongodb";
import { createQuoteSchema } from "@/lib/quote-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const database = await getDatabase();
  const quotes = await database.collection("quotes")
    .find({ userId }, { projection: { userId: 0 } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return Response.json({ quotes: quotes.map((quote) => ({ ...quote, _id: quote._id.toString() })) });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = createQuoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Cotización inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  const database = await getDatabase();
  const createdAt = new Date();
  const result = await database.collection("quotes").insertOne({ userId, ...parsed.data, createdAt });

  return Response.json({ saved: true, id: result.insertedId.toString(), createdAt: createdAt.toISOString() }, { status: 201 });
}
