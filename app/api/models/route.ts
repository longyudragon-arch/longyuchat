import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { parseJsonBody } from "@/server/http/request";
import { presentModelConfig, presentModelConfigList } from "@/server/presenters/api-presenters";
import { createModelConfig, listModelConfigs } from "@/server/services/model-config-service";

const createModelSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(["OPENAI_COMPATIBLE", "CLAUDE", "GEMINI", "GROK", "DOUBAO", "DEEPSEEK", "MODELSCOPE"]),
  baseUrl: z.string().url(),
  modelName: z.string().min(1),
  apiKey: z.string().min(1),
  defaultReplyLength: z.number().int().min(50).max(4000).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const models = await listModelConfigs();
    return NextResponse.json({ models: presentModelConfigList(models) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createModelSchema);
    const model = await createModelConfig(body);

    return NextResponse.json(
      { model: presentModelConfig(model) },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
