import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { parseJsonBody } from "@/server/http/request";
import { presentModelConfig } from "@/server/presenters/api-presenters";
import { deleteModelConfig, getModelConfigById, updateModelConfig } from "@/server/services/model-config-service";

const updateModelSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.enum(["OPENAI_COMPATIBLE", "CLAUDE", "GEMINI", "GROK", "DOUBAO", "DEEPSEEK", "MODELSCOPE"]).optional(),
  baseUrl: z.string().url().optional(),
  modelName: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  defaultReplyLength: z.number().int().min(50).max(4000).optional(),
  enabled: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const model = await getModelConfigById(id);

    if (!model) {
      return NextResponse.json({ error: "The requested record was not found." }, { status: 404 });
    }

    return NextResponse.json({ model: presentModelConfig(model) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateModelSchema);
    const model = await updateModelConfig(id, body);

    return NextResponse.json({ model: presentModelConfig(model) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteModelConfig(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
