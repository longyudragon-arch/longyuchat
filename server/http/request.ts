import { z } from "zod";

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>) {
  const body = await request.json();
  return schema.parse(body);
}

