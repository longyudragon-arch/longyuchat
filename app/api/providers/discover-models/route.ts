import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { parseJsonBody } from "@/server/http/request";
import { discoverProviderModels } from "@/server/services/model-discovery-service";

const discoverModelsSchema = z.object({
  provider: z.enum(["OPENAI_COMPATIBLE", "CLAUDE", "GEMINI", "GROK", "DOUBAO", "DEEPSEEK", "MODELSCOPE"]),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, discoverModelsSchema);
    const models = await discoverProviderModels(body);

    return NextResponse.json({ models });
  } catch (error) {
    return handleRouteError(error);
  }
}
