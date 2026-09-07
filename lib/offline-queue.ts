import { createQuoteSchema, type CreateQuote } from "./quote-schema.ts";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readQuoteQueue(storage: StorageLike, key: string): CreateQuote[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const parsed = createQuoteSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function enqueueQuote(storage: StorageLike, key: string, quote: CreateQuote) {
  const queue = readQuoteQueue(storage, key);
  if (!queue.some((item) => item.idempotencyKey === quote.idempotencyKey)) queue.push(quote);
  storage.setItem(key, JSON.stringify(queue.slice(-100)));
  return queue.length;
}

export function removeQueuedQuote(storage: StorageLike, key: string, idempotencyKey: string) {
  const remaining = readQuoteQueue(storage, key).filter((item) => item.idempotencyKey !== idempotencyKey);
  if (remaining.length) storage.setItem(key, JSON.stringify(remaining));
  else storage.removeItem(key);
  return remaining.length;
}
