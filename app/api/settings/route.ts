import { auth } from "@clerk/nextjs/server";
import { getDatabase } from "@/lib/mongodb";
import { settingsUpdateSchema } from "@/lib/settings-schema";
import { revisionMatches } from "@/lib/concurrency";
import { readJsonBody, withApiErrors } from "@/lib/api-errors";
import { applyCommercialV4 } from "@/lib/settings-migrations";

export const dynamic = "force-dynamic";

export const GET = withApiErrors(async () => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const database = await getDatabase();
  const document = await database.collection("user_settings").findOne(
    { userId },
    { projection: { _id: 0, settings: 1, updatedAt: 1, revision: 1 } },
  );

  const migratedSettings = document?.settings ? applyCommercialV4(document.settings) : null;
  return Response.json({ settings: migratedSettings, updatedAt: document?.updatedAt ?? null, revision: document?.revision ?? 0 });
});

export const PUT = withApiErrors(async (request: Request) => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const parsed = settingsUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return Response.json({ error: "Configuración inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  const database = await getDatabase();
  const collection = database.collection("user_settings");
  await collection.createIndex({ userId: 1 }, { unique: true, name: "unique_user_settings" });
  const existing = await collection.findOne({ userId }, { projection: { _id: 1, revision: 1 } });
  const currentRevision = typeof existing?.revision === "number" ? existing.revision : 0;

  if (!revisionMatches(parsed.data.baseRevision, currentRevision)) {
    return Response.json({ error: "SETTINGS_CONFLICT", message: "La configuración cambió en otra sesión.", revision: currentRevision }, { status: 409 });
  }

  const updatedAt = new Date();
  const nextRevision = currentRevision + 1;
  if (existing) {
    const revisionGuard = typeof existing.revision === "number"
      ? { _id: existing._id, revision: currentRevision }
      : { _id: existing._id, revision: { $exists: false } };
    const result = await collection.updateOne(
      revisionGuard,
      { $set: { userId, settings: parsed.data.settings, updatedAt, revision: nextRevision } },
    );
    if (!result.matchedCount) {
      return Response.json({ error: "SETTINGS_CONFLICT", message: "La configuración cambió durante el guardado." }, { status: 409 });
    }
  } else {
    try {
      await collection.insertOne({ userId, settings: parsed.data.settings, createdAt: updatedAt, updatedAt, revision: nextRevision });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 11000) {
        return Response.json({ error: "SETTINGS_CONFLICT", message: "La configuración fue creada en otra sesión." }, { status: 409 });
      }
      throw error;
    }
  }

  return Response.json({ saved: true, updatedAt: updatedAt.toISOString(), revision: nextRevision });
});
