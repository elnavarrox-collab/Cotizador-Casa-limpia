const STORAGE_PREFIX = "casa-limpia";

export function userStorageKey(userId: string, resource: "pricing" | "draft" | "quote-queue") {
  if (!userId.trim()) throw new Error("Se requiere un usuario para crear una clave local.");
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${resource}:v1`;
}

export const LEGACY_PRICING_KEY = "casa-limpia-pricing-v1";
