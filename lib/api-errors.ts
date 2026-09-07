export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError("INVALID_JSON", "El cuerpo debe contener JSON válido.", 400);
  }
}

export function withApiErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.code, message: error.message }, { status: error.status });
      }
      const name = error instanceof Error ? error.name : "";
      if (name.startsWith("Mongo") || name.includes("BSON")) {
        return Response.json({ error: "DATABASE_UNAVAILABLE", message: "La base de datos no está disponible temporalmente." }, { status: 503 });
      }
      console.error("Unhandled API error", error);
      return Response.json({ error: "INTERNAL_ERROR", message: "Ocurrió un error interno inesperado." }, { status: 500 });
    }
  };
}
