import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/mongodb";
import { settingsSchema } from "@/lib/settings-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const database = await getDatabase();
  const document = await database.collection("user_settings").findOne(
    { userId },
    { projection: { _id: 0, settings: 1, updatedAt: 1 } },
  );

  return Response.json({ settings: document?.settings ?? null, updatedAt: document?.updatedAt ?? null });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Configuración inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  const database = await getDatabase();
  await database.collection("user_settings").updateOne(
    { userId },
    { $set: { userId, settings: parsed.data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );

  return Response.json({ saved: true, updatedAt: new Date().toISOString() });
}
