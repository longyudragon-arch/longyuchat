import { z } from "zod";

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return schema.parse(undefined);
  }

  return schema.parse(JSON.parse(rawBody));
}
