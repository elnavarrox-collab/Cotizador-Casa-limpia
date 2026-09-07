import type { Db } from "mongodb";

export class WriteLimitError extends Error {
  readonly code: "RATE_LIMITED" | "QUOTE_QUOTA_REACHED";
  readonly status: number;

  constructor(code: "RATE_LIMITED" | "QUOTE_QUOTA_REACHED", status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function getQuoteWriteLimits(environment: Record<string, string | undefined> = process.env) {
  const perMinute = Number(environment.QUOTE_WRITE_LIMIT_PER_MINUTE ?? 20);
  const total = Number(environment.MAX_QUOTES_PER_USER ?? 10_000);
  return {
    perMinute: Number.isSafeInteger(perMinute) && perMinute > 0 ? perMinute : 20,
    total: Number.isSafeInteger(total) && total > 0 ? total : 10_000,
  };
}

export async function enforceQuoteWriteLimits(database: Db, userId: string, now = new Date()) {
  const limits = getQuoteWriteLimits();
  const bucket = now.toISOString().slice(0, 16);
  const expiresAt = new Date(now.getTime() + 2 * 60_000);
  const rateCollection = database.collection("write_rate_limits");
  await rateCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expire_write_buckets" });
  await rateCollection.createIndex({ userId: 1, bucket: 1 }, { unique: true, name: "unique_user_write_bucket" });
  const rate = await rateCollection.findOneAndUpdate(
    { userId, bucket },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" },
  );
  if ((rate?.count ?? 0) > limits.perMinute) throw new WriteLimitError("RATE_LIMITED", 429);

  const usageCollection = database.collection("quote_usage");
  await usageCollection.createIndex({ userId: 1 }, { unique: true, name: "unique_quote_usage" });
  const existingCount = await database.collection("quotes").countDocuments({ userId }, { limit: limits.total });
  try {
    await usageCollection.updateOne(
      { userId },
      { $setOnInsert: { userId, count: existingCount, createdAt: now } },
      { upsert: true },
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
  }
  const reservation = await usageCollection.findOneAndUpdate(
    { userId, count: { $lt: limits.total } },
    { $inc: { count: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!reservation) throw new WriteLimitError("QUOTE_QUOTA_REACHED", 409);
  return {
    release: async () => {
      await usageCollection.updateOne({ userId, count: { $gt: 0 } }, { $inc: { count: -1 } });
    },
  };
}
